import nodemailer from 'nodemailer'
import type { Config } from './config.js'

function createTransport(config: Config) {
  return nodemailer.createTransport({
    host: config.smtp.host ?? undefined,
    port: config.smtp.port,
    secure: config.smtp.secure,
    // Reuse the IMAP login unless SMTP has its own credentials (the usual Gmail app-password case).
    auth: {
      user: config.smtp.username ?? config.imap.username,
      pass: config.smtp.password ?? config.imap.password,
    },
  })
}

export { createTransport }
