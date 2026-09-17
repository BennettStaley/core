'use client'

import { useEffect, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Left bar button; defaults to "Cancel" that closes the sheet. */
  leading?: ReactNode
  /** Right bar button, e.g. a bold "Done"/"Save". */
  trailing?: ReactNode
  children: ReactNode
}

/**
 * iOS page sheet: slides up from the bottom over a dimmed backdrop, with a
 * grabber, an inline navigation bar, and a scrollable body that respects the
 * home-indicator safe area.
 */
export function Sheet({ open, onClose, title, leading, trailing, children }: SheetProps) {
  // Lock page scroll while the sheet is open so the body doesn't move underneath.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" />
      <div
        className="relative flex max-h-[92dvh] flex-col rounded-t-[10px] bg-zinc-950 animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto mt-1.5 h-[5px] w-9 rounded-full bg-zinc-700" />
        <div className="grid min-h-[44px] grid-cols-[1fr_auto_1fr] items-center px-4">
          <div className="justify-self-start">
            {leading ?? (
              <button type="button" onClick={onClose} className="text-[17px] text-sky-400 active:opacity-50">Cancel</button>
            )}
          </div>
          <div className="truncate text-[17px] font-semibold text-white">{title}</div>
          <div className="justify-self-end">{trailing}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">{children}</div>
      </div>
    </div>
  )
}
