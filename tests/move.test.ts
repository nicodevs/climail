import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { move } from '../commands/move.js'
import { CONFIG, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/imap.js')

let client: any

beforeEach(() => {
  vi.clearAllMocks()
  client = {}
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
  vi.mocked(withInbox).mockImplementation((_client, cb) => cb())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('move', () => {
  it('creates the destination and moves the message', async () => {
    client.mailboxCreate = vi.fn().mockResolvedValue({})
    client.messageMove = vi.fn().mockResolvedValue({})
    const result = await invoke(move, ['167', 'Receipts'])

    expect(client.mailboxCreate).toHaveBeenCalledWith('Receipts')
    expect(client.messageMove).toHaveBeenCalledWith('167', 'Receipts', { uid: true })
    expect(result).toEqual({ ok: true, uid: 167, destination: 'Receipts', moved: true })
  })

  it('ignores a mailboxCreate failure for an existing mailbox', async () => {
    client.mailboxCreate = vi.fn().mockRejectedValue(new Error('exists'))
    client.messageMove = vi.fn().mockResolvedValue({})
    const result = await invoke(move, ['167', 'Receipts'])

    expect(result.moved).toBe(true)
  })

  it('throws a usage error without both args', async () => {
    await expect(invoke(move, ['167'])).rejects.toThrow(
      'Missing required positional argument: MAILBOX',
    )
  })

  it('throws when the message is not found', async () => {
    client.mailboxCreate = vi.fn().mockResolvedValue({})
    client.messageMove = vi.fn().mockResolvedValue(false)

    await expect(invoke(move, ['167', 'Receipts'])).rejects.toThrow('Could not move UID 167')
  })
})
