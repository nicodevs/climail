import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedConfig } from '../lib/config.js'
import { findArchiveMailbox, withClient, withInbox } from '../lib/imap.js'
import { archive } from '../commands/archive.js'
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
  vi.mocked(findArchiveMailbox).mockResolvedValue('[Gmail]/All Mail')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('archive', () => {
  it('moves the message to the resolved archive mailbox', async () => {
    client.messageMove = vi.fn().mockResolvedValue({})
    const result = await invoke(archive, ['167'])

    expect(client.messageMove).toHaveBeenCalledWith('167', '[Gmail]/All Mail', { uid: true })
    expect(result).toEqual({
      ok: true,
      uid: 167,
      destination: '[Gmail]/All Mail',
      archived: true,
    })
  })

  it('throws a usage error without a uid', async () => {
    await expect(invoke(archive, [])).rejects.toThrow('Missing required positional argument: UID')
  })

  it('throws when the message is not found', async () => {
    client.messageMove = vi.fn().mockResolvedValue(false)

    await expect(invoke(archive, ['167'])).rejects.toThrow('Could not archive UID 167')
  })
})
