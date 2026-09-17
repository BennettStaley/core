'use client'

import { trpc } from '@/src/utils/trpc'
import { Archive, Calendar, GitBranch, GitCommit, HardDrive, Loader2 } from 'lucide-react'

/**
 * SystemInfoCard — firmware/build version + per-mount storage breakdown.
 *
 * Storage sections (Pod 5 layout — Pod 4 falls back gracefully when a mount
 * is absent):
 *   - eMMC                  → /persistent
 *   - Biometrics tmpfs      → /persistent/biometrics (live RAW workspace)
 *   - Biometrics archive    → /persistent/biometrics-archive (gzipped)
 *
 * DB size is intentionally omitted — it lives on eMMC and is rolled into that
 * section's total.
 */
export function SystemInfoCard() {
  const version = trpc.system.getVersion.useQuery({})
  const storage = trpc.system.getStorageBreakdown.useQuery({}, { refetchInterval: 30_000 })

  const isLoading = version.isLoading || storage.isLoading
  const versionData = version.data
  const storageData = storage.data

  return (
    <section className="space-y-1.5">
      <h2 className="px-4 text-[13px] leading-[18px] text-zinc-500">System info</h2>
      <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
        {isLoading
          ? (
              <div className="flex min-h-[44px] items-center gap-3 px-4">
                <Loader2 size={18} className="animate-spin text-zinc-500" />
                <span className="text-[15px] text-zinc-500">Loading system info…</span>
              </div>
            )
          : (
              <>
                {versionData && (
                  <>
                    <InfoRow
                      icon={<GitBranch size={18} />}
                      label="Branch"
                      value={versionData.branch}
                    />
                    <InfoRow
                      icon={<GitCommit size={18} />}
                      label="Commit"
                      value={versionData.commitHash !== 'unknown' ? versionData.commitHash.slice(0, 7) : 'unknown'}
                      subValue={versionData.commitTitle !== 'unknown' ? versionData.commitTitle : undefined}
                    />
                    <InfoRow
                      icon={<Calendar size={18} />}
                      label="Build date"
                      value={versionData.buildDate !== 'unknown' ? formatBuildDate(versionData.buildDate) : 'unknown'}
                    />
                  </>
                )}

                {storageData && storageData.emmc.totalBytes > 0 && (
                  <DiskSection
                    label="eMMC"
                    sublabel="/persistent"
                    totalBytes={storageData.emmc.totalBytes}
                    usedBytes={storageData.emmc.usedBytes}
                    availableBytes={storageData.emmc.availableBytes}
                    usedPercent={storageData.emmc.usedPercent}
                  />
                )}
                {storageData && storageData.biometricsTmpfs.totalBytes > 0 && (
                  <DiskSection
                    label="Biometrics tmpfs"
                    sublabel="/persistent/biometrics"
                    totalBytes={storageData.biometricsTmpfs.totalBytes}
                    usedBytes={storageData.biometricsTmpfs.usedBytes}
                    availableBytes={storageData.biometricsTmpfs.availableBytes}
                    usedPercent={storageData.biometricsTmpfs.usedPercent}
                  />
                )}
                {storageData && storageData.biometricsArchive.usedBytes > 0 && (
                  <ArchiveSection
                    usedBytes={storageData.biometricsArchive.usedBytes}
                    fileCount={storageData.biometricsArchive.fileCount}
                  />
                )}
              </>
            )}
      </div>
    </section>
  )
}

function DiskSection({
  label,
  sublabel,
  totalBytes,
  usedBytes,
  availableBytes,
  usedPercent,
}: {
  label: string
  sublabel: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usedPercent: number
}) {
  const barColor
    = usedPercent >= 90
      ? 'bg-red-500'
      : usedPercent >= 75
        ? 'bg-amber-500'
        : 'bg-sky-500'

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <HardDrive size={18} className="mt-0.5 shrink-0 text-zinc-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] leading-[22px] text-white">{label}</span>
          <span className="ios-numeric shrink-0 text-[15px] text-zinc-500">
            {formatBytes(usedBytes)}
            {' of '}
            {formatBytes(totalBytes)}
          </span>
        </div>
        <p className="truncate font-mono text-[12px] leading-[18px] text-zinc-600">{sublabel}</p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(usedPercent, 100)}%` }}
          />
        </div>
        <div className="ios-numeric mt-1 flex justify-between text-[13px] text-zinc-500">
          <span>
            {usedPercent.toFixed(1)}
            % used
          </span>
          <span>
            {formatBytes(availableBytes)}
            {' free'}
          </span>
        </div>
      </div>
    </div>
  )
}

function ArchiveSection({ usedBytes, fileCount }: { usedBytes: number, fileCount: number }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Archive size={18} className="mt-0.5 shrink-0 text-zinc-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] leading-[22px] text-white">Biometrics archive</span>
          <span className="ios-numeric shrink-0 text-[15px] text-zinc-500">{formatBytes(usedBytes)}</span>
        </div>
        <p className="truncate font-mono text-[12px] leading-[18px] text-zinc-600">/persistent/biometrics-archive</p>
        <p className="text-[13px] text-zinc-500">
          {fileCount}
          {' '}
          gzipped session
          {fileCount === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
}) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-zinc-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 text-[17px] leading-[22px] text-white">{label}</span>
          <span className="ios-numeric truncate text-[17px] text-zinc-500">{value}</span>
        </div>
        {subValue && (
          <p className="truncate text-[13px] leading-[18px] text-zinc-500">{subValue}</p>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

function formatBuildDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  catch {
    return dateStr
  }
}
