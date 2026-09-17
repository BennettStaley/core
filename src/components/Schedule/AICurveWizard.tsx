'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Save,
  Share2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ListRow, ListSection, Sheet } from '@/src/ui/ios'
import { AddRow, SheetAction, Stepper } from './EditorRows'
import { tempTint } from './scheduleFormat'
import {
  generatePrompt,
  parseAIResponse,
  EXAMPLE_SUGGESTIONS,
  loadTemplates,
  saveTemplate,
  deleteTemplate,
} from '@/src/lib/sleepCurve/curvePrompt'
import type { GeneratedCurve, CurveTemplate, ParseResult } from '@/src/lib/sleepCurve/curvePrompt'
import { timeStringToMinutes } from '@/src/lib/sleepCurve/generate'
import type { CurvePoint } from '@/src/lib/sleepCurve/types'
import { CurveChart } from './CurveChart'
import { PhaseLegend } from './PhaseLegend'

interface AICurveWizardProps {
  open: boolean
  onClose: () => void
  /**
   * Called when the user accepts a generated curve. The parent loads the
   * set points + bedtime/wake into local editor state — the wizard does not
   * write the schedule directly. The user reviews and presses Save in the
   * parent editor to persist.
   */
  onApply: (config: {
    setPoints: Array<{ time: string, temperature: number }>
    bedtime: string
    wakeTime: string
  }) => void
}

type Step = 0 | 1 | 2 | 3

const STEP_LABELS = ['Describe', 'Review', 'Import', 'Preview']

export function AICurveWizard({ open, onClose, onApply }: AICurveWizardProps) {
  const [step, setStep] = useState<Step>(0)
  const [highestStep, setHighestStep] = useState<Step>(0)

  // Step 1: Describe
  const [preferences, setPreferences] = useState('')

  // Step 2: Review
  const [prompt, setPrompt] = useState('')
  const [copied, setCopied] = useState(false)

  // Step 3: Import
  const [jsonInput, setJsonInput] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)

  // Step 4: Preview
  const [curve, setCurve] = useState<GeneratedCurve | null>(null)
  const [editablePoints, setEditablePoints] = useState<Array<{ time: string, tempF: number }>>([])
  const [savedTemplates, setSavedTemplates] = useState<CurveTemplate[]>([])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setSavedTemplates(loadTemplates())
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setStep(0)
      setHighestStep(0)
      setPreferences('')
      setPrompt('')
      setCopied(false)
      setJsonInput('')
      setParseResult(null)
      setCurve(null)
      setEditablePoints([])
    }
  }, [open])

  useEffect(() => {
    if (!jsonInput.trim()) {
      setParseResult(null)
      return
    }
    const timer = setTimeout(() => {
      const result = parseAIResponse(jsonInput)
      setParseResult(result)
      if (result.success) {
        setCurve(result.curve)
        setEditablePoints(
          Object.entries(result.curve.points)
            .map(([time, tempF]) => ({ time, tempF }))
            .sort((a, b) => a.time.localeCompare(b.time)),
        )
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [jsonInput])
  /* eslint-enable react-hooks/set-state-in-effect */

  const goNext = useCallback(() => {
    if (step === 0) {
      const p = generatePrompt(preferences)
      setPrompt(p)
      const next: Step = 1
      setStep(next)
      setHighestStep(prev => Math.max(prev, next) as Step)
    }
    else if (step === 1) {
      const next: Step = 2
      setStep(next)
      setHighestStep(prev => Math.max(prev, next) as Step)
    }
    else if (step === 2 && parseResult?.success) {
      const next: Step = 3
      setStep(next)
      setHighestStep(prev => Math.max(prev, next) as Step)
    }
  }, [step, preferences, parseResult])

  const goBack = useCallback(() => {
    if (step > 0) setStep((step - 1) as Step)
  }, [step])

  const goToStep = useCallback((target: Step) => {
    if (target <= highestStep) setStep(target)
  }, [highestStep])

  const handleSkipToImport = useCallback(() => {
    setStep(2)
    setHighestStep(prev => Math.max(prev, 2) as Step)
  }, [])

  const handleCopy = useCallback(async () => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(prompt)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }
      catch { /* fall through */ }
    }
    const el = document.getElementById('ai-prompt-text')
    if (el) {
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [prompt])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: prompt })
      }
      catch { /* user cancelled */ }
    }
  }, [prompt])

  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const handlePaste = useCallback(async () => {
    if (navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText()
        setJsonInput(text)
      }
      catch { /* fall through */ }
    }
  }, [])

  const handleLoadTemplate = useCallback((template: CurveTemplate) => {
    setCurve(template)
    setEditablePoints(
      Object.entries(template.points)
        .map(([time, tempF]) => ({ time, tempF }))
        .sort((a, b) => a.time.localeCompare(b.time)),
    )
    setStep(3)
    setHighestStep(3)
  }, [])

  const handleDeleteTemplate = useCallback((name: string) => {
    deleteTemplate(name)
    setSavedTemplates(loadTemplates())
  }, [])

  const handleSaveTemplate = useCallback(() => {
    if (!curve) return
    const pointsObj: Record<string, number> = {}
    for (const p of editablePoints) pointsObj[p.time] = p.tempF
    const updated: GeneratedCurve = { ...curve, points: pointsObj }
    saveTemplate(updated)
    setSavedTemplates(loadTemplates())
  }, [curve, editablePoints])

  const updatePoint = useCallback((idx: number, field: 'time' | 'tempF', value: string | number) => {
    setEditablePoints((prev) => {
      const next = [...prev]
      if (field === 'time') next[idx] = { ...next[idx], time: value as string }
      else next[idx] = { ...next[idx], tempF: Math.max(55, Math.min(110, value as number)) }
      return next.sort((a, b) => a.time.localeCompare(b.time))
    })
  }, [])

  const addPoint = useCallback(() => {
    setEditablePoints((prev) => {
      const last = prev[prev.length - 1]
      const newTime = last ? incrementTime(last.time, 15) : '22:00'
      return [...prev, { time: newTime, tempF: 78 }].sort((a, b) => a.time.localeCompare(b.time))
    })
  }, [])

  const removePoint = useCallback((idx: number) => {
    setEditablePoints((prev) => {
      if (prev.length <= 3) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const handleApply = useCallback(() => {
    if (!curve || editablePoints.length < 3) return
    onApply({
      setPoints: editablePoints.map(p => ({ time: p.time, temperature: p.tempF })),
      bedtime: curve.bedtime,
      wakeTime: curve.wake,
    })
    onClose()
  }, [curve, editablePoints, onApply, onClose])

  const tempRange = useMemo(() => {
    if (editablePoints.length === 0) return { min: 55, max: 110 }
    const temps = editablePoints.map(p => p.tempF)
    return { min: Math.min(...temps), max: Math.max(...temps) }
  }, [editablePoints])

  const chartData = useMemo(() => {
    if (!curve || editablePoints.length < 2) return null
    const btMin = timeStringToMinutes(curve.bedtime)

    const withRelative = editablePoints.map((p) => {
      let tMin = timeStringToMinutes(p.time) - btMin
      if (tMin < -120) tMin += 24 * 60
      return { ...p, minutesFromBedtime: tMin }
    }).sort((a, b) => a.minutesFromBedtime - b.minutesFromBedtime)

    const total = withRelative.length
    const points: CurvePoint[] = withRelative.map((p, i) => {
      const frac = i / (total - 1)
      const phase = frac < 0.1
        ? 'warmUp' as const
        : frac < 0.25
          ? 'coolDown' as const
          : frac < 0.55
            ? 'deepSleep' as const
            : frac < 0.75
              ? 'maintain' as const
              : frac < 0.9
                ? 'preWake' as const
                : 'wake' as const
      return { minutesFromBedtime: p.minutesFromBedtime, tempOffset: p.tempF - 80, phase }
    })

    return { points, bedtimeMinutes: btMin }
  }, [curve, editablePoints])

  const canAdvance = step === 0
    ? preferences.trim().length > 0
    : step === 1
      ? true
      : step === 2
        ? parseResult?.success === true
        : editablePoints.length >= 3

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Custom AI Curve"
      leading={step > 0
        ? (
            <button type="button" onClick={goBack} className="-ml-1.5 flex items-center text-[17px] text-sky-400 active:opacity-50">
              <ChevronLeft size={24} strokeWidth={2.25} />
              Back
            </button>
          )
        : undefined}
      trailing={step < 3
        ? <SheetAction onClick={goNext} disabled={!canAdvance}>Next</SheetAction>
        : <SheetAction onClick={handleApply} disabled={!canAdvance}>Use</SheetAction>}
    >
      <div className="space-y-6">
        <nav aria-label="Steps" className="flex justify-between px-1">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(i as Step)}
              disabled={i > highestStep}
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'min-h-[32px] px-1 text-[13px] transition-colors',
                i === step ? 'font-semibold text-white' : i <= highestStep ? 'text-sky-400' : 'text-zinc-600',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        {step === 0 && (
          <StepDescribe
            preferences={preferences}
            onPreferencesChange={setPreferences}
            templates={savedTemplates}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onSkipToImport={handleSkipToImport}
          />
        )}
        {step === 1 && (
          <StepReview
            prompt={prompt}
            copied={copied}
            onCopy={handleCopy}
            canShare={canShare}
            onShare={handleShare}
          />
        )}
        {step === 2 && (
          <StepImport
            jsonInput={jsonInput}
            onJsonInputChange={setJsonInput}
            parseResult={parseResult}
            onPaste={handlePaste}
          />
        )}
        {step === 3 && curve && (
          <StepPreview
            curve={curve}
            editablePoints={editablePoints}
            tempRange={tempRange}
            chartData={chartData}
            onUpdatePoint={updatePoint}
            onAddPoint={addPoint}
            onRemovePoint={removePoint}
            onSaveTemplate={handleSaveTemplate}
            onApply={handleApply}
          />
        )}
      </div>
    </Sheet>
  )
}

const FIELD = 'block w-full rounded-xl bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 outline-none focus-visible:ring-2 focus-visible:ring-sky-500'

function StepDescribe({
  preferences,
  onPreferencesChange,
  templates,
  onLoadTemplate,
  onDeleteTemplate,
  onSkipToImport,
}: {
  preferences: string
  onPreferencesChange: (v: string) => void
  templates: CurveTemplate[]
  onLoadTemplate: (t: CurveTemplate) => void
  onDeleteTemplate: (name: string) => void
  onSkipToImport: () => void
}) {
  return (
    <>
      <ListSection footer="Describe how you sleep in your own words. You'll get a prompt to paste into ChatGPT, Claude or Gemini.">
        <textarea
          value={preferences}
          onChange={e => onPreferencesChange(e.target.value)}
          placeholder="I run hot, bed at 11pm, wake at 6:30. Really cold for the first few hours."
          rows={4}
          aria-label="Sleep preferences"
          className={cn(FIELD, 'resize-none text-[17px] leading-[22px]')}
        />
      </ListSection>

      <ListSection header="Examples">
        {EXAMPLE_SUGGESTIONS.map(suggestion => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPreferencesChange(suggestion)}
            className="block w-full px-4 py-2.5 text-left text-[15px] leading-5 text-zinc-300 active:bg-zinc-800"
          >
            {suggestion}
          </button>
        ))}
      </ListSection>

      <ListSection footer="Already have a JSON response from an AI? Skip straight to import.">
        <ListRow icon={ClipboardPaste} title="Import JSON" onClick={onSkipToImport} accessory={<ChevronRight size={18} className="shrink-0 text-zinc-600" />} />
      </ListSection>

      {templates.length > 0 && (
        <ListSection header="Saved curves">
          {templates.map(t => (
            <div key={t.name} className="flex min-h-[44px] items-center">
              <button
                type="button"
                onClick={() => onLoadTemplate(t)}
                className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 pl-4 text-left active:bg-zinc-800"
              >
                <span className="min-w-0 flex-1 truncate text-[17px] text-white">{t.name}</span>
                <span className="ios-numeric shrink-0 text-[15px] text-zinc-500">
                  {t.bedtime}
                  {' – '}
                  {t.wake}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteTemplate(t.name)}
                aria-label={`Delete ${t.name}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-zinc-500 active:text-white"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </ListSection>
      )}
    </>
  )
}

function StepReview({
  prompt,
  copied,
  onCopy,
  canShare,
  onShare,
}: {
  prompt: string
  copied: boolean
  onCopy: () => void
  canShare: boolean
  onShare: () => void
}) {
  return (
    <>
      <ListSection
        footer={canShare
          ? 'Share this prompt to ChatGPT, Claude or Gemini, then paste the JSON response in the next step.'
          : 'Copy this prompt into ChatGPT, Claude or Gemini, then paste the JSON response in the next step.'}
      >
        <div className="max-h-[40vh] overflow-y-auto px-4 py-3">
          <pre id="ai-prompt-text" className="select-all whitespace-pre-wrap font-sans text-[13px] leading-[18px] text-zinc-300">{prompt}</pre>
        </div>
      </ListSection>

      <ListSection>
        {canShare && <ListRow icon={Share2} title="Share Prompt" onClick={onShare} />}
        <ListRow
          icon={copied ? Check : Copy}
          title={copied ? 'Copied' : canShare ? 'Copy Prompt' : 'Select All'}
          onClick={onCopy}
        />
      </ListSection>
    </>
  )
}

function StepImport({
  jsonInput,
  onJsonInputChange,
  parseResult,
  onPaste,
}: {
  jsonInput: string
  onJsonInputChange: (v: string) => void
  parseResult: ParseResult | null
  onPaste: () => void
}) {
  return (
    <>
      <ListSection
        footer={parseResult
          ? parseResult.success
            ? (
                <span className="flex items-start gap-1.5 text-emerald-400">
                  <Check size={15} className="mt-px shrink-0" />
                  <span>
                    {parseResult.curve.name}
                    {': '}
                    {Object.keys(parseResult.curve.points).length}
                    {' set points, '}
                    {parseResult.curve.bedtime}
                    {' – '}
                    {parseResult.curve.wake}
                  </span>
                </span>
              )
            : (
                <span className="flex items-start gap-1.5 text-red-400">
                  <AlertTriangle size={15} className="mt-px shrink-0" />
                  <span>{parseResult.error}</span>
                </span>
              )
          : 'Paste the AI’s JSON response. It’s checked as you type.'}
      >
        <textarea
          value={jsonInput}
          onChange={e => onJsonInputChange(e.target.value)}
          placeholder='{"name": "...", "bedtime": "22:00", "wake": "07:00", "points": {...}}'
          rows={8}
          aria-label="AI response JSON"
          className={cn(FIELD, 'resize-none font-mono text-[13px] leading-[18px]')}
        />
      </ListSection>

      <ListSection>
        <ListRow icon={ClipboardPaste} title="Paste from Clipboard" onClick={onPaste} />
      </ListSection>
    </>
  )
}

function StepPreview({
  curve,
  editablePoints,
  tempRange,
  chartData,
  onUpdatePoint,
  onAddPoint,
  onRemovePoint,
  onSaveTemplate,
  onApply,
}: {
  curve: GeneratedCurve
  editablePoints: Array<{ time: string, tempF: number }>
  tempRange: { min: number, max: number }
  chartData: { points: CurvePoint[], bedtimeMinutes: number } | null
  onUpdatePoint: (idx: number, field: 'time' | 'tempF', value: string | number) => void
  onAddPoint: () => void
  onRemovePoint: (idx: number) => void
  onSaveTemplate: () => void
  onApply: () => void
}) {
  return (
    <>
      <div className="px-1">
        <h3 className="text-[22px] font-bold leading-7 text-white">{curve.name}</h3>
        <p className="ios-numeric text-[15px] text-zinc-500">
          {curve.bedtime}
          {' – '}
          {curve.wake}
        </p>
      </div>

      {chartData && (
        <ListSection footer={curve.reasoning || undefined}>
          <div className="space-y-2 pb-3 pl-1 pr-2 pt-3">
            <CurveChart
              points={chartData.points}
              bedtimeMinutes={chartData.bedtimeMinutes}
              minTempF={tempRange.min}
              maxTempF={tempRange.max}
            />
            <PhaseLegend />
          </div>
        </ListSection>
      )}

      <ListSection header={`Set points (${editablePoints.length})`} footer="A curve needs at least three set points.">
        {editablePoints.map((point, idx) => (
          <div key={`${point.time}-${idx}`} className="flex min-h-[44px] items-center gap-2 py-1.5 pl-4 pr-1">
            <input
              type="time"
              value={point.time}
              onChange={e => onUpdatePoint(idx, 'time', e.target.value)}
              aria-label={`Set point ${idx + 1} time`}
              className="ios-numeric h-[34px] min-w-0 rounded-lg bg-zinc-800 px-2 text-[15px] text-white outline-none [color-scheme:dark]"
            />
            <span className="ios-numeric min-w-[44px] flex-1 text-right text-[17px]" style={{ color: tempTint(point.tempF) }}>
              {point.tempF}
              °
            </span>
            <Stepper
              label={`set point ${idx + 1} temperature`}
              onDecrement={() => onUpdatePoint(idx, 'tempF', point.tempF - 1)}
              onIncrement={() => onUpdatePoint(idx, 'tempF', point.tempF + 1)}
              decrementDisabled={point.tempF <= 55}
              incrementDisabled={point.tempF >= 110}
            />
            <button
              type="button"
              onClick={() => onRemovePoint(idx)}
              disabled={editablePoints.length <= 3}
              aria-label={`Remove set point ${idx + 1}`}
              className="flex h-11 w-9 shrink-0 items-center justify-center text-zinc-500 active:text-white disabled:text-zinc-700"
            >
              <X size={18} />
            </button>
          </div>
        ))}
        <AddRow onClick={onAddPoint}>Add Set Point</AddRow>
      </ListSection>

      <ListSection>
        <ListRow icon={Save} title="Save as Template" onClick={onSaveTemplate} />
      </ListSection>

      <button
        type="button"
        onClick={onApply}
        disabled={editablePoints.length < 3}
        className="h-[50px] w-full rounded-xl bg-sky-500 text-[17px] font-semibold text-white active:bg-sky-600 disabled:opacity-40"
      >
        Use Curve
      </button>
    </>
  )
}

function incrementTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
