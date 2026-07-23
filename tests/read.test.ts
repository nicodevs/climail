import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, writeFile } from 'fs/promises'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { read } from '../commands/read.js'
import { CONFIG, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/imap.js')
vi.mock('fs/promises')
vi.mock('mailparser')

let client: any

beforeEach(() => {
  vi.clearAllMocks()
  client = { fetchOne: vi.fn().mockResolvedValue({ source: Buffer.from('raw') }) }
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
  vi.mocked(withMailbox).mockImplementation((_client, _mailbox, cb) => cb())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('read', () => {
  it('returns the parsed message as JSON', async () => {
    vi.mocked(simpleParser).mockResolvedValue({
      from: { value: [{ address: 'sender@x.com' }] },
      to: { value: [{ address: 'me@x.com' }] },
      subject: 'Hello',
      date: undefined,
      text: 'body text',
      html: '<p>body</p>',
      attachments: [],
    } as any)
    const result = await invoke(read, ['167'])

    expect(client.fetchOne).toHaveBeenCalledWith('167', { source: true }, { uid: true })
    expect(result).toEqual({
      ok: true,
      uid: 167,
      mailbox: 'INBOX',
      from: 'sender@x.com',
      to: ['me@x.com'],
      subject: 'Hello',
      date: null,
      text: 'body text',
      html: '<p>body</p>',
      attachments: [],
    })
  })

  it('saves attachments to disk when --save-attachments is set', async () => {
    vi.mocked(simpleParser).mockResolvedValue({
      from: { value: [{ address: 'sender@x.com' }] },
      attachments: [
        {
          filename: 'a.pdf',
          content: Buffer.from('pdf'),
          contentType: 'application/pdf',
          size: 3,
          cid: null,
        },
      ],
    } as any)
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)
    const result = await invoke(read, ['167', '--save-attachments', './att'])

    expect(mkdir).toHaveBeenCalledWith('./att', { recursive: true })
    expect(writeFile).toHaveBeenCalledWith('att/a.pdf', expect.anything())
    expect(result.attachments[0]).toMatchObject({
      filename: 'a.pdf',
      contentType: 'application/pdf',
      size: 3,
      saved: 'att/a.pdf',
    })
  })

  it('sanitizes a traversal filename before writing', async () => {
    vi.mocked(simpleParser).mockResolvedValue({
      from: { value: [{ address: 'sender@x.com' }] },
      attachments: [
        {
          filename: '../../.ssh/authorized_keys',
          content: Buffer.from('x'),
          contentType: 'text/plain',
          size: 1,
          cid: null,
        },
      ],
    } as any)
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)
    const result = await invoke(read, ['167', '--save-attachments', './att'])

    expect(writeFile).toHaveBeenCalledWith('att/authorized_keys', expect.anything())
    expect(result.attachments[0].saved).toBe('att/authorized_keys')
  })

  it('reads from another mailbox with --mailbox', async () => {
    vi.mocked(simpleParser).mockResolvedValue({
      from: { value: [{ address: 'sender@x.com' }] },
      attachments: [],
    } as any)
    const result = await invoke(read, ['167', '--mailbox', '[Gmail]/All Mail'])

    expect(vi.mocked(withMailbox).mock.calls[0]?.[1]).toBe('[Gmail]/All Mail')
    expect(result.mailbox).toBe('[Gmail]/All Mail')
  })

  it('throws when the message is not found', async () => {
    client.fetchOne.mockResolvedValue(false)

    await expect(invoke(read, ['167'])).rejects.toThrow('No message with UID 167 in INBOX')
  })

  it('throws a usage error without a uid', async () => {
    await expect(invoke(read, [])).rejects.toThrow('Missing required positional argument: UID')
  })
})
