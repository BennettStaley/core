'use client'

import clsx from 'clsx'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  /** Disables the confirm button while the action is in flight. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * iOS alert (UIAlertController .alert): centered 270pt card, bold title,
 * footnote message and a hairline-separated button row. Used for destructive
 * actions like deleting a curve.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 animate-in fade-in duration-150" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="w-[270px] overflow-hidden rounded-[14px] bg-zinc-800">
        <div className="px-4 pb-4 pt-5 text-center">
          <h3 id="confirm-dialog-title" className="text-[17px] font-semibold leading-[22px] text-white">{title}</h3>
          <p className="mt-1 text-[13px] leading-[18px] text-zinc-300">{message}</p>
        </div>
        <div className="grid grid-cols-2 border-t border-zinc-700">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] border-r border-zinc-700 text-[17px] text-sky-400 active:bg-zinc-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={clsx(
              'min-h-[44px] text-[17px] font-semibold active:bg-zinc-700 disabled:opacity-40',
              variant === 'danger' ? 'text-red-400' : 'text-sky-400',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
