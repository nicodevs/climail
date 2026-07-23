import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { createTransport } from '../lib/smtp.js'
import { findDraftsMailbox, withClient, withInbox, withMailbox } from '../lib/imap.js'
import { send } from '../commands/send.js'
import { CONFIG, CONFIG_NO_SMTP, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/smtp.js')
vi.mock('../lib/imap.js')
vi.mock('mailparser')

let client: any
let transport: any

beforeEach(() => {
  vi.clearAllMocks()
  client = { fetchOne: vi.fn(), messageDelete: vi.fn().mockResolvedValue(true) }
  transport = {
    sendMail: vi
      .fn()
      .mockResolvedValue({ messageId: '<sent-1>', accepted: ['a@b.com'], rejected: [] }),
  }
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(createTransport).mockReturnValue(transport)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
  vi.mocked(withInbox).mockImplementation((_client, cb) => cb())
  vi.mocked(withMailbox).mockImplementation((_client, _mailbox, cb) => cb())
  vi.mocked(findDraftsMailbox).mockResolvedValue('Drafts')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('send', () => {
  it('composes and sends a new message', async () => {
    const result = await invoke(send, ['--to', 'a@b.com', '--subject', 'Hi', '--body', 'Hello'])

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'me@example.com',
        to: 'a@b.com',
        subject: 'Hi',
        text: 'Hello',
      }),
    )
    expect(result).toMatchObject({
      ok: true,
      sent: 'compose',
      to: 'a@b.com',
      messageId: '<sent-1>',
      accepted: ['a@b.com'],
    })
  })

  it('threads a reply and carries In-Reply-To / References', async () => {
    client.fetchOne.mockResolvedValue({ source: Buffer.from('raw') })
    vi.mocked(simpleParser).mockResolvedValue({
      subject: 'Original',
      messageId: '<id-1>',
      references: ['<id-0>'],
    } as any)
    const result = await invoke(send, ['--to', 'a@b.com', '--reply-to', '167', '--body', 'On it'])

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Re: Original',
        inReplyTo: '<id-1>',
        references: ['<id-0>', '<id-1>'],
      }),
    )
    expect(result.sent).toBe('reply')
  })

  it('sends an existing draft and removes it', async () => {
    client.fetchOne.mockResolvedValue({ source: Buffer.from('raw') })
    vi.mocked(simpleParser).mockResolvedValue({
      to: { value: [{ address: 'a@b.com' }] },
      subject: 'Draft subject',
    } as any)
    const result = await invoke(send, ['--draft', '3'])

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        envelope: { from: 'me@example.com', to: ['a@b.com'] },
        raw: expect.anything(),
      }),
    )
    expect(client.messageDelete).toHaveBeenCalledWith('3', { uid: true })
    expect(result).toMatchObject({ sent: 'draft', draftUid: 3, draftDeleted: true })
  })

  it('rejects when SMTP is not configured', async () => {
    vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG_NO_SMTP)

    await expect(invoke(send, ['--to', 'a@b.com', '--body', 'hi'])).rejects.toThrow(
      'SMTP is not configured',
    )
  })

  it('rejects when no recipient is resolved', async () => {
    await expect(invoke(send, ['--body', 'hi'])).rejects.toThrow('npx climail send --to')
  })
})
