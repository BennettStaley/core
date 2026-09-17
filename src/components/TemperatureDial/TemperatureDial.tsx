'use client'

import { useCallback, useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { TEMP, tempFToOffset, offsetDisplay } from '@/src/lib/tempColors'
import { displayToSetpointF, formatSetpointF, setpointFToDisplay, type TempUnit } from '@/src/lib/tempUtils'

// Dial geometry — matches iOS TemperatureDialView
const DIAL_SIZE = 280
const RING_WIDTH = 6
// Reserved padding around the ring for the thumb (kept at 22 so the viewBox geometry is stable)
const THUMB_SIZE = 22
const THUMB_RADIUS = 10
const START_ANGLE = 135 // degrees
const TOTAL_SWEEP = 270 // degrees
const RADIUS = DIAL_SIZE / 2

// SVG viewBox with padding for thumb overflow
const PADDING = THUMB_SIZE
const VIEW_SIZE = DIAL_SIZE + PADDING * 2
const CENTER = VIEW_SIZE / 2
// Crop bottom of viewBox: arc endpoints are at y ≈ CENTER + R*sin(45°) + thumb
// No content below the arc endpoints, so trim dead space
const VIEW_HEIGHT = CENTER + RADIUS * Math.sin(Math.PI / 4) + THUMB_SIZE + 4

interface TemperatureDialProps {
  /** Current bed temperature in °F */
  currentTempF: number
  /** Target temperature in °F */
  targetTempF: number
  /** Whether the side is powered on */
  isOn: boolean
  /** Called when user drags to a new target temperature */
  onTemperatureChange: (tempF: number) => void
  /** Called when drag ends (for committing the final value) */
  onTemperatureCommit?: (tempF: number) => void
  /** User display unit; hardware values remain Fahrenheit. */
  unit?: TempUnit
}

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Calculate normalized progress (0–1) for a temperature within the dial range. */
function tempToProgress(tempF: number): number {
  const clamped = Math.max(TEMP.MIN_F, Math.min(TEMP.MAX_F, tempF))
  return (clamped - TEMP.MIN_F) / (TEMP.MAX_F - TEMP.MIN_F)
}

/** Calculate (x, y) position on the arc for a given progress. */
function progressToPoint(progress: number, r: number = RADIUS): { x: number, y: number } {
  const angle = START_ANGLE + progress * TOTAL_SWEEP
  const rad = toRad(angle)
  return {
    x: CENTER + Math.cos(rad) * r,
    y: CENTER + Math.sin(rad) * r,
  }
}

/**
 * Generate an SVG arc path from startProgress to endProgress.
 * Uses the arc command to draw along the circle.
 */
function arcPath(startProgress: number, endProgress: number, r: number = RADIUS): string {
  const start = progressToPoint(startProgress, r)
  const end = progressToPoint(endProgress, r)
  const sweepDeg = (endProgress - startProgress) * TOTAL_SWEEP
  const largeArc = sweepDeg > 180 ? 1 : 0

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function TemperatureDial({
  currentTempF,
  targetTempF,
  isOn,
  onTemperatureChange,
  onTemperatureCommit,
  unit = 'F',
}: TemperatureDialProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const lastTempRef = useRef(targetTempF)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOn) return
    let delta = 0
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = 1
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -1
    if (delta === 0) return
    e.preventDefault()
    const displayValue = setpointFToDisplay(targetTempF, unit) ?? targetTempF
    const nextDisplay = displayValue + delta
    const converted = displayToSetpointF(nextDisplay, unit) ?? targetTempF
    const newTemp = Math.round(Math.max(TEMP.MIN_F, Math.min(TEMP.MAX_F, converted)))
    onTemperatureChange(newTemp)
    onTemperatureCommit?.(newTemp)
  }, [isOn, targetTempF, unit, onTemperatureChange, onTemperatureCommit])

  const targetProgress = tempToProgress(targetTempF)
  const currentProgress = tempToProgress(currentTempF)
  const delta = targetTempF - currentTempF

  // One calm temperature colour: cool / neutral / warm (iOS system colours via Tailwind tokens)
  const tempColor = !isOn
    ? 'var(--color-zinc-500)'
    : delta <= -2
      ? 'var(--color-sky-400)'
      : delta >= 2
        ? 'var(--color-orange-400)'
        : 'var(--color-zinc-400)'

  const direction = isOn && targetTempF !== currentTempF
    ? targetTempF > currentTempF ? 'Warming' : 'Cooling'
    : null

  const offset = tempFToOffset(targetTempF)

  // --- Drag handling ---

  const angleToTemp = useCallback((clientX: number, clientY: number): number | null => {
    const svg = svgRef.current
    if (!svg) return null

    const rect = svg.getBoundingClientRect()
    const scaleX = VIEW_SIZE / rect.width
    const scaleY = VIEW_HEIGHT / rect.height
    const svgX = (clientX - rect.left) * scaleX
    const svgY = (clientY - rect.top) * scaleY

    const dx = svgX - CENTER
    const dy = svgY - CENTER

    // atan2 gives angle from positive x-axis
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI
    if (angle < 0) angle += 360

    // Normalize angle relative to startAngle
    let normalizedAngle = angle
    if (normalizedAngle < START_ANGLE) normalizedAngle += 360

    const progress = (normalizedAngle - START_ANGLE) / TOTAL_SWEEP

    // Reject if outside the arc (in the gap)
    if (progress < 0 || progress > 1) return null

    const range = TEMP.MAX_F - TEMP.MIN_F
    const newTemp = TEMP.MIN_F + Math.round(progress * range)
    return Math.max(TEMP.MIN_F, Math.min(TEMP.MAX_F, newTemp))
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isOn) return
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      setIsDragging(true)

      const temp = angleToTemp(e.clientX, e.clientY)
      if (temp !== null) {
        lastTempRef.current = temp
        onTemperatureChange(temp)
      }
    },
    [isOn, angleToTemp, onTemperatureChange]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.preventDefault()

      const temp = angleToTemp(e.clientX, e.clientY)
      if (temp !== null && temp !== lastTempRef.current) {
        lastTempRef.current = temp
        onTemperatureChange(temp)
      }
    },
    [isDragging, angleToTemp, onTemperatureChange]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      setIsDragging(false)
      onTemperatureCommit?.(lastTempRef.current)
    },
    [isDragging, onTemperatureCommit]
  )

  // --- Arc paths ---
  const bgArcPath = arcPath(0, 1)
  const targetArcPath = targetProgress > 0 ? arcPath(0, targetProgress) : null

  const thumbPos = progressToPoint(targetProgress)

  // Current temperature tick, drawn across the track
  const tickInner = progressToPoint(currentProgress, RADIUS - 9)
  const tickOuter = progressToPoint(currentProgress, RADIUS + 9)

  return (
    <div className="flex items-center justify-center" style={{ touchAction: 'none' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_HEIGHT}`}
        className="w-full max-w-[300px] select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label="Temperature dial"
        aria-valuemin={TEMP.MIN_F}
        aria-valuemax={TEMP.MAX_F}
        aria-valuenow={targetTempF}
        aria-valuetext={formatSetpointF(targetTempF, unit)}
        tabIndex={isOn ? 0 : -1}
      >
        {/* Track */}
        <path
          d={bgArcPath}
          fill="none"
          stroke="var(--color-zinc-800)"
          strokeWidth={RING_WIDTH}
          strokeLinecap="round"
        />

        {/* Filled arc up to the target */}
        {isOn && targetArcPath && (
          <path
            d={targetArcPath}
            fill="none"
            stroke={tempColor}
            strokeWidth={RING_WIDTH}
            strokeLinecap="round"
          />
        )}

        {/* Current temperature tick */}
        {isOn && (
          <line
            x1={tickInner.x}
            y1={tickInner.y}
            x2={tickOuter.x}
            y2={tickOuter.y}
            stroke="white"
            strokeOpacity={0.7}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}

        {/* Draggable thumb */}
        {isOn && (
          <circle
            cx={thumbPos.x}
            cy={thumbPos.y}
            r={THUMB_RADIUS}
            fill="white"
            style={{
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          />
        )}

        {/* Center content */}
        <foreignObject
          x={CENTER - 110}
          y={CENTER - 70}
          width={220}
          height={140}
        >
          <div
            className="flex h-full flex-col items-center justify-center"
            style={{ pointerEvents: 'none' }}
          >
            {isOn
              ? (
                  <>
                    <div className="flex h-5 items-center gap-1 text-[15px] font-medium" style={{ color: tempColor }}>
                      {direction === 'Warming' && <ArrowUp size={15} strokeWidth={2.25} aria-hidden />}
                      {direction === 'Cooling' && <ArrowDown size={15} strokeWidth={2.25} aria-hidden />}
                      {direction && <span>{direction}</span>}
                    </div>

                    <span
                      className="ios-numeric font-light tracking-tight text-white"
                      style={{ fontSize: 72, lineHeight: 1.05 }}
                    >
                      {formatSetpointF(targetTempF, unit, { includeUnit: false })}
                    </span>

                    <span className="ios-numeric mt-1 text-[15px] text-zinc-500">
                      {offsetDisplay(offset)}
                      {' · '}
                      Now
                      {' '}
                      {formatSetpointF(currentTempF, unit)}
                    </span>
                  </>
                )
              : (
                  <span
                    className="font-light text-zinc-500"
                    style={{ fontSize: 56, lineHeight: 1.05 }}
                  >
                    Off
                  </span>
                )}
          </div>
        </foreignObject>
      </svg>
    </div>
  )
}
