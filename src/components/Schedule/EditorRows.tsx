'use client'

import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'

interface StepperProps {
  label: string
  onDecrement: () => void
  onIncrement: () => void
  decrementDisabled?: boolean
  incrementDisabled?: boolean
}

/** UIStepper: a 94×32 grey capsule split into − and + halves. */
export function Stepper({ label, onDecrement, onIncrement, decrementDisabled, incrementDisabled }: StepperProps) {
  return (
    <div className="flex h-8 w-[94px] shrink-0 items-center overflow-hidden rounded-lg bg-zinc-800">
      <button
        type="button"
        onClick={onDecrement}
        disabled={decrementDisabled}
        aria-label={`Decrease ${label}`}
        className="flex h-full flex-1 items-center justify-center text-white active:bg-zinc-700 disabled:text-zinc-600"
      >
        <Minus size={18} strokeWidth={2.25} />
      </button>
      <span className="h-[18px] w-px bg-zinc-600" />
      <button
        type="button"
        onClick={onIncrement}
        disabled={incrementDisabled}
        aria-label={`Increase ${label}`}
        className="flex h-full flex-1 items-center justify-center text-white active:bg-zinc-700 disabled:text-zinc-600"
      >
        <Plus size={18} strokeWidth={2.25} />
      </button>
    </div>
  )
}

interface StepperRowProps extends StepperProps {
  value: ReactNode
}

/** Grouped-list row: title, value, and a trailing stepper. */
export function StepperRow({ value, ...stepper }: StepperRowProps) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 px-4 py-1.5">
      <span className="min-w-0 flex-1 truncate text-[17px] text-white">{stepper.label}</span>
      <span className="ios-numeric shrink-0 text-[17px] text-zinc-500">{value}</span>
      <Stepper {...stepper} />
    </div>
  )
}

/** Centered destructive action row ("Delete Curve"), the last group in an editor. */
export function DestructiveRow({ children, onClick, disabled }: { children: ReactNode, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[44px] w-full items-center justify-center px-4 text-[17px] text-red-400 active:bg-zinc-800 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/** Accent-coloured "+ Add …" row at the bottom of a grouped list. */
export function AddRow({ children, onClick, disabled }: { children: ReactNode, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-[17px] text-sky-400 active:bg-zinc-800 disabled:opacity-40"
    >
      <Plus size={20} strokeWidth={2.25} className="shrink-0" />
      {children}
    </button>
  )
}

/** Bold right bar button for a Sheet ("Save", "Done"). */
export function SheetAction({ children, onClick, disabled }: { children: ReactNode, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[17px] font-semibold text-sky-400 active:opacity-50 disabled:text-zinc-600"
    >
      {children}
    </button>
  )
}
