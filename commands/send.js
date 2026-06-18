import { loadValidatedConfig } from '../lib/config.js'
import { createTransport } from '../lib/smtp.js'
import { parseArgs } from '../lib/args.js'

export async function send(argv) {
  const { options } = parseArgs(argv, {
    flags: ['--to', '--subject', '--body', '--config']
  })

  const config = loadValidatedConfig(options.config)

  if (!config.smtp.host) {
    throw new Error('SMTP is not configured. Add SMTP_HOST (and optional SMTP_PORT) to your .env')
  }
  if (!options.to) {
    throw new Error('Usage: emailcheck send --to <address> --subject "<subject>" --body "<text>"')
  }

  const transport = createTransport(config)
  const info = await transport.sendMail({
    from: config.imap.username,
    to: options.to,
    subject: options.subject ?? '',
    text: options.body ?? ''
  })

  console.log(JSON.stringify({
    ok: true,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  }, null, 2))
}
