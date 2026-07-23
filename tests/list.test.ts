import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { list } from '../commands/list.js'
import { CONFIG, asyncIter, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/imap.js')

let client: any

function message(uid: number, seen: boolean) {
  return {
    seq: uid,
    uid,
    envelope: {
      date: '2026-07-01T00:00:00.000Z',
      from: [{ address: `from${uid}@x.com` }],
      subject: `subject ${uid}`,
    },
    flags: new Set(seen ? ['\\Seen'] : []),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  client = { mailbox: { exists: 100 } }
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
  vi.mocked(withMailbox).mockImplementation((_client, _mailbox, cb) => cb())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('list', () => {
  it('fetches a trailing range and maps envelopes', async () => {
    client.fetch = vi.fn(() => asyncIter([message(99, true), message(100, false)]))
    const result = await invoke(list, [])

    // total 100, default count 10 -> range "91:*"
    expect(client.fetch).toHaveBeenCalledWith('91:*', { uid: true, envelope: true, flags: true })
    const out = result

    expect(out).toMatchObject({ ok: true, mailbox: 'INBOX', total: 100, returned: 2 })
    expect(out.messages[0]).toEqual({
      seq: 99,
      uid: 99,
      date: '2026-07-01T00:00:00.000Z',
      from: 'from99@x.com',
      subject: 'subject 99',
      unread: false,
    })
    expect(out.messages[1].unread).toBe(true)
  })

  it('searches for unread when --unread is set', async () => {
    client.search = vi.fn().mockResolvedValue([100])
    client.fetch = vi.fn(() => asyncIter([message(100, false)]))
    const result = await invoke(list, ['--unread'])

    expect(client.search).toHaveBeenCalledWith({ seen: false })
    expect(client.fetch).toHaveBeenCalledWith([100], { uid: true, envelope: true, flags: true })
    expect(result.messages).toHaveLength(1)
  })

  it('returns an empty list when an unread search finds nothing', async () => {
    client.search = vi.fn().mockResolvedValue([])
    client.fetch = vi.fn()
    const result = await invoke(list, ['--unread'])

    expect(client.fetch).not.toHaveBeenCalled()
    expect(result).toMatchObject({ returned: 0, messages: [] })
  })

  it('honours --count for the range', async () => {
    client.fetch = vi.fn(() => asyncIter([]))
    const result = await invoke(list, ['--count', '5'])

    expect(client.fetch).toHaveBeenCalledWith('96:*', { uid: true, envelope: true, flags: true })
    expect(result.total).toBe(100)
  })

  it('defaults to INBOX', async () => {
    client.fetch = vi.fn(() => asyncIter([]))
    const result = await invoke(list, [])

    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('INBOX')
    expect(result.mailbox).toBe('INBOX')
  })

  it('honours --mailbox for another folder', async () => {
    client.fetch = vi.fn(() => asyncIter([]))
    const result = await invoke(list, ['--mailbox', '[Gmail]/All Mail'])

    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('[Gmail]/All Mail')
    expect(result.mailbox).toBe('[Gmail]/All Mail')
  })
})
