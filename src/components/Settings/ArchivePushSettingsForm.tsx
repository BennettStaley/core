'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { trpc } from '@/src/utils/trpc'
import { ListRow, ListSection } from '@/src/ui/ios'
import { ActionRow, PrimaryButton, SwitchRow, TextRow } from './SettingsRows'

interface FormState {
  enabled: boolean
  host: string
  remoteUser: string
  remotePath: string
  port: number
  identity: string
  include: Array<'raw' | 'db'>
}

interface InitialConfig {
  config: FormState
  publicKey: string | null
}

/**
 * Settings form for the archive-push feature (sp-21). Lets the user
 * configure a remote scp target, generate an ssh keypair on the pod,
 * copy the pubkey into their remote's authorized_keys, and run a
 * non-destructive connection test before flipping ENABLED on.
 *
 * The inner editor uses a `key` prop bound to the loaded config so a
 * server-driven change (e.g. after generateKey) cleanly remounts and
 * picks up the new initial state without a setState-in-effect.
 */
export function ArchivePushSettingsForm() {
  const configQuery = trpc.archivePush.getConfig.useQuery({})

  if (configQuery.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-zinc-900" />
  }

  const data = configQuery.data ?? {
    config: {
      enabled: false,
      host: '',
      remoteUser: '',
      remotePath: '',
      port: 22,
      identity: '/etc/sleepypod/archive-push.id_ed25519',
      include: ['raw', 'db'] as Array<'raw' | 'db'>,
    },
    publicKey: null,
  }

  // Stable key drawn from the server snapshot — when the user generates a
  // key (or another tab edits the conf) the snapshot changes, the key
  // changes, and the editor remounts cleanly with the latest defaults.
  const formKey = JSON.stringify({ c: data.config, k: data.publicKey })

  return <Editor key={formKey} initial={data} />
}

function Editor({ initial }: { initial: InitialConfig }) {
  const utils = trpc.useUtils()
  const setConfig = trpc.archivePush.setConfig.useMutation({
    onSuccess: () => utils.archivePush.getConfig.invalidate(),
  })
  const generateKey = trpc.archivePush.generateKey.useMutation({
    onSuccess: () => utils.archivePush.getConfig.invalidate(),
  })
  const testConnection = trpc.archivePush.testConnection.useMutation()

  const [form, setForm] = useState<FormState>(() => ({
    ...initial.config,
    include: [...initial.config.include],
  }))
  const [copied, setCopied] = useState(false)

  const publicKey = initial.publicKey

  const handleSave = () => setConfig.mutate(form)

  const handleCopy = async () => {
    if (!publicKey) return
    try {
      await navigator.clipboard.writeText(publicKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    catch {
      /* clipboard blocked — user can select manually */
    }
  }

  const toggleInclude = (key: 'raw' | 'db') => {
    setForm(f => ({
      ...f,
      include: f.include.includes(key)
        ? f.include.filter(k => k !== key)
        : [...f.include, key],
    }))
  }

  return (
    <>
      <ListSection footer="Rsyncs the cold archive (and a biometrics.db dump) to a host you control, once per night via a systemd timer.">
        <SwitchRow
          title="Nightly push"
          ariaLabel="Enable nightly push"
          checked={form.enabled}
          onChange={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
        />
      </ListSection>

      <ListSection header="Remote">
        <TextRow
          id="archive-host"
          title="Host"
          value={form.host}
          onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
          placeholder="nas.local"
        />
        <TextRow
          id="archive-user"
          title="User"
          value={form.remoteUser}
          onChange={e => setForm(f => ({ ...f, remoteUser: e.target.value }))}
          placeholder="sleepypod"
        />
        <TextRow
          id="archive-path"
          title="Path"
          value={form.remotePath}
          onChange={e => setForm(f => ({ ...f, remotePath: e.target.value }))}
          placeholder="/volume1/sleepypod-archive"
        />
        <TextRow
          id="archive-port"
          title="Port"
          type="number"
          inputMode="numeric"
          value={form.port}
          onChange={(e) => {
            const parsed = Number(e.target.value)
            setForm(f => ({ ...f, port: Number.isFinite(parsed) ? parsed : 22 }))
          }}
        />
      </ListSection>

      <ListSection header="Include">
        {(['raw', 'db'] as const).map(key => (
          <ListRow
            key={key}
            title={key === 'raw' ? 'RAW waveforms' : 'biometrics.db'}
            onClick={() => toggleInclude(key)}
            accessory={form.include.includes(key)
              ? <Check size={20} aria-label="Included" className="shrink-0 text-sky-400" />
              : <span className="w-5 shrink-0" />}
          />
        ))}
      </ListSection>

      <div className="space-y-1.5">
        <PrimaryButton onClick={handleSave} disabled={setConfig.isPending}>
          {setConfig.isPending && <Loader2 size={18} className="animate-spin" />}
          {setConfig.isSuccess && !setConfig.isPending ? 'Saved' : 'Save'}
        </PrimaryButton>
        {setConfig.error && (
          <p className="px-4 text-[13px] text-red-400">{setConfig.error.message}</p>
        )}
      </div>

      <ListSection
        header="SSH identity"
        footer={generateKey.error
          ? <span className="text-red-400">{generateKey.error.message}</span>
          : 'Generate an ed25519 keypair on the pod, then add the public key to ~/.ssh/authorized_keys on your remote.'}
      >
        {publicKey
          ? (
              <>
                <div className="px-4 py-3">
                  <p className="select-all break-all font-mono text-[13px] leading-[18px] text-zinc-400">{publicKey}</p>
                </div>
                <ActionRow title={copied ? 'Copied' : 'Copy public key'} onClick={handleCopy} />
              </>
            )
          : (
              <ActionRow
                title="Generate ed25519 keypair"
                onClick={() => generateKey.mutate({})}
                disabled={generateKey.isPending}
                trailing={generateKey.isPending ? <Loader2 size={17} className="animate-spin text-zinc-500" /> : undefined}
              />
            )}
      </ListSection>

      <ListSection
        header="Connection test"
        footer={testConnection.data
          ? (
              <span className={`break-all font-mono ${testConnection.data.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {testConnection.data.message}
              </span>
            )
          : 'Runs a non-destructive ssh probe against the remote. Save first if you have edited the form.'}
      >
        <ActionRow
          title="Run test"
          onClick={() => testConnection.mutate({})}
          disabled={testConnection.isPending}
          trailing={testConnection.isPending ? <Loader2 size={17} className="animate-spin text-zinc-500" /> : undefined}
        />
      </ListSection>
    </>
  )
}
