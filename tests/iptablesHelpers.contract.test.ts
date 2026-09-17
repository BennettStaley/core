import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const helperPath = join(repoRoot, 'scripts/lib/iptables-helpers')
const helperScript = readFileSync(helperPath, 'utf8')
const updateScript = readFileSync(join(repoRoot, 'scripts/bin/sp-update'), 'utf8')
const installScript = readFileSync(join(repoRoot, 'scripts/install'), 'utf8')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('iptables save and restore deployment contracts', () => {
  it('keeps iptables-save diagnostics out of every saved restore payload', () => {
    for (const script of [helperScript, updateScript, installScript]) {
      expect(script).not.toContain('iptables-save 2>&1')
      expect(script).toContain('SAVED_IPTABLES="$(iptables-save)"')
      expect(script).toContain('printf \'%s\\n\' "$SAVED_IPTABLES" | iptables-restore')
      expect(script).not.toContain('iptables-restore 2>/dev/null')
      expect(script).toContain('iptables -P OUTPUT ACCEPT || return 1')
    }
  })

  it('passes only stdout rules to iptables-restore when iptables-save warns', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sleepypod-iptables-'))
    tempDirs.push(dir)
    const restoredPath = join(dir, 'restored.rules')
    const harness = `
iptables-save() {
  printf '%s\\n' '*filter' ':OUTPUT ACCEPT [0:0]' 'COMMIT'
  printf '%s\\n' 'iptables-save: backend warning' >&2
}
iptables() {
  if [ "$1" = '-S' ] && [ "$2" = 'OUTPUT' ]; then
    printf '%s\\n' '-P OUTPUT ACCEPT' '-A OUTPUT -o lo -j ACCEPT' '-A OUTPUT -j DROP'
  fi
  return 0
}
iptables-restore() { cat > "$RESTORED_PATH"; }
source "$HELPER_PATH"
unblock_wan
restore_wan
`

    const result = spawnSync('bash', ['-c', harness], {
      encoding: 'utf8',
      env: { ...process.env, HELPER_PATH: helperPath, RESTORED_PATH: restoredPath },
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toContain('iptables-save: backend warning')
    expect(readFileSync(restoredPath, 'utf8')).toBe('*filter\n:OUTPUT ACCEPT [0:0]\nCOMMIT\n')
  })

  it('stops the service before opening WAN and reloads the installed helper before restore', () => {
    const mainFlow = updateScript.indexOf('# Pre-flight: disk space')
    const stopCommand = updateScript.indexOf('systemctl stop sleepypod.service', mainFlow)
    const unblockCommand = updateScript.indexOf('    unblock_wan\n', mainFlow)
    expect(mainFlow).toBeGreaterThan(-1)
    expect(stopCommand).toBeGreaterThan(mainFlow)
    expect(stopCommand).toBeLessThan(unblockCommand)
    expect(updateScript).toContain('local saved_rules="$SAVED_IPTABLES"')
    expect(updateScript).toContain('source "$INSTALL_DIR/scripts/lib/iptables-helpers"')
    expect(updateScript).toContain('SAVED_IPTABLES="$saved_rules"')
    expect(updateScript.match(/^\s*reload_iptables_helpers$/gm)).toHaveLength(2)
  })

  it('opens DROP default policies before flushing the temporary update ruleset', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sleepypod-iptables-'))
    tempDirs.push(dir)
    const commandLog = join(dir, 'iptables.commands')
    const harness = `
iptables-save() {
  printf '%s\\n' '*filter' ':INPUT DROP [0:0]' ':FORWARD DROP [0:0]' ':OUTPUT DROP [0:0]' 'COMMIT'
}
iptables() { printf '%s\\n' "$*" >> "$COMMAND_LOG"; }
source "$HELPER_PATH"
unblock_wan
`

    const result = spawnSync('bash', ['-c', harness], {
      encoding: 'utf8',
      env: { ...process.env, COMMAND_LOG: commandLog, HELPER_PATH: helperPath },
    })
    const commands = readFileSync(commandLog, 'utf8').trim().split('\n')

    expect(result.status).toBe(0)
    expect(commands.slice(0, 4)).toEqual([
      '-P INPUT ACCEPT',
      '-P OUTPUT ACCEPT',
      '-P FORWARD ACCEPT',
      '-F',
    ])
  })

  it('forces OUTPUT fail-closed before a mid-rebuild rule failure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sleepypod-iptables-'))
    tempDirs.push(dir)
    const commandLog = join(dir, 'iptables.commands')
    const harness = `
iptables() {
  printf '%s\\n' "$*" >> "$COMMAND_LOG"
  if [ "$*" = '-I OUTPUT -p udp --dport 123 -j ACCEPT' ]; then return 1; fi
  return 0
}
source "$HELPER_PATH"
block_wan
`

    const result = spawnSync('bash', ['-c', harness], {
      encoding: 'utf8',
      env: { ...process.env, COMMAND_LOG: commandLog, HELPER_PATH: helperPath },
    })
    const commands = readFileSync(commandLog, 'utf8').trim().split('\n')

    expect(result.status).not.toBe(0)
    expect(commands.slice(0, 3)).toEqual([
      '-P OUTPUT DROP',
      '-P INPUT DROP',
      '-P FORWARD DROP',
    ])
    expect(commands).toContain('-I OUTPUT -p udp --dport 123 -j ACCEPT')
    expect(commands).not.toContain('-A OUTPUT -j DROP')
  })

  it('rejects a blanket OUTPUT accept before DROP but accepts constrained loopback', () => {
    const harness = `
RULESET=bad
iptables() {
  if [ "$1" = '-S' ] && [ "$2" = 'SLEEPYPOD-BLOCK' ]; then
    printf '%s\\n' \
      '-N SLEEPYPOD-BLOCK' \
      '-A SLEEPYPOD-BLOCK -o lo -j ACCEPT' \
      '-A SLEEPYPOD-BLOCK -m state --state RELATED,ESTABLISHED -j ACCEPT' \
      '-A SLEEPYPOD-BLOCK -d 192.168.1.0/24 -j ACCEPT' \
      '-A SLEEPYPOD-BLOCK -j DROP'
  elif [ "$1" = '-S' ] && [ "$2" = 'OUTPUT' ]; then
    if [ "$RULESET" = bad ]; then
      printf '%s\\n' '-P OUTPUT ACCEPT' '-A OUTPUT -j ACCEPT' '-A OUTPUT -j DROP'
    elif [ "$RULESET" = custom ]; then
      printf '%s\\n' '-P OUTPUT ACCEPT' '-A OUTPUT -j SLEEPYPOD-BLOCK'
    else
      printf '%s\\n' '-P OUTPUT ACCEPT' '-A OUTPUT -o lo -j ACCEPT' '-A OUTPUT -j DROP'
    fi
  fi
}
source "$HELPER_PATH"
wan_is_blocked
if wan_is_effectively_blocked; then exit 10; fi
RULESET=good
wan_is_effectively_blocked
RULESET=custom
wan_is_blocked
wan_is_effectively_blocked
`

    const result = spawnSync('bash', ['-c', harness], {
      encoding: 'utf8',
      env: { ...process.env, HELPER_PATH: helperPath },
    })

    expect(result.status).toBe(0)
  })
})

describe('extra trusted LAN CIDRs (non-RFC1918 home networks)', () => {
  function runBlockWan(cidrsFile: string, failOn?: string) {
    const dir = mkdtempSync(join(tmpdir(), 'sleepypod-iptables-'))
    tempDirs.push(dir)
    const commandLog = join(dir, 'iptables.commands')
    const cidrsPath = join(dir, 'lan-cidrs')
    writeFileSync(cidrsPath, cidrsFile)
    const harness = `
iptables() {
  printf '%s\\n' "$*" >> "$COMMAND_LOG"
  if [ "$1" = '-C' ]; then return 1; fi
  if [ "$1" = '-S' ] && [ "$2" = 'OUTPUT' ]; then printf '%s\\n' '-P OUTPUT DROP' '-A OUTPUT -j DROP'; fi
  if [ -n "$FAIL_ON" ] && [ "$*" = "$FAIL_ON" ]; then return 1; fi
  return 0
}
source "$HELPER_PATH"
block_wan
`
    const result = spawnSync('bash', ['-c', harness], {
      encoding: 'utf8',
      env: {
        ...process.env,
        COMMAND_LOG: commandLog,
        HELPER_PATH: helperPath,
        TRUSTED_LAN_CIDRS_FILE: cidrsPath,
        FAIL_ON: failOn ?? '',
      },
    })
    return { result, commands: readFileSync(commandLog, 'utf8').trim().split('\n') }
  }

  it('allows valid extra CIDRs before the final DROP and ignores junk or blanket ranges', () => {
    const { result, commands } = runBlockWan('# home LAN\n13.0.0.0/24\n\nnot-a-cidr\n0.0.0.0/0\n1.2.3.4/4\n')

    expect(result.status).toBe(0)
    const inputAllow = commands.indexOf('-I INPUT 1 -s 13.0.0.0/24 -j ACCEPT')
    expect(inputAllow).toBeGreaterThan(-1)
    expect(commands).toContain('-I OUTPUT 1 -d 13.0.0.0/24 -j ACCEPT')
    expect(inputAllow).toBeLessThan(commands.indexOf('-A INPUT -j DROP'))
    expect(commands.some(command => command.includes('0.0.0.0/0'))).toBe(false)
    expect(commands.some(command => command.includes('1.2.3.4/4'))).toBe(false)
  })

  it('keeps the extra CIDR allowed even when the rebuild fails midway', () => {
    const { result, commands } = runBlockWan('13.0.0.0/24\n', '-I OUTPUT -p udp --dport 123 -j ACCEPT')

    expect(result.status).not.toBe(0)
    expect(commands).toContain('-I INPUT 1 -s 13.0.0.0/24 -j ACCEPT')
  })

  it('ships the same allow hook in every firewall fallback path', () => {
    for (const script of [helperScript, installScript]) {
      expect(script).toContain('allow_extra_lan_cidrs() {')
      expect(script).toMatch(/allow_extra_lan_cidrs \|\| return 1\n\n {2}# Allow established connections/)
    }
    expect(installScript).toMatch(/forcing default policies DROP\." >&2\n\s+allow_extra_lan_cidrs/)
    expect(updateScript.match(/declare -F allow_extra_lan_cidrs/g)).toHaveLength(2)
  })
})
