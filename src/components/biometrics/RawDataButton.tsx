'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronRight, Download, HardDrive, Loader2, Package, Trash2 } from 'lucide-react'
import { ListRow, ListSection, Sheet } from '@/src/ui/ios'
import { trpc } from '@/src/utils/trpc'
import { useSide } from '@/src/hooks/useSide'
import { useWeekNavigator } from '@/src/hooks/useWeekNavigator'

function formatCSVDate(date: Date): string {
  return new Date(date).toISOString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateVitalsCSV(vitals: any[]): string {
  const header = 'timestamp,heart_rate,hrv,breathing_rate,side'
  const rows = vitals.map(v =>
    `${formatCSVDate(v.timestamp)},${v.heartRate ?? ''},${v.hrv ?? ''},${v.breathingRate ?? ''},${v.side}`
  )
  return [header, ...rows].join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateSleepCSV(records: any[]): string {
  const header = 'entered_bed_at,left_bed_at,duration_seconds,times_exited_bed,side'
  const rows = records.map(r =>
    `${formatCSVDate(r.enteredBedAt)},${formatCSVDate(r.leftBedAt)},${r.sleepDurationSeconds},${r.timesExitedBed},${r.side}`
  )
  return [header, ...rows].join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateMovementCSV(movement: any[]): string {
  const header = 'timestamp,total_movement,side'
  const rows = movement.map(m =>
    `${formatCSVDate(m.timestamp)},${m.totalMovement},${m.side}`
  )
  return [header, ...rows].join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // The anchor must be in the document and the object URL must outlive the
  // click: iOS Safari starts the download asynchronously, so revoking the URL
  // synchronously (or clicking a detached node) aborts it and leaves a blank
  // blob page instead of saving the file.
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 1000)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * "Export raw data" list row + sheet matching iOS RawDataSheet.
 * Self-contained: fetches data from tRPC for the current week/side.
 * Allows CSV export of vitals, sleep, and movement data.
 * Also wires into the raw tRPC router for RAW file management (list, download, delete)
 * and disk usage monitoring.
 */
export function RawDataButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const { side } = useSide()
  const { weekStart, weekEnd } = useWeekNavigator()
  const utils = trpc.useUtils()

  // Only fetch when sheet is open to avoid unnecessary queries
  const vitalsQuery = trpc.biometrics.getVitals.useQuery(
    { side, startDate: weekStart, endDate: weekEnd, limit: 10000 },
    { enabled: isOpen }
  )
  const sleepQuery = trpc.biometrics.getSleepRecords.useQuery(
    { side, startDate: weekStart, endDate: weekEnd, limit: 30 },
    { enabled: isOpen }
  )
  const movementQuery = trpc.biometrics.getMovement.useQuery(
    { side, startDate: weekStart, endDate: weekEnd, limit: 1000 },
    { enabled: isOpen }
  )

  // Raw file management — wired to raw tRPC router
  const fileCountQuery = trpc.biometrics.getFileCount.useQuery(
    {},
    { enabled: isOpen }
  )
  const diskUsageQuery = trpc.raw.diskUsage.useQuery(
    {},
    { enabled: isOpen }
  )
  const rawFilesQuery = trpc.raw.files.useQuery(
    {},
    { enabled: isOpen && showFiles }
  )

  const deleteFileMutation = trpc.raw.deleteFile.useMutation({
    onSuccess: () => {
      // Invalidate both file queries after deletion
      utils.raw.files.invalidate()
      utils.raw.diskUsage.invalidate()
      utils.biometrics.getFileCount.invalidate()
      setDeletingFile(null)
    },
    onError: () => {
      setDeletingFile(null)
    },
  })

  const vitals = useMemo(() => vitalsQuery.data ?? [], [vitalsQuery.data])
  const sleepRecords = useMemo(() => sleepQuery.data ?? [], [sleepQuery.data])
  const movement = useMemo(() => movementQuery.data ?? [], [movementQuery.data])
  const fileCount = fileCountQuery.data
  const diskUsage = diskUsageQuery.data

  const rawFiles = (rawFilesQuery.data ?? []) as Array<{ name: string, sizeBytes: number, modifiedAt: string }>

  const exportVitals = useCallback(() => {
    downloadCSV(generateVitalsCSV(vitals), `vitals-${side}.csv`)
  }, [vitals, side])

  const exportSleep = useCallback(() => {
    downloadCSV(generateSleepCSV(sleepRecords), `sleep-${side}.csv`)
  }, [sleepRecords, side])

  const exportMovement = useCallback(() => {
    downloadCSV(generateMovementCSV(movement), `movement-${side}.csv`)
  }, [movement, side])

  const exportAll = useCallback(() => {
    const dateStr = new Date().toISOString().slice(0, 10)
    const combined = [
      '# Sleepypod Raw Data Export',
      `# Side: ${side}`,
      `# Date: ${new Date().toISOString()}`,
      '',
      '## Vitals',
      generateVitalsCSV(vitals),
      '',
      '## Sleep',
      generateSleepCSV(sleepRecords),
      '',
      '## Movement',
      generateMovementCSV(movement),
    ].join('\n')
    downloadCSV(combined, `sleepypod-${side}-${dateStr}.csv`)
  }, [side, vitals, sleepRecords, movement])

  const handleDeleteFile = useCallback((filename: string) => {
    setDeletingFile(filename)
    deleteFileMutation.mutate({ filename })
  }, [deleteFileMutation])

  const handleDownloadRawFile = useCallback((filename: string) => {
    // Use the Next.js API route for secure raw file download
    const link = document.createElement('a')
    link.href = `/api/raw/${encodeURIComponent(filename)}`
    link.download = filename
    link.click()
  }, [])

  const exportArchive = useCallback(() => {
    const startTs = Math.floor(weekStart.getTime() / 1000)
    const endTs = Math.floor(weekEnd.getTime() / 1000)
    const link = document.createElement('a')
    link.href = `/api/export/archive?startTs=${startTs}&endTs=${endTs}&include=raw,db`
    link.click()
  }, [weekStart, weekEnd])

  const close = () => {
    setIsOpen(false)
    setShowFiles(false)
  }

  const csvRows = [
    { name: `vitals-${side}.csv`, count: vitals.length, onClick: exportVitals },
    { name: `sleep-${side}.csv`, count: sleepRecords.length, onClick: exportSleep },
    { name: `movement-${side}.csv`, count: movement.length, onClick: exportMovement },
  ]

  return (
    <>
      <ListSection>
        <ListRow
          title="Export raw data"
          icon={Download}
          onClick={() => setIsOpen(true)}
          accessory={<ChevronRight size={18} className="text-zinc-600" />}
        />
      </ListSection>

      <Sheet
        open={isOpen}
        onClose={close}
        title="Raw data"
        leading={<span />}
        trailing={(
          <button type="button" onClick={close} className="text-[17px] font-semibold text-sky-400 active:opacity-50">
            Done
          </button>
        )}
      >
        <div className="space-y-6">
          <ListSection header="This week">
            <ListRow title="Side" value={side === 'left' ? 'Left' : 'Right'} />
            <ListRow title="Vitals records" value={vitals.length} />
            <ListRow title="Sleep sessions" value={sleepRecords.length} />
            <ListRow title="Movement records" value={movement.length} />
          </ListSection>

          {(fileCount || diskUsage) && (
            <ListSection header="Storage">
              {fileCount && <ListRow title="Raw files, left" value={fileCount.rawFiles.left} />}
              {fileCount && <ListRow title="Raw files, right" value={fileCount.rawFiles.right} />}
              {fileCount && <ListRow title="Total size" value={`${fileCount.totalSizeMB} MB`} />}
              {diskUsage && diskUsage.availableBytes > 0 && (
                <ListRow title="Disk available" value={formatBytes(diskUsage.availableBytes)} />
              )}
            </ListSection>
          )}

          <ListSection header="CSV" footer="CSV files open in Numbers or Excel, or can be imported into Python or R.">
            {csvRows.map(row => (
              <ListRow
                key={row.name}
                title={row.name}
                subtitle={`${row.count} rows`}
                onClick={row.onClick}
                disabled={row.count === 0}
                accessory={<Download size={20} className="text-sky-400" />}
              />
            ))}
          </ListSection>

          <button
            type="button"
            onClick={exportAll}
            disabled={vitals.length === 0 && sleepRecords.length === 0 && movement.length === 0}
            className="h-[50px] w-full rounded-xl bg-sky-500 text-[17px] font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            Export all as CSV
          </button>

          <ListSection footer="RAW waveforms plus a copy of biometrics.db for this week. Untar and open biometrics.db with any SQLite client.">
            <ListRow
              title="Export archive (.tar.gz)"
              icon={Package}
              onClick={exportArchive}
              accessory={<Download size={20} className="text-sky-400" />}
            />
          </ListSection>

          <ListSection header="Sensor data files" footer={deleteFileMutation.isError ? (deleteFileMutation.error?.message ?? 'Delete failed') : undefined}>
            <ListRow
              title={showFiles ? 'Hide files' : 'Show files'}
              icon={HardDrive}
              value={diskUsage ? `${diskUsage.rawFileCount} files` : '…'}
              onClick={() => setShowFiles(!showFiles)}
            />
            {showFiles && rawFilesQuery.isLoading && <ListRow title="Loading files…" />}
            {showFiles && rawFilesQuery.isError && <ListRow title="Couldn’t load files" destructive />}
            {showFiles && rawFiles.length === 0 && !rawFilesQuery.isLoading && !rawFilesQuery.isError && (
              <ListRow title="No RAW files found" />
            )}
            {showFiles && rawFiles.map((file, idx) => (
              <div key={file.name} className="flex min-h-[44px] items-center gap-1 pl-4 pr-1">
                <div className="min-w-0 flex-1 py-2">
                  <p className="truncate font-mono text-[15px] text-white">{file.name}</p>
                  <p className="ios-numeric text-[13px] leading-[18px] text-zinc-500">
                    {`${formatBytes(file.sizeBytes)} · ${formatDate(file.modifiedAt)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadRawFile(file.name)}
                  className="flex h-11 w-11 items-center justify-center text-sky-400 active:opacity-50"
                  aria-label={`Download ${file.name}`}
                >
                  <Download size={20} />
                </button>
                {/* Delete disabled for the active (newest, idx===0) file */}
                <button
                  type="button"
                  onClick={() => handleDeleteFile(file.name)}
                  disabled={idx === 0 || deletingFile === file.name}
                  className="flex h-11 w-11 items-center justify-center text-red-400 active:opacity-50 disabled:opacity-30"
                  aria-label={idx === 0 ? 'Cannot delete active file' : `Delete ${file.name}`}
                >
                  {deletingFile === file.name
                    ? <Loader2 size={20} className="animate-spin text-zinc-500" />
                    : <Trash2 size={20} />}
                </button>
              </div>
            ))}
          </ListSection>
        </div>
      </Sheet>
    </>
  )
}
