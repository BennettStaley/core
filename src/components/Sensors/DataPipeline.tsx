'use client'

import { memo, useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useOnSensorFrame } from '@/src/hooks/useSensorStream'
import type { SensorFrame } from '@/src/hooks/useSensorStream'
import { CardTitle } from './CardTitle'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONSUMER_NODES = [
  { key: 'piezo', label: 'Piezo', color: '#a78bfa', types: ['piezo-dual'] },
  { key: 'presence', label: 'Presence', color: '#4ade80', types: ['capSense', 'capSense2'] },
  { key: 'bedTemp', label: 'Bed temp', color: '#fb923c', types: ['bedTemp', 'bedTemp2'] },
  { key: 'freezer', label: 'Freezer', color: '#60a5fa', types: ['frzTemp', 'frzHealth', 'frzTherm'] },
  { key: 'status', label: 'Device', color: '#38bdf8', types: ['deviceStatus'] },
  { key: 'log', label: 'Log', color: '#fbbf24', types: ['log'] },
] as const

type ConsumerKey = (typeof CONSUMER_NODES)[number]['key']

const TYPE_TO_CONSUMER = new Map<string, ConsumerKey>()
for (const node of CONSUMER_NODES) {
  for (const t of node.types) TYPE_TO_CONSUMER.set(t, node.key)
}

const TIMELINE_WINDOW_MS = 30_000
const MAX_EVENTS = 500

// ---------------------------------------------------------------------------
// Custom ReactFlow node
// ---------------------------------------------------------------------------

interface PipelineNodeData {
  label: string
  sub: string
  color: string
  [key: string]: unknown
}

function PipelineNode({ data }: { data: PipelineNodeData }) {
  const { label, sub, color } = data
  return (
    <div className="flex flex-col rounded-lg px-2 py-1" style={{ minWidth: 92, background: '#2C2C2E' }}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', width: 0, height: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', width: 0, height: 0 }} />
      <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium leading-[14px] text-white">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        {label}
      </span>
      {sub && (
        <span className="whitespace-nowrap text-[11px] leading-[14px] text-zinc-500">
          {sub}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Static ReactFlow DAG — module-level constants, memo'd wrapper.
// Nothing here changes at runtime. Parent re-renders never propagate in.
// ---------------------------------------------------------------------------

const NODE_TYPES = { pipeline: PipelineNode }

// Compact layout so fitView lands at ~1× zoom on a 393pt phone (labels stay legible).
const CX = 108
const LX = 0
const RX = 216
const RY = 62

const STATIC_NODES: Node[] = [
  { id: 'firmware', type: 'pipeline', position: { x: CX, y: 0 },
    data: { label: 'Firmware', sub: 'frankenfirmware', color: '#71717a' } },
  { id: 'raw', type: 'pipeline', position: { x: LX, y: RY },
    data: { label: 'RAW files', sub: 'CBOR on disk', color: '#71717a' } },
  { id: 'dac-transport', type: 'pipeline', position: { x: CX, y: RY },
    data: { label: 'dacTransport', sub: 'dac.sock', color: '#a1a1aa' } },
  { id: 'piezo-stream', type: 'pipeline', position: { x: LX, y: RY * 2 },
    data: { label: 'piezoStream', sub: 'tails + parses', color: '#8b5cf6' } },
  { id: 'dac-monitor', type: 'pipeline', position: { x: CX, y: RY * 2 },
    data: { label: 'DacMonitor', sub: 'polls 2s', color: '#3b82f6' } },
  { id: 'trpc', type: 'pipeline', position: { x: RX, y: RY * 2 },
    data: { label: 'tRPC :3000', sub: 'mutations', color: '#f97316' } },
  { id: 'broadcast', type: 'pipeline', position: { x: LX + 54, y: RY * 3 },
    data: { label: 'broadcastFrame()', sub: 'event bus', color: '#a78bfa' } },
  { id: 'ws', type: 'pipeline', position: { x: LX + 54, y: RY * 4 },
    data: { label: 'WebSocket', sub: ':3001', color: '#a78bfa' } },
  { id: 'browser', type: 'pipeline', position: { x: CX, y: RY * 5 },
    data: { label: 'Browser', sub: 'React UI', color: '#e2e8f0' } },
]

const READ_STROKE = { stroke: '#636366', strokeWidth: 1.5 }
const WRITE_STROKE = { stroke: '#FF9F0A', strokeWidth: 1.5, strokeDasharray: '5 3' }

const STATIC_EDGES: Edge[] = [
  { id: 'fw-raw', source: 'firmware', target: 'raw', animated: true, style: READ_STROKE },
  { id: 'fw-dt', source: 'firmware', target: 'dac-transport', animated: true, style: READ_STROKE },
  { id: 'raw-ps', source: 'raw', target: 'piezo-stream', animated: true, style: READ_STROKE },
  { id: 'dt-dm', source: 'dac-transport', target: 'dac-monitor', animated: true, style: READ_STROKE },
  { id: 'ps-bc', source: 'piezo-stream', target: 'broadcast', animated: true, style: READ_STROKE },
  { id: 'dm-bc', source: 'dac-monitor', target: 'broadcast', animated: true, style: READ_STROKE },
  { id: 'bc-ws', source: 'broadcast', target: 'ws', animated: true, style: READ_STROKE },
  { id: 'ws-browser', source: 'ws', target: 'browser', animated: true, style: READ_STROKE },
  { id: 'browser-trpc', source: 'browser', target: 'trpc', animated: true, style: WRITE_STROKE },
  { id: 'trpc-dt', source: 'trpc', target: 'dac-transport', animated: true, style: WRITE_STROKE },
]

const FIT_VIEW_OPTIONS = { padding: 0.04, maxZoom: 1 }
const PRO_OPTIONS = { hideAttribution: true }

const StaticDag = memo(function StaticDag() {
  return (
    <div className="mb-3" style={{ height: 350 }}>
      <ReactFlow
        nodes={STATIC_NODES}
        edges={STATIC_EDGES}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        preventScrolling={false}
        elementsSelectable={false}
        proOptions={PRO_OPTIONS}
      />
    </div>
  )
})

// ---------------------------------------------------------------------------
// Timeline dot type
// ---------------------------------------------------------------------------

interface TimelineDot {
  type: string
  consumer: ConsumerKey
  ts: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Data pipeline visualization: static ReactFlow DAG + live canvas timeline.
 *
 * ReactFlow is isolated inside a memo'd zero-prop component with all data
 * as module-level constants. Parent re-renders from useOnSensorFrame never
 * reach ReactFlow's internal zustand store.
 */
export function DataPipeline() {
  const eventsRef = useRef<TimelineDot[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // Track frames via ref only — no React state for high-frequency data
  useOnSensorFrame(useCallback((frame: SensorFrame) => {
    const consumer = TYPE_TO_CONSUMER.get(frame.type)
    if (!consumer) return
    eventsRef.current.push({ type: frame.type, consumer, ts: Date.now() })
    if (eventsRef.current.length > MAX_EVENTS) {
      eventsRef.current = eventsRef.current.slice(-MAX_EVENTS)
    }
  }, []))

  // Canvas animation for timeline
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)

      const W = rect.width
      const H = rect.height
      const laneH = H / CONSUMER_NODES.length
      const now = Date.now()
      const windowStart = now - TIMELINE_WINDOW_MS

      ctx.clearRect(0, 0, W, H)

      // Lane separators
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 1
      for (let i = 1; i < CONSUMER_NODES.length; i++) {
        ctx.beginPath()
        ctx.moveTo(0, i * laneH)
        ctx.lineTo(W, i * laneH)
        ctx.stroke()
      }

      // Time markers (every 10s; labels live in the HTML axis below)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      for (let t = 10; t < TIMELINE_WINDOW_MS / 1000; t += 10) {
        const x = W - (t / (TIMELINE_WINDOW_MS / 1000)) * W
        ctx.fillRect(x, 0, 1, H)
      }

      // Event dots
      const events = eventsRef.current
      for (const ev of events) {
        if (ev.ts < windowStart) continue
        const laneIdx = CONSUMER_NODES.findIndex(n => n.key === ev.consumer)
        if (laneIdx === -1) continue

        const x = ((ev.ts - windowStart) / TIMELINE_WINDOW_MS) * W
        const y = laneIdx * laneH + laneH / 2
        const age = (now - ev.ts) / TIMELINE_WINDOW_MS
        const alpha = Math.max(0.12, 1 - age * 0.85)
        const config = CONSUMER_NODES[laneIdx]

        if (age < 0.02) {
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, Math.PI * 2)
          ctx.fillStyle = config.color + '30'
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(x, y, age < 0.02 ? 2.5 : 1.5, 0, Math.PI * 2)
        ctx.fillStyle = config.color + Math.round(alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()
      }

      // Prune old events
      eventsRef.current = events.filter(ev => ev.ts >= windowStart)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div>
      <div className="mb-2">
        <CardTitle
          title="Data pipeline"
          trailing={(
            <div className="flex items-center gap-3 text-[13px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-[2px] w-3 rounded-full" style={{ background: READ_STROKE.stroke }} />
                Read
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: WRITE_STROKE.stroke }} />
                Write
              </span>
            </div>
          )}
        />
      </div>

      {/* ReactFlow DAG — memo'd, zero-prop, fully isolated */}
      <StaticDag />

      {/* Timeline canvas with lane labels */}
      <div className="border-t border-zinc-800 pt-3">
        <div className="flex gap-2">
          <div className="flex w-16 shrink-0 flex-col">
            {CONSUMER_NODES.map(node => (
              <div key={node.key} className="flex h-5 items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: node.color }} />
                {node.label}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <canvas
              ref={canvasRef}
              className="w-full rounded-md bg-black/30"
              style={{ height: CONSUMER_NODES.length * 20 }}
            />
            <div className="ios-numeric mt-1 flex justify-between text-[11px] text-zinc-500">
              <span>-30s</span>
              <span>-20s</span>
              <span>-10s</span>
              <span>Now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
