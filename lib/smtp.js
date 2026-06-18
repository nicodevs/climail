import nodemailer from 'nodemailer'

// Build an SMTP transport, authenticating with the same account credentials
// used for IMAP.
function createTransport(config) {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.imap.username, pass: config.imap.password }
  })
}

export { createTransport }
