import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { createTransport } from '../lib/smtp.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

// "Fwd: " prefix without doubling it up.
function forwardSubject(subject) {
  const original = subject ?? ''
  return /^fwd:/i.test(original) ? original : `Fwd: ${original}`.trim()
}

function addresses(field) {
  return field?.value?.map(value => value.address).filter(Boolean) ?? []
}

// Build the quoted forward body: an optional note above the standard
// "Forwarded message" header block and the original plain-text body.
function forwardBody(note, original) {
  const header = [
    '---------- Forwarded message ----------',
    `From: ${addresses(original.from).join(', ')}`,
    `Date: ${original.date ? original.date.toISOString() : ''}`,
    `Subject: ${original.subject ?? ''}`,
    `To: ${addresses(original.to).join(', ')}`
  ].join('\n')

  return `${note ? `${note}\n\n` : ''}${header}\n\n${original.text ?? ''}`
}

export async function forward(argv) {
  const { options, positionals } = parseArgs(argv, {
    flags: ['--to', '--body', '--config']
  })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]

  if (!uid || !options.to) throw new Error('Usage: climail forward <uid> --to <address> [--body "<note>"]')
  if (!config.smtp.host) {
    throw new Error('SMTP is not configured. Add SMTP_HOST (and optional SMTP_PORT) to your .env')
  }

  const original = await withClient(config, client => withInbox(client, async () => {
    const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
    if (!message || !message.source) throw new Error(`No message with UID ${uid} in INBOX`)
    return simpleParser(message.source)
  }))

  // Re-attach the original's attachments by their decoded content.
  const attachments = (original.attachments ?? []).map(attachment => ({
    filename: attachment.filename ?? undefined,
    content: attachment.content,
    contentType: attachment.contentType ?? undefined
  }))

  const transport = createTransport(config)
  const info = await transport.sendMail({
    from: config.imap.username,
    to: options.to,
    subject: forwardSubject(original.subject),
    text: forwardBody(options.body, original),
    attachments: attachments.length ? attachments : undefined
  })

  console.log(JSON.stringify({
    ok: true,
    forwarded: Number(uid),
    to: options.to,
    subject: forwardSubject(original.subject),
    attachments: attachments.map(attachment => attachment.filename ?? null),
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  }, null, 2))
}
