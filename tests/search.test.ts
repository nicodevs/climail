import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { search } from '../commands/search.js'
import { CONFIG, asyncIter, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/imap.js')

let client: any

function message(uid: number) {
  return {
    seq: uid,
    uid,
    envelope: { date: null, from: [{ address: `from${uid}@x.com` }], subject: `s${uid}` },
    flags: new Set<string>(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  client = {}
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
  vi.mocked(withMailbox).mockImplementation((_client, _mailbox, cb) => cb())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('search', () => {
  it('builds a query from flags and returns newest-first', async () => {
    client.search = vi.fn().mockResolvedValue([10, 11, 12])
    // fetch yields in mailbox order; command should sort newest-first.
    client.fetch = vi.fn(() => asyncIter([message(10), message(12), message(11)]))
    const result = await invoke(search, ['--from', 'boss@x.com', '--unread'])

    expect(client.search).toHaveBeenCalledWith({ from: 'boss@x.com', seen: false }, { uid: true })
    const out = result

    expect(out.matched).toBe(3)
    expect(out.messages.map((m: { uid: number }) => m.uid)).toEqual([12, 11, 10])
  })

  it('falls back to { all: true } with no criteria', async () => {
    client.search = vi.fn().mockResolvedValue([])
    client.fetch = vi.fn(() => asyncIter([]))
    const result = await invoke(search, [])

    expect(client.search).toHaveBeenCalledWith({ all: true }, { uid: true })
    expect(result).toMatchObject({ matched: 0, returned: 0, messages: [] })
  })

  it('passes date criteria through as Date objects', async () => {
    client.search = vi.fn().mockResolvedValue([])
    client.fetch = vi.fn(() => asyncIter([]))
    await invoke(search, ['--since', '2026-06-01'])

    const query = vi.mocked(client.search).mock.calls[0][0]

    expect(query.since).toBeInstanceOf(Date)
    expect((query.since as Date).toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('rejects an invalid date', async () => {
    await expect(invoke(search, ['--since', 'notadate'])).rejects.toThrow(
      'Invalid date: "notadate"',
    )
  })

  it('searches INBOX by default', async () => {
    client.search = vi.fn().mockResolvedValue([])
    client.fetch = vi.fn(() => asyncIter([]))
    const result = await invoke(search, [])

    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('INBOX')
    expect(result.mailbox).toBe('INBOX')
  })

  it('honours --mailbox for another folder', async () => {
    client.search = vi.fn().mockResolvedValue([])
    client.fetch = vi.fn(() => asyncIter([]))
    const result = await invoke(search, ['--mailbox', '[Gmail]/All Mail'])

    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('[Gmail]/All Mail')
    expect(result.mailbox).toBe('[Gmail]/All Mail')
  })
})
