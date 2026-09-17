'use client'

import { useEffect, useRef, useState } from 'react'
import { trpc } from '@/src/utils/trpc'
import { Download, Globe, Loader2, RefreshCw } from 'lucide-react'

/**
 * UpdateCard — shows current version and provides a trigger to update the pod software.
 *
 * Wires into:
 * - system.getVersion → shows running version/branch
 * - system.triggerUpdate → kicks off sp-update (service will restart)
 * - system.internetStatus → checks if WAN is blocked
 * - system.setInternetAccess → temporarily unblocks WAN for updates
 *
 * After triggering an update the service restarts, so the UI shows a
 * "reconnecting" state and polls until the server comes back.
 *
 * If internet is blocked when the user initiates an update, the card
 * prompts to temporarily allow internet. After the update completes
 * (or fails), internet is re-blocked automatically.
 */
export function UpdateCard() {
  const utils = trpc.useUtils()
  const version = trpc.system.getVersion.useQuery({})
  const triggerUpdate = trpc.system.triggerUpdate.useMutation()
  const setInternetAccess = trpc.system.setInternetAccess.useMutation()

  const [updateState, setUpdateState] = useState<
    'idle' | 'confirming' | 'branch-picker' | 'internet-prompt' | 'unblocking' | 'updating' | 'reconnecting' | 'error'
  >('idle')
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  /** Tracks whether we temporarily unblocked internet and need to re-block */
  const didUnblockRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)
  /**
   * Version snapshot captured right before sp-update runs. Polling uses
   * this to distinguish "service is still the old build" from "service
   * restarted on the new build" — without it, the first poll racily
   * succeeds against the still-running old service and the UI re-blocks
   * WAN mid-download, killing the in-progress update.
   */
  const baselineVersionRef = useRef<{ commitHash: string, buildDate: string } | null>(null)
  /** Set to true once a poll fails — proves the service actually went down. */
  const sawDownRef = useRef(false)

  // Clean up poll timer on unmount and re-block internet if needed
  useEffect(() => {
    return () => {
      cancelledRef.current = true
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
      // Fire-and-forget re-block if we unblocked internet and the user navigates away
      if (didUnblockRef.current) {
        didUnblockRef.current = false
        setInternetAccess.mutate({ blocked: true })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup-only ref, stable mutation object
  }, [])

  const versionData = version.data
  const isStandardBranch = versionData?.branch === 'main' || versionData?.branch === 'dev'

  /**
   * Re-block internet if we temporarily unblocked it.
   * Called after update completes, fails, or is cancelled.
   */
  const reblockIfNeeded = async () => {
    if (!didUnblockRef.current) return
    didUnblockRef.current = false
    try {
      await setInternetAccess.mutateAsync({ blocked: true })
      utils.system.internetStatus.invalidate()
    }
    catch {
      // Best effort — don't let re-block failure obscure the update result
    }
  }

  const handleUpdate = async () => {
    if (updateState === 'idle') {
      // No version data yet — do nothing
      if (!versionData) return
      // Non-standard branch → let user pick main or dev first
      if (!isStandardBranch) {
        setUpdateState('branch-picker')
        return
      }
      setUpdateState('confirming')
      return
    }

    if (updateState === 'confirming') {
      setErrorMessage(null)

      // Check if internet is blocked before proceeding
      try {
        const status = await utils.system.internetStatus.fetch({})
        if (status.blocked) {
          setUpdateState('internet-prompt')
          return
        }
      }
      catch {
        // If we can't check, proceed anyway — the update script handles its own connectivity
      }

      await startUpdate()
    }
  }

  const handleBranchSelected = (branch: string) => {
    setSelectedBranch(branch)
    setUpdateState('confirming')
  }

  /** Unblock internet then proceed with the update */
  const handleAllowInternet = async () => {
    setUpdateState('unblocking')
    setErrorMessage(null)

    try {
      await setInternetAccess.mutateAsync({ blocked: false })
      didUnblockRef.current = true
      utils.system.internetStatus.invalidate()
      await startUpdate()
    }
    catch {
      setUpdateState('error')
      setErrorMessage('Failed to enable internet access. Try again or enable internet manually.')
    }
  }

  /** Trigger the actual update */
  const startUpdate = async () => {
    setUpdateState('updating')

    const branch = selectedBranch
      ?? (versionData?.branch !== 'unknown' ? versionData?.branch : undefined)

    // Snapshot the current build so polling can tell when sp-update has
    // actually restarted the service on the new code (vs. the old service
    // still serving the API mid-download).
    baselineVersionRef.current = versionData
      ? { commitHash: versionData.commitHash, buildDate: versionData.buildDate }
      : null
    sawDownRef.current = false

    try {
      await triggerUpdate.mutateAsync({ branch })
      setUpdateState('reconnecting')
      pollForReconnection()
    }
    catch {
      // If the request fails immediately it might be because the service
      // already restarted (which is actually success)
      setUpdateState('reconnecting')
      pollForReconnection()
    }
  }

  const pollForReconnection = () => {
    let attempts = 0
    const maxAttempts = 90 // ~3 minutes at 2s intervals — sp-update can stay up for a while before stopping the service

    const check = async () => {
      if (cancelledRef.current) return
      attempts++
      try {
        // Use the direct fetch path so a network/server error throws
        // cleanly — useQuery.refetch() resolves on error and would make
        // the down-detection below silently false.
        const next = await utils.system.getVersion.fetch({})

        const baseline = baselineVersionRef.current
        const versionChanged = baseline !== null
          && (next.commitHash !== baseline.commitHash || next.buildDate !== baseline.buildDate)

        // Only call this "done" once we've proven the service actually
        // bounced. Otherwise we're talking to the old next-server still
        // serving the pre-update build — re-blocking WAN here kills
        // sp-update's still-pending tarball download.
        if (versionChanged || sawDownRef.current) {
          // Keep the React-Query cache in sync with what we just fetched
          // so other consumers re-render with the new version.
          utils.system.getVersion.setData({}, next)
          await reblockIfNeeded()
          setUpdateState('idle')
          return
        }

        // Old service is still up; sp-update hasn't reached `systemctl
        // stop` yet. Keep polling without unblocking guarantees.
        if (attempts < maxAttempts && !cancelledRef.current) {
          pollTimerRef.current = setTimeout(check, 2000)
        }
        else if (!cancelledRef.current) {
          await reblockIfNeeded()
          setUpdateState('error')
          setErrorMessage('Service did not restart on a new build. Check pod manually.')
        }
      }
      catch {
        sawDownRef.current = true
        if (attempts < maxAttempts && !cancelledRef.current) {
          pollTimerRef.current = setTimeout(check, 2000)
        }
        else if (!cancelledRef.current) {
          await reblockIfNeeded()
          setUpdateState('error')
          setErrorMessage('Service did not come back after update. Check pod manually.')
        }
      }
    }

    // Wait a few seconds before first poll to give the service time to stop
    pollTimerRef.current = setTimeout(check, 5000)
  }

  const handleCancel = () => {
    setUpdateState('idle')
    setSelectedBranch(undefined)
    setErrorMessage(null)
  }

  const busy = updateState === 'unblocking' || updateState === 'updating' || updateState === 'reconnecting'
  const busyLabel = updateState === 'unblocking'
    ? 'Enabling internet access…'
    : updateState === 'updating'
      ? 'Triggering update…'
      : 'Waiting for service to restart…'

  const footer = errorMessage
    ? <span className="text-red-400">{errorMessage}</span>
    : updateState === 'branch-picker'
      ? `Current branch (${versionData?.branch}) is not a release channel. Pick a channel to update to.`
      : updateState === 'confirming'
        ? (selectedBranch
            ? `This will switch to ${selectedBranch}, rebuild, and restart the service. The pod will be briefly unavailable.`
            : 'This will download the latest code, rebuild, and restart the service. The pod will be briefly unavailable.')
        : updateState === 'internet-prompt'
          ? 'Internet is currently blocked. It will be allowed temporarily and re-blocked automatically after the update completes.'
          : null

  return (
    <section className="space-y-1.5">
      <h2 className="px-4 text-[13px] leading-[18px] text-zinc-500">
        {updateState === 'error' ? 'Software · update failed' : 'Software'}
      </h2>
      <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
        {version.isLoading && (
          <div className="flex min-h-[44px] items-center gap-3 px-4">
            <Loader2 size={18} className="animate-spin text-zinc-500" />
            <span className="text-[15px] text-zinc-500">Loading version…</span>
          </div>
        )}

        {versionData && (
          <>
            <ValueRow label="Version" value={versionData.commitHash !== 'unknown' ? versionData.commitHash.slice(0, 7) : '—'} />
            <ValueRow label="Branch" value={versionData.branch !== 'unknown' ? versionData.branch : '—'} />
          </>
        )}

        {/* Branch picker for non-standard branches */}
        {updateState === 'branch-picker' && (
          <>
            <ActionRow onClick={() => handleBranchSelected('main')}>Update to main</ActionRow>
            <ActionRow onClick={() => handleBranchSelected('dev')}>Update to dev</ActionRow>
            <ActionRow onClick={handleCancel} muted>Cancel</ActionRow>
          </>
        )}

        {/* Primary actions */}
        {updateState === 'internet-prompt' && (
          <>
            <ActionRow onClick={handleAllowInternet} icon={<Globe size={18} />}>Allow &amp; update</ActionRow>
            <ActionRow onClick={handleCancel} muted>Cancel</ActionRow>
          </>
        )}

        {(updateState === 'idle' || updateState === 'confirming' || updateState === 'error') && (
          <ActionRow
            onClick={handleUpdate}
            disabled={version.isLoading}
            icon={updateState === 'confirming' ? <Download size={18} /> : <RefreshCw size={18} />}
            bold={updateState === 'confirming'}
          >
            {updateState === 'confirming'
              ? 'Confirm update'
              : updateState === 'error'
                ? 'Retry update'
                : 'Check for updates'}
          </ActionRow>
        )}
        {updateState === 'confirming' && (
          <ActionRow onClick={handleCancel} muted>Cancel</ActionRow>
        )}

        {/* Unblocking/updating/reconnecting state */}
        {busy && (
          <div className="flex min-h-[44px] items-center gap-3 px-4">
            <Loader2 size={18} className="animate-spin text-sky-400" />
            <span className="text-[17px] text-zinc-500">{busyLabel}</span>
          </div>
        )}
      </div>
      {footer && (
        <p className="px-4 text-[13px] leading-[18px] text-zinc-500">
          {footer}
        </p>
      )}
    </section>
  )
}

function ValueRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 px-4">
      <span className="text-[17px] text-white">{label}</span>
      <span className="ios-numeric truncate text-[17px] text-zinc-500">{value}</span>
    </div>
  )
}

function ActionRow({
  children,
  onClick,
  disabled,
  icon,
  muted,
  bold,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  icon?: React.ReactNode
  muted?: boolean
  bold?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-[17px] active:bg-zinc-800 disabled:opacity-40 ${
        muted ? 'text-zinc-500' : 'text-sky-400'
      } ${bold ? 'font-semibold' : ''}`}
    >
      {icon}
      {children}
    </button>
  )
}
