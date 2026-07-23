import { defineCommand } from 'citty'
import { basename } from 'path'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig, type Config } from '../lib/config.js'
import { createTransport } from '../lib/smtp.js'
import { withClient, withInbox, withMailbox, findDraftsMailbox } from '../lib/imap.js'
import { addresses } from '../lib/address.js'
import { replySubject, replyMeta, replyAllRecipients } from '../lib/reply.js'
import { configArg } from '../lib/cli.js'

type Transport = ReturnType<typeof createTransport>

type SendOptions = {
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  html?: string
  attach?: string
  'reply-to'?: string
  draft?: string
  all?: boolean
}

function splitList(value: string | undefined) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

// Passing { path } lets nodemailer read each file from disk itself.
function buildAttachments(value: string | undefined) {
  return splitList(value).map((path) => ({ filename: basename(path), path }))
}

async function sendDraft(config: Config, transport: Transport, uid: string) {
  return withClient(config, async (client) => {
    const drafts = await findDraftsMailbox(client)

    const { raw, parsed } = await withMailbox(client, drafts, async () => {
      const message = await client.fetchOne(uid, { source: true }, { uid: true })

      if (!message || !message.source) {
        throw new Error(`No draft with UID ${uid} in ${drafts}`)
      }

      return { raw: message.source, parsed: await simpleParser(message.source) }
    })

    const to = addresses(parsed.to)
    const info = await transport.sendMail({ envelope: { from: config.imap.username, to }, raw })

    await withMailbox(client, drafts, () => client.messageDelete(uid, { uid: true }))

    return {
      ok: true,
      sent: 'draft',
      draftUid: Number(uid),
      to,
      subject: parsed.subject ?? null,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      draftDeleted: true,
    }
  })
}

async function sendCompose(config: Config, transport: Transport, options: SendOptions) {
  let meta: { inReplyTo?: string; references?: string[] } = {}
  let subject = options.subject ?? ''
  let to = options.to
  let cc = splitList(options.cc)

  if (options['reply-to']) {
    const replyToUid = options['reply-to']

    const original = await withClient(config, (client) =>
      withInbox(client, async () => {
        const message = await client.fetchOne(replyToUid, { source: true }, { uid: true })

        if (!message || !message.source) {
          throw new Error(`No message with UID ${replyToUid} in INBOX`)
        }

        return simpleParser(message.source)
      }),
    )
    meta = replyMeta(original)
    if (!options.subject) {
      subject = replySubject(original.subject)
    }
    // --all builds recipients from the original: sender in To, everyone else in Cc.
    // An explicit --to/--cc still takes precedence.
    if (options.all) {
      const recipients = replyAllRecipients(original, config.imap.username)

      to = to ?? recipients.to ?? undefined
      cc = [...new Set([...cc, ...recipients.cc])]
    }
  }

  if (!to) {
    throw new Error(
      'Usage: npx climail send --to <address> [--subject] [--body] [--reply-to <uid>] [--all]  |  --draft <uid>',
    )
  }

  const bcc = splitList(options.bcc)
  const attachments = buildAttachments(options.attach)

  const info = await transport.sendMail({
    from: config.imap.username,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    text: options.body ?? '',
    html: options.html || undefined,
    attachments: attachments.length ? attachments : undefined,
    inReplyTo: meta.inReplyTo,
    references: meta.references,
  })

  return {
    ok: true,
    sent: options['reply-to'] ? 'reply' : 'compose',
    to,
    cc,
    bcc,
    subject,
    attachments: attachments.map((attachment) => attachment.filename),
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  }
}

const send = defineCommand({
  meta: { name: 'send', description: 'Send mail (SMTP); compose, reply, or send a draft' },
  args: {
    to: { type: 'string', description: 'Recipient address' },
    cc: { type: 'string', description: 'Cc addresses (comma-separated)' },
    bcc: { type: 'string', description: 'Bcc addresses (comma-separated)' },
    subject: { type: 'string', description: 'Subject line' },
    body: { type: 'string', description: 'Plain-text body' },
    html: { type: 'string', description: 'HTML body' },
    attach: { type: 'string', description: 'Files to attach (comma-separated paths)' },
    'reply-to': { type: 'string', valueHint: 'uid', description: 'Reply to this message UID' },
    draft: {
      type: 'string',
      valueHint: 'uid',
      description: 'Send an existing draft, then remove it',
    },
    all: { type: 'boolean', description: 'With --reply-to, reply to all recipients' },
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)

    if (!config.smtp.host) {
      throw new Error('SMTP is not configured. Add smtp.host to your config (npx climail init)')
    }

    const transport = createTransport(config)

    const options: SendOptions = {
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      subject: args.subject,
      body: args.body,
      html: args.html,
      attach: args.attach,
      'reply-to': args['reply-to'],
      draft: args.draft,
      all: Boolean(args.all),
    }

    return options.draft
      ? sendDraft(config, transport, options.draft)
      : sendCompose(config, transport, options)
  },
})

export { send }
