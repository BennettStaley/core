'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { trpc } from '@/src/utils/trpc'
import { ListRow, ListSection } from '@/src/ui/ios'
import { ActionRow, PrimaryButton, SwitchRow, TextRow } from './SettingsRows'

type Source = 'db' | 'env' | 'default'

interface MqttSettings {
  enabled: boolean
  url: string | null
  username: string | null
  passwordIsSet: boolean
  topicPrefix: string
  haDiscovery: boolean
  tlsEnabled: boolean
  sources: Record<'enabled' | 'url' | 'username' | 'password' | 'topicPrefix' | 'haDiscovery' | 'tlsEnabled', Source>
}

function sourceLabel(s: Source): string | null {
  if (s === 'env') return 'From .env'
  if (s === 'default') return 'Default'
  return null
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 1000) return 'just now'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

/**
 * MQTT bridge settings: connection, auth, topic prefix, HA discovery, TLS.
 *
 * Contract shape: see sleepypod-core-26 epic. The mqtt.* tRPC router lands
 * with sleepypod-core-27; until then tsc fails on `trpc.mqtt`.
 */
export function MqttSettingsForm() {
  const utils = trpc.useUtils()
  const settingsQuery = trpc.mqtt.getSettings.useQuery({})
  const statusQuery = trpc.mqtt.getStatus.useQuery({}, {
    refetchInterval: 5000,
  })

  const data = settingsQuery.data

  return (
    <>
      <ConnectionStatusSection
        connected={statusQuery.data?.connected ?? false}
        lastError={statusQuery.data?.lastError ?? null}
        messagesPublished={statusQuery.data?.messagesPublished ?? 0}
        lastPublishAt={statusQuery.data?.lastPublishAt ?? null}
        loading={statusQuery.isLoading}
      />

      {settingsQuery.isLoading && (
        <div className="h-40 animate-pulse rounded-xl bg-zinc-900" />
      )}

      {settingsQuery.error && (
        <ListSection footer={settingsQuery.error.message}>
          <ListRow title={<span className="text-red-400">Failed to load MQTT settings</span>} />
        </ListSection>
      )}

      {data && (
        <SettingsCard
          data={data}
          onSaved={() => {
            utils.mqtt.getSettings.invalidate()
            utils.mqtt.getStatus.invalidate()
          }}
        />
      )}
    </>
  )
}

interface ConnectionStatusSectionProps {
  connected: boolean
  lastError: string | null
  messagesPublished: number
  lastPublishAt: string | null
  loading: boolean
}

function ConnectionStatusSection({
  connected,
  lastError,
  messagesPublished,
  lastPublishAt,
  loading,
}: ConnectionStatusSectionProps) {
  return (
    <ListSection
      header="Bridge status"
      footer={lastError ? <span className="break-words text-red-400">{lastError}</span> : undefined}
    >
      <ListRow
        title="Status"
        value={loading
          ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={15} className="animate-spin" />
                Checking…
              </span>
            )
          : <span className={connected ? 'text-emerald-400' : undefined}>{connected ? 'Connected' : 'Disconnected'}</span>}
      />
      <ListRow title="Messages published" value={messagesPublished.toLocaleString()} />
      <ListRow title="Last publish" value={relativeTime(lastPublishAt)} />
    </ListSection>
  )
}

interface SettingsCardProps {
  data: MqttSettings
  onSaved: () => void
}

function SettingsCard({ data, onSaved }: SettingsCardProps) {
  const [enabled, setEnabled] = useState(data.enabled)
  const [haDiscovery, setHaDiscovery] = useState(data.haDiscovery)
  const [tlsEnabled, setTlsEnabled] = useState(data.tlsEnabled)

  // Text fields: input is empty when sourced from env/default; placeholder
  // shows the resolved value so the user knows the current effective setting.
  const [url, setUrl] = useState(data.sources.url === 'db' ? data.url ?? '' : '')
  const [username, setUsername] = useState(data.sources.username === 'db' ? data.username ?? '' : '')
  // Topic prefix always has a sensible resolved default ('sleepypod'); prefill
  // so the user sees what's in effect rather than an empty box with placeholder.
  const [topicPrefix, setTopicPrefix] = useState(data.topicPrefix)
  const [password, setPassword] = useState('')

  // Resync local state when the server snapshot changes (e.g. after save
  // invalidation). Uses the "store prev props in state" pattern so we do not
  // remount via `key=` (which drops input focus mid-edit).
  const [prevData, setPrevData] = useState(data)
  if (data !== prevData) {
    setPrevData(data)
    setEnabled(data.enabled)
    setHaDiscovery(data.haDiscovery)
    setTlsEnabled(data.tlsEnabled)
    setUrl(data.sources.url === 'db' ? data.url ?? '' : '')
    setUsername(data.sources.username === 'db' ? data.username ?? '' : '')
    setTopicPrefix(data.topicPrefix)
  }

  const updateMutation = trpc.mqtt.updateSettings.useMutation({
    onSuccess: () => {
      setPassword('')
      onSaved()
    },
  })

  const testMutation = trpc.mqtt.testConnection.useMutation()

  const isPending = updateMutation.isPending

  function handleSave() {
    const payload: Partial<{
      enabled: boolean
      url: string
      username: string
      password: string
      topicPrefix: string
      haDiscovery: boolean
      tlsEnabled: boolean
    }> = {
      enabled,
      haDiscovery,
      tlsEnabled,
    }
    if (url.trim()) payload.url = url.trim()
    if (username.trim()) payload.username = username.trim()
    if (topicPrefix.trim()) payload.topicPrefix = topicPrefix.trim()
    if (password) payload.password = password
    updateMutation.mutate(payload)
  }

  function handleTest() {
    const effectiveUrl = url.trim() || data.url || ''
    const effectiveUsername = username.trim() || data.username || ''
    testMutation.mutate({
      url: effectiveUrl,
      username: effectiveUsername,
      tlsEnabled,
      ...(password ? { password } : {}),
    })
  }

  const canTest = Boolean(url.trim() || data.url)

  const testFooter = testMutation.error
    ? <span className="text-red-400">{testMutation.error.message}</span>
    : testMutation.data
      ? (
          <span className={testMutation.data.ok ? 'text-emerald-400' : 'text-red-400'}>
            {testMutation.data.ok
              ? 'Connection succeeded.'
              : `Connection failed: ${testMutation.data.error ?? 'unknown error'}`}
          </span>
        )
      : undefined

  const authFooter = [
    'Leave both blank for anonymous brokers (e.g. local Mosquitto with allow_anonymous true).',
    data.sources.password === 'env' ? 'The password is currently sourced from .env.' : null,
  ].filter(Boolean).join(' ')

  return (
    <>
      <ListSection footer="Publishes status and biometrics, accepts commands, and creates climate, switch and sensor entities in Home Assistant.">
        <SwitchRow
          title="MQTT bridge"
          checked={enabled}
          onChange={() => setEnabled(v => !v)}
          disabled={isPending}
          ariaLabel="Toggle MQTT bridge"
        />
        <SwitchRow
          title="Home Assistant discovery"
          checked={haDiscovery}
          onChange={() => setHaDiscovery(v => !v)}
          disabled={isPending}
          ariaLabel="Toggle Home Assistant discovery"
        />
      </ListSection>

      <ListSection header="Connection" footer={testFooter}>
        <TextRow
          id="mqtt-url"
          title="Broker"
          subtitle={sourceLabel(data.sources.url)}
          value={url}
          placeholder={data.url || 'mqtt://broker.local:1883'}
          onChange={e => setUrl(e.target.value)}
          disabled={isPending}
          autoComplete="off"
          inputMode="url"
        />
        <SwitchRow
          title="TLS"
          subtitle="Use mqtts:// transport"
          checked={tlsEnabled}
          onChange={() => setTlsEnabled(v => !v)}
          disabled={isPending}
          ariaLabel="Toggle TLS"
        />
        <ActionRow
          title="Test connection"
          onClick={handleTest}
          disabled={!canTest || testMutation.isPending}
          trailing={testMutation.isPending ? <Loader2 size={17} className="animate-spin text-zinc-500" /> : undefined}
        />
      </ListSection>

      <ListSection header="Authentication" footer={authFooter}>
        <TextRow
          id="mqtt-username"
          title="Username"
          subtitle={sourceLabel(data.sources.username)}
          value={username}
          placeholder={data.username || 'Optional'}
          onChange={e => setUsername(e.target.value)}
          disabled={isPending}
          autoComplete="off"
        />
        <TextRow
          id="mqtt-password"
          type="password"
          title="Password"
          subtitle={data.passwordIsSet ? 'Set' : 'Not set'}
          value={password}
          placeholder={data.passwordIsSet ? '••••••••' : 'Optional'}
          onChange={e => setPassword(e.target.value)}
          disabled={isPending}
          autoComplete="new-password"
        />
      </ListSection>

      <ListSection header="Topics">
        <TextRow
          id="mqtt-topic-prefix"
          title="Topic prefix"
          subtitle={sourceLabel(data.sources.topicPrefix)}
          value={topicPrefix}
          placeholder="sleepypod"
          onChange={e => setTopicPrefix(e.target.value)}
          disabled={isPending}
          autoComplete="off"
        />
      </ListSection>

      <div className="space-y-1.5">
        <PrimaryButton onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 size={18} className="animate-spin" />}
          {isPending ? 'Saving…' : 'Save'}
        </PrimaryButton>
        {updateMutation.error && (
          <p className="px-4 text-[13px] text-red-400">{updateMutation.error.message}</p>
        )}
        {updateMutation.isSuccess && (
          <p className="px-4 text-[13px] text-emerald-400">Settings saved.</p>
        )}
      </div>
    </>
  )
}
