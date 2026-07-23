import { afterEach, describe, expect, it, vi } from 'vitest'
import nodemailer from 'nodemailer'
import { createTransport } from '../lib/smtp.js'
import { CONFIG, CONFIG_NO_SMTP } from './support.js'

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => 'TRANSPORT') } }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createTransport', () => {
  it('maps config into nodemailer options and authenticates with the IMAP account', () => {
    const transport = createTransport(CONFIG)

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'me@example.com', pass: 'pw' },
    })
    expect(transport).toBe('TRANSPORT')
  })

  it('uses SMTP credentials when set instead of the IMAP login', () => {
    createTransport({
      ...CONFIG,
      smtp: { ...CONFIG.smtp, username: 'smtp-user', password: 'smtp-pass' },
    })

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: 'smtp-user', pass: 'smtp-pass' } }),
    )
  })

  it('passes undefined (not null) when no SMTP host is set', () => {
    createTransport(CONFIG_NO_SMTP)

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: undefined }),
    )
  })
})
