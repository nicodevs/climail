import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

function toArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function replySubject(subject) {
  const original = subject ?? ''
  return /^re:/i.test(original) ? original : `Re: ${original}`.trim()
}

// Render a reply as a raw RFC822 message (Buffer) via nodemailer's composer.
function buildMime(mail) {
  return new Promise((resolve, reject) => {
    new MailComposer(mail).compile().build((error, message) => {
      if (error) reject(error)
      else resolve(message)
    })
  })
}

// Locate the Drafts mailbox by its special-use flag, falling back to "Drafts".
async function findDraftsMailbox(client) {
  const boxes = await client.list()
  const drafts = boxes.find(box => box.specialUse === '\\Drafts')
  return drafts?.path ?? 'Drafts'
}

export async function draftReply(argv) {
  const { options, positionals } = parseArgs(argv, {
    flags: ['--body', '--config']
  })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]
  const body = options.body ?? ''

  if (!uid) throw new Error('Usage: emailcheck draft-reply <uid> --body "<text>"')

  const result = await withClient(config, async client => {
    // Pull the original from the Inbox so we can thread the reply correctly.
    const original = await withInbox(client, async () => {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!message || !message.source) throw new Error(`No message with UID ${uid}`)
      return simpleParser(message.source)
    })

    const to = original.replyTo?.value?.[0]?.address ?? original.from?.value?.[0]?.address
    if (!to) throw new Error(`Could not determine a reply address for UID ${uid}`)

    const references = [...toArray(original.references), original.messageId].filter(Boolean)
    const raw = await buildMime({
      from: config.imap.username,
      to,
      subject: replySubject(original.subject),
      inReplyTo: original.messageId,
      references,
      text: body
    })

    // APPEND stages the message in Drafts. No SMTP — nothing is sent.
    const mailbox = await findDraftsMailbox(client)
    const appended = await client.append(mailbox, raw, ['\\Draft'])

    return {
      ok: true,
      draft: { mailbox, uid: appended?.uid ?? null },
      inReplyToUid: Number(uid),
      to,
      subject: replySubject(original.subject)
    }
  })

  console.log(JSON.stringify(result, null, 2))
}
