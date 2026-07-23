import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { findDraftsMailbox, withClient, withInbox } from '../lib/imap.js'
import { draftReply } from '../commands/draft-reply.js'
import { CONFIG, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/imap.js')
vi.mock('mailparser')
vi.mock('nodemailer/lib/mail-composer/index.js', () => ({
  default: class {
    compile() {
      return {
        build: (cb: (err: Error | null, buf: Buffer) => void) => cb(null, Buffer.from('mime')),
      }
    }
  },
}))

let client: any

beforeEach(() => {
  vi.clearAllMocks()
  client = {
    fetchOne: vi.fn().mockResolvedValue({ source: Buffer.from('raw') }),
    append: vi.fn().mockResolvedValue({ uid: 7 }),
  }
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
  vi.mocked(withInbox).mockImplementation((_client, cb) => cb())
  vi.mocked(findDraftsMailbox).mockResolvedValue('Drafts')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('draft-reply', () => {
  it('stages a threaded reply to the sender in Drafts', async () => {
    vi.mocked(simpleParser).mockResolvedValue({
      from: { value: [{ address: 'sender@x.com' }] },
      subject: 'Hello',
      messageId: '<id-1>',
      references: [],
    } as any)
    const result = await invoke(draftReply, ['167', '--body', 'Thanks'])

    expect(client.append).toHaveBeenCalledWith('Drafts', expect.anything(), ['\\Draft'])
    expect(result).toEqual({
      ok: true,
      draft: { mailbox: 'Drafts', uid: 7 },
      inReplyToUid: 167,
      to: 'sender@x.com',
      cc: [],
      replyAll: false,
      subject: 'Re: Hello',
    })
  })

  it('builds a reply-all recipient set with --all', async () => {
    vi.mocked(simpleParser).mockResolvedValue({
      from: { value: [{ address: 'sender@x.com' }] },
      to: { value: [{ address: 'me@example.com' }, { address: 'alice@x.com' }] },
      cc: { value: [{ address: 'bob@x.com' }] },
      subject: 'Hello',
      messageId: '<id-1>',
    } as any)
    const result = await invoke(draftReply, ['167', '--all', '--body', 'Thanks'])

    const out = result

    expect(out.to).toBe('sender@x.com')
    expect(out.cc).toEqual(['alice@x.com', 'bob@x.com'])
    expect(out.replyAll).toBe(true)
  })

  it('throws when no reply address can be determined', async () => {
    vi.mocked(simpleParser).mockResolvedValue({ subject: 'Hello' } as any)

    await expect(invoke(draftReply, ['167', '--body', 'hi'])).rejects.toThrow(
      'Could not determine a reply address',
    )
  })

  it('throws a usage error without a uid', async () => {
    await expect(invoke(draftReply, [])).rejects.toThrow(
      'Missing required positional argument: UID',
    )
  })
})
