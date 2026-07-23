import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient } from '../lib/imap.js'
import { labels } from '../commands/labels.js'
import { CONFIG, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/imap.js')

let client: any

const BOXES = [
  { path: 'INBOX', name: 'INBOX', specialUse: undefined, subscribed: true },
  { path: '[Gmail]/All Mail', name: 'All Mail', specialUse: '\\All', subscribed: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  client = { list: vi.fn().mockResolvedValue(BOXES) }
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('labels', () => {
  it('lists mailboxes without counts by default', async () => {
    client.status = vi.fn()
    const result = await invoke(labels, [])

    expect(client.status).not.toHaveBeenCalled()
    const out = result

    expect(out).toMatchObject({ ok: true, count: 2 })
    expect(out.labels[0]).toEqual({
      path: 'INBOX',
      name: 'INBOX',
      specialUse: null,
      subscribed: true,
    })
    expect(out.labels[1].specialUse).toBe('\\All')
  })

  it('adds message and unread counts with --counts', async () => {
    client.status = vi.fn().mockResolvedValue({ messages: 42, unseen: 3 })
    const result = await invoke(labels, ['--counts'])

    expect(client.status).toHaveBeenCalledWith('INBOX', { messages: true, unseen: true })
    const out = result

    expect(out.labels[0]).toMatchObject({ messages: 42, unseen: 3 })
  })
})
