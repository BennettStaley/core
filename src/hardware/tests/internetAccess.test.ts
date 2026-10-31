// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runFile: vi.fn<(file: string, args: string[]) => Promise<{ stdout: string }>>(),
  files: new Map<string, string>(),
}))
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFile: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: mocks.runFile }),
}))
vi.mock('node:fs', () => ({
  accessSync: () => { throw new Error('ENOENT') },
  constants: { X_OK: 1 },
}))
vi.mock('node:fs/promises', () => ({
  access: vi.fn(async () => { throw new Error('ENOENT') }),
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async (file: string) => {
    const value = mocks.files.get(file)
    if (value === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return value
  }),
  writeFile: vi.fn(async (file: string, value: string) => { mocks.files.set(file, value) }),
  rename: vi.fn(async (from: string, to: string) => {
    mocks.files.set(to, mocks.files.get(from) ?? '')
    mocks.files.delete(from)
  }),
  unlink: vi.fn(async (file: string) => { mocks.files.delete(file) }),
}))

import { blockWan, internetAccessChoicePath, parseLanCidrs, restoreInternetAccess } from '../internetAccess'
import { APP_BLOCK_WAN, FLUSHED, INSTALL_BLOCK_WAN, INTERNET_CONTROL_BLOCK, type Ruleset } from './iptablesRulesets'

const MANUAL_RULES = {
  OUTPUT: '-P OUTPUT ACCEPT\n-A OUTPUT -d 203.0.113.7/32 -j DROP\n',
} satisfies Ruleset

let calls: string[][]
function serve(ruleset: Ruleset) {
  mocks.runFile.mockImplementation(async (_file, args) => {
    calls.push(args)
    if (args[0] !== '-S') return { stdout: '' }
    const listing = ruleset[args[1] ?? '']
    if (listing === undefined) throw Object.assign(new Error('No chain/target/match by that name.'), { code: 1 })
    return { stdout: listing }
  })
}
const mutations = () => calls.filter(args => args[0] !== '-S')
const saved = () => mocks.files.get(internetAccessChoicePath())

beforeEach(() => {
  calls = []
  mocks.files.clear()
  mocks.runFile.mockReset()
})

describe('restoreInternetAccess', () => {
  it.each([
    ['flushed', FLUSHED],
    ['manual rules that leave general traffic open', MANUAL_RULES],
  ])('re-applies the block when the saved choice is blocked and the firewall is %s', async (_name, ruleset) => {
    mocks.files.set(internetAccessChoicePath(), 'blocked\n')
    serve(ruleset)
    await expect(restoreInternetAccess()).resolves.toEqual({ action: 'reapplied', choice: 'blocked' })
    expect(mutations()[0]).toEqual(['-F'])
    expect(mutations().at(-1)).toEqual(['-A', 'OUTPUT', '-j', 'DROP'])
    expect(saved()).toBe('blocked\n')
  })

  it.each([
    ['the installer block_wan', INSTALL_BLOCK_WAN],
    ['the app blockWan', APP_BLOCK_WAN],
    ['internet-control block / restore', INTERNET_CONTROL_BLOCK],
  ])('leaves %s alone when the saved choice is blocked', async (_name, ruleset) => {
    mocks.files.set(internetAccessChoicePath(), 'blocked\n')
    serve(ruleset)
    await expect(restoreInternetAccess()).resolves.toEqual({ action: 'kept', choice: 'blocked' })
    expect(mutations()).toEqual([])
  })

  it.each([
    ['open', FLUSHED],
    ['blocking', INSTALL_BLOCK_WAN],
    ['the owner\'s manual rules', MANUAL_RULES],
  ])('never touches the firewall (%s) when the saved choice is allowed', async (_name, ruleset) => {
    mocks.files.set(internetAccessChoicePath(), 'allowed\n')
    serve(ruleset)
    await expect(restoreInternetAccess()).resolves.toEqual({ action: 'kept', choice: 'allowed' })
    expect(mutations()).toEqual([])
    expect(saved()).toBe('allowed\n')
  })

  it.each([
    ['blocked', INSTALL_BLOCK_WAN],
    ['blocked', INTERNET_CONTROL_BLOCK],
    ['allowed', FLUSHED],
  ] as const)('with no saved choice, infers %s once from the firewall and changes nothing', async (choice, ruleset) => {
    serve(ruleset)
    await expect(restoreInternetAccess()).resolves.toEqual({ action: 'inferred', choice })
    expect(saved()).toBe(`${choice}\n`)
    expect(mutations()).toEqual([])
    await expect(restoreInternetAccess()).resolves.toEqual({ action: 'kept', choice })
  })

  it('treats an unrecognised saved value as no choice', async () => {
    mocks.files.set(internetAccessChoicePath(), 'BLOCKED please\n')
    serve(FLUSHED)
    await expect(restoreInternetAccess()).resolves.toEqual({ action: 'inferred', choice: 'allowed' })
    expect(saved()).toBe('allowed\n')
  })

  it('saves nothing when the firewall cannot be read (dev box, no iptables)', async () => {
    mocks.runFile.mockRejectedValue(Object.assign(new Error('spawn iptables ENOENT'), { code: 'ENOENT' }))
    await expect(restoreInternetAccess()).resolves.toEqual({ action: 'unknown' })
    expect(mocks.files.size).toBe(0)
  })

  it('saves the choice next to the database', () => {
    const previous = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'file:/sleepypod-data/sleepypod.db'
    try {
      expect(internetAccessChoicePath()).toBe('/sleepypod-data/internet-access')
    }
    finally {
      if (previous === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = previous
    }
  })
})

describe('extra trusted LAN ranges', () => {
  it('keeps valid IPv4 CIDRs and drops comments, blanks and junk', () => {
    expect(parseLanCidrs('# home\n13.0.0.0/24  # main LAN\n\n 100.64.0.0/10\r\n10.0.0.0/7\n1.2.3.4\nnope/24\n'))
      .toEqual(['13.0.0.0/24', '100.64.0.0/10'])
  })

  it('blockWan accepts them inbound and outbound before the DROPs', async () => {
    mocks.files.set('/etc/sleepypod/lan-cidrs', '13.0.0.0/24\n')
    serve(FLUSHED)
    await blockWan()
    const added = mutations()
    const drop = added.findIndex(args => args.join(' ') === '-A INPUT -j DROP')
    expect(added.findIndex(args => args.join(' ') === '-A INPUT -s 13.0.0.0/24 -j ACCEPT')).toBeGreaterThan(-1)
    expect(added.findIndex(args => args.join(' ') === '-A INPUT -s 13.0.0.0/24 -j ACCEPT')).toBeLessThan(drop)
    expect(added).toContainEqual(['-A', 'OUTPUT', '-d', '13.0.0.0/24', '-j', 'ACCEPT'])
  })

  it('blockWan still allows RFC 1918 when the file is missing', async () => {
    serve(FLUSHED)
    await blockWan()
    expect(mutations()).toContainEqual(['-A', 'INPUT', '-s', '192.168.0.0/16', '-j', 'ACCEPT'])
    expect(mutations().some(args => args.includes('13.0.0.0/24'))).toBe(false)
  })
})
