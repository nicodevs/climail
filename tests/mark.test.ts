import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { mark } from '../commands/mark.js'
import { CONFIG, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/imap.js')

let client: any

beforeEach(() => {
  vi.clearAllMocks()
  client = {
    messageFlagsAdd: vi.fn().mockResolvedValue(true),
    messageFlagsRemove: vi.fn().mockResolvedValue(true),
  }
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
  vi.mocked(withMailbox).mockImplementation((_client, _mailbox, cb) => cb())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mark', () => {
  it('adds \\Seen for read', async () => {
    const result = await invoke(mark, ['167', 'read'])

    expect(client.messageFlagsAdd).toHaveBeenCalledWith('167', ['\\Seen'], { uid: true })
    expect(result).toEqual({
      ok: true,
      uid: 167,
      mailbox: 'INBOX',
      action: 'read',
      flag: '\\Seen',
      applied: true,
    })
  })

  it('removes \\Seen for unread', async () => {
    await invoke(mark, ['167', 'unread'])

    expect(client.messageFlagsRemove).toHaveBeenCalledWith('167', ['\\Seen'], { uid: true })
  })

  it('treats star as an alias for adding \\Flagged', async () => {
    const result = await invoke(mark, ['167', 'star'])

    expect(client.messageFlagsAdd).toHaveBeenCalledWith('167', ['\\Flagged'], { uid: true })
    expect(result.flag).toBe('\\Flagged')
  })

  it('rejects an unknown action', async () => {
    await expect(invoke(mark, ['167', 'bogus'])).rejects.toThrow('Unknown action "bogus"')
  })

  it('throws a usage error without both args', async () => {
    await expect(invoke(mark, ['167'])).rejects.toThrow(
      'Missing required positional argument: ACTION',
    )
  })

  it('marks in another mailbox with --mailbox', async () => {
    const result = await invoke(mark, ['167', 'read', '--mailbox', '[Gmail]/All Mail'])

    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('[Gmail]/All Mail')
    expect(result.mailbox).toBe('[Gmail]/All Mail')
  })

  it('throws when the message is not found', async () => {
    client.messageFlagsAdd.mockResolvedValue(false)

    await expect(invoke(mark, ['167', 'read'])).rejects.toThrow(
      'Could not mark UID 167 — not found in INBOX',
    )
  })
})
