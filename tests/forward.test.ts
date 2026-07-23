import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { createTransport } from '../lib/smtp.js'
import { withClient, withInbox } from '../lib/imap.js'
import { forward } from '../commands/forward.js'
import { CONFIG, CONFIG_NO_SMTP, invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('../lib/smtp.js')
vi.mock('../lib/imap.js')
vi.mock('mailparser')

let client: any
let transport: any

beforeEach(() => {
  vi.clearAllMocks()
  client = { fetchOne: vi.fn().mockResolvedValue({ source: Buffer.from('raw') }) }
  transport = {
    sendMail: vi
      .fn()
      .mockResolvedValue({ messageId: '<fwd-1>', accepted: ['c@x.com'], rejected: [] }),
  }
  vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG)
  vi.mocked(createTransport).mockReturnValue(transport)
  vi.mocked(withClient).mockImplementation((_config, cb) => cb(client))
  vi.mocked(withInbox).mockImplementation((_client, cb) => cb())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('forward', () => {
  it('forwards the message with a quoted body and re-attached files', async () => {
    vi.mocked(simpleParser).mockResolvedValue({
      from: { value: [{ address: 'sender@x.com' }] },
      to: { value: [{ address: 'me@example.com' }] },
      subject: 'Report',
      date: new Date('2026-07-01T00:00:00.000Z'),
      text: 'the body',
      attachments: [
        { filename: 'r.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' },
      ],
    } as any)
    const result = await invoke(forward, ['167', '--to', 'c@x.com', '--body', 'FYI'])

    const sent = vi.mocked(transport.sendMail).mock.calls[0][0]

    expect(sent.to).toBe('c@x.com')
    expect(sent.subject).toBe('Fwd: Report')
    expect(sent.text).toContain('FYI')
    expect(sent.text).toContain('---------- Forwarded message ----------')
    expect(sent.text).toContain('From: sender@x.com')
    expect(sent.text).toContain('the body')
    expect(sent.attachments).toHaveLength(1)
    expect(result).toMatchObject({
      ok: true,
      forwarded: 167,
      to: 'c@x.com',
      subject: 'Fwd: Report',
      messageId: '<fwd-1>',
    })
  })

  it('rejects when SMTP is not configured', async () => {
    vi.mocked(loadValidatedConfig).mockReturnValue(CONFIG_NO_SMTP)

    await expect(invoke(forward, ['167', '--to', 'c@x.com'])).rejects.toThrow(
      'SMTP is not configured',
    )
  })

  it('throws a usage error without a uid and --to', async () => {
    await expect(invoke(forward, ['167'])).rejects.toThrow('Usage: npx climail forward')
  })

  it('throws when the message is not found', async () => {
    client.fetchOne.mockResolvedValue(false)

    await expect(invoke(forward, ['167', '--to', 'c@x.com'])).rejects.toThrow(
      'No message with UID 167',
    )
  })
})
