import { defineCommand } from 'citty'
import { simpleParser, type ParsedMail } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { createTransport } from '../lib/smtp.js'
import { withClient, withInbox } from '../lib/imap.js'
import { addresses } from '../lib/address.js'
import { configArg } from '../lib/cli.js'

function forwardSubject(subject: string | undefined) {
  const original = subject ?? ''

  return /^fwd:/i.test(original) ? original : `Fwd: ${original}`.trim()
}

function forwardBody(note: string | undefined, original: ParsedMail) {
  const header = [
    '---------- Forwarded message ----------',
    `From: ${addresses(original.from).join(', ')}`,
    `Date: ${original.date ? original.date.toISOString() : ''}`,
    `Subject: ${original.subject ?? ''}`,
    `To: ${addresses(original.to).join(', ')}`,
  ].join('\n')

  return `${note ? `${note}\n\n` : ''}${header}\n\n${original.text ?? ''}`
}

const forward = defineCommand({
  meta: { name: 'forward', description: 'Forward a message (keeps attachments)' },
  args: {
    uid: { type: 'positional', required: true, description: 'UID of the message to forward' },
    to: { type: 'string', description: 'Recipient address' },
    body: { type: 'string', description: 'Optional note to prepend' },
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const uid = args.uid

    if (!args.to) {
      throw new Error('Usage: npx climail forward <uid> --to <address> [--body "<note>"]')
    }

    if (!config.smtp.host) {
      throw new Error('SMTP is not configured. Add smtp.host to your config (npx climail init)')
    }

    const original = await withClient(config, (client) =>
      withInbox(client, async () => {
        const message = await client.fetchOne(uid, { source: true }, { uid: true })

        if (!message || !message.source) {
          throw new Error(`No message with UID ${uid} in INBOX`)
        }

        return simpleParser(message.source)
      }),
    )

    const attachments = (original.attachments ?? []).map((attachment) => ({
      filename: attachment.filename ?? undefined,
      content: attachment.content,
      contentType: attachment.contentType ?? undefined,
    }))

    const transport = createTransport(config)

    const info = await transport.sendMail({
      from: config.imap.username,
      to: args.to,
      subject: forwardSubject(original.subject),
      text: forwardBody(args.body, original),
      attachments: attachments.length ? attachments : undefined,
    })

    return {
      ok: true,
      forwarded: Number(uid),
      to: args.to,
      subject: forwardSubject(original.subject),
      attachments: attachments.map((attachment) => attachment.filename ?? null),
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    }
  },
})

export { forward }
