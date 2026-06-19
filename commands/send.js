import { basename } from 'path'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { createTransport } from '../lib/smtp.js'
import { withClient, withInbox, withMailbox, findDraftsMailbox } from '../lib/imap.js'
import { replySubject, replyMeta, replyAllRecipients } from '../lib/reply.js'
import { parseArgs } from '../lib/args.js'

// Split a comma-separated flag value into a trimmed, non-empty list.
function splitList(value) {
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

// --attach takes one or more comma-separated file paths; nodemailer reads each
// from disk and uses the file's base name as the attachment filename.
function buildAttachments(value) {
  return splitList(value).map(path => ({ filename: basename(path), path }))
}

// Send an existing draft as-is (its threading headers are preserved), then
// remove it from the Drafts mailbox.
async function sendDraft(config, transport, uid) {
  return withClient(config, async client => {
    const drafts = await findDraftsMailbox(client)

    const { raw, parsed } = await withMailbox(client, drafts, async () => {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!message || !message.source) throw new Error(`No draft with UID ${uid} in ${drafts}`)
      return { raw: message.source, parsed: await simpleParser(message.source) }
    })

    const to = parsed.to?.value?.map(value => value.address).filter(Boolean) ?? []
    const info = await transport.sendMail({ envelope: { from: config.imap.username, to }, raw })

    await withMailbox(client, drafts, () => client.messageDelete(String(uid), { uid: true }))

    return {
      ok: true,
      sent: 'draft',
      draftUid: Number(uid),
      to,
      subject: parsed.subject ?? null,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      draftDeleted: true
    }
  })
}

// Compose and send a new message. With --reply-to, thread it under an Inbox
// message by carrying its In-Reply-To / References headers.
async function sendCompose(config, transport, options) {
  let meta = {}
  let subject = options.subject ?? ''
  let to = options.to
  let cc = splitList(options.cc)

  if (options['reply-to']) {
    const original = await withClient(config, client => withInbox(client, async () => {
      const message = await client.fetchOne(String(options['reply-to']), { source: true }, { uid: true })
      if (!message || !message.source) throw new Error(`No message with UID ${options['reply-to']} in INBOX`)
      return simpleParser(message.source)
    }))
    meta = replyMeta(original)
    if (!options.subject) subject = replySubject(original.subject)
    // --all derives the recipient set from the original (To = sender, Cc =
    // everyone else). An explicit --to/--cc still wins / adds on top.
    if (options.all) {
      const recipients = replyAllRecipients(original, config.imap.username)
      to = to ?? recipients.to
      cc = [...new Set([...cc, ...recipients.cc])]
    }
  }

  if (!to) {
    throw new Error('Usage: climail send --to <address> [--subject] [--body] [--reply-to <uid>] [--all]  |  --draft <uid>')
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
    references: meta.references
  })

  return {
    ok: true,
    sent: options['reply-to'] ? 'reply' : 'compose',
    to,
    cc,
    bcc,
    subject,
    attachments: attachments.map(attachment => attachment.filename),
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  }
}

export async function send(argv) {
  const { options } = parseArgs(argv, {
    flags: ['--to', '--cc', '--bcc', '--subject', '--body', '--html', '--attach', '--reply-to', '--draft', '--config'],
    booleans: ['--all']
  })

  const config = loadValidatedConfig(options.config)

  if (!config.smtp.host) {
    throw new Error('SMTP is not configured. Add SMTP_HOST (and optional SMTP_PORT) to your .env')
  }

  const transport = createTransport(config)
  const result = options.draft
    ? await sendDraft(config, transport, options.draft)
    : await sendCompose(config, transport, options)

  console.log(JSON.stringify(result, null, 2))
}
