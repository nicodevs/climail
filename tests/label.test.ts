import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { label } from '../commands/label.js'
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

describe('label', () => {
  it('creates the label and copies the message into it', async () => {
    client.mailboxCreate = vi.fn().mockResolvedValue({})
    client.messageCopy = vi.fn().mockResolvedValue({ uidMap: new Map() })
    const result = await invoke(label, ['167', 'Triaged'])

    expect(client.mailboxCreate).toHaveBeenCalledWith('Triaged')
    expect(client.messageCopy).toHaveBeenCalledWith('167', 'Triaged', { uid: true })
    expect(result).toEqual({
      ok: true,
      uid: 167,
      mailbox: 'INBOX',
      label: 'Triaged',
      applied: true,
    })
  })

  it('ignores a mailboxCreate failure for an existing label', async () => {
    client.mailboxCreate = vi.fn().mockRejectedValue(new Error('exists'))
    client.messageCopy = vi.fn().mockResolvedValue({})
    const result = await invoke(label, ['167', 'Triaged'])

    expect(result.applied).toBe(true)
  })

  it('throws a usage error without both args', async () => {
    await expect(invoke(label, ['167'])).rejects.toThrow(
      'Missing required positional argument: NAME',
    )
  })

  it('labels from another mailbox with --mailbox', async () => {
    client.mailboxCreate = vi.fn().mockResolvedValue({})
    client.messageCopy = vi.fn().mockResolvedValue({ uidMap: new Map() })
    const result = await invoke(label, ['167', 'Triaged', '--mailbox', '[Gmail]/All Mail'])

    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('[Gmail]/All Mail')
    expect(result.mailbox).toBe('[Gmail]/All Mail')
  })

  it('throws when the message is not found', async () => {
    client.mailboxCreate = vi.fn().mockResolvedValue({})
    client.messageCopy = vi.fn().mockResolvedValue(false)

    await expect(invoke(label, ['167', 'Triaged'])).rejects.toThrow(
      'Could not apply label "Triaged" — UID 167 not found in INBOX',
    )
  })
})
