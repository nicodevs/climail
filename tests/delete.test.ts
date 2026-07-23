import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { deleteMessage } from '../commands/delete.js'
import { CONFIG, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/imap.js')

let client: any

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

describe('delete', () => {
  it('deletes from INBOX by default', async () => {
    client.messageDelete = vi.fn().mockResolvedValue(true)

    const result = await invoke(deleteMessage, ['5'])

    expect(client.messageDelete).toHaveBeenCalledWith('5', { uid: true })
    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('INBOX')
    expect(result).toEqual({ ok: true, uid: 5, mailbox: 'INBOX', deleted: true })
  })

  it('honours --from for a different mailbox', async () => {
    client.messageDelete = vi.fn().mockResolvedValue(true)

    const result = await invoke(deleteMessage, ['5', '--from', 'Drafts'])

    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('Drafts')
    expect(result.mailbox).toBe('Drafts')
  })

  it('throws a usage error without a uid', async () => {
    await expect(invoke(deleteMessage, [])).rejects.toThrow(
      'Missing required positional argument: UID',
    )
  })

  it('throws when the message is not found', async () => {
    client.messageDelete = vi.fn().mockResolvedValue(false)

    await expect(invoke(deleteMessage, ['5'])).rejects.toThrow('Could not delete UID 5')
  })
})
