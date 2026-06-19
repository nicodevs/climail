import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox, findDraftsMailbox } from '../lib/imap.js'
import { replySubject, replyMeta } from '../lib/reply.js'
import { parseArgs } from '../lib/args.js'

// Render a reply as a raw RFC822 message (Buffer) via nodemailer's composer.
function buildMime(mail) {
  return new Promise((resolve, reject) => {
    new MailComposer(mail).compile().build((error, message) => {
      if (error) reject(error)
      else resolve(message)
    })
  })
}

export async function draftReply(argv) {
  const { options, positionals } = parseArgs(argv, {
    flags: ['--body', '--config']
  })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]
  const body = options.body ?? ''

  if (!uid) throw new Error('Usage: climail draft-reply <uid> --body "<text>"')

  const result = await withClient(config, async client => {
    // Pull the original from the Inbox so we can thread the reply correctly.
    const original = await withInbox(client, async () => {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!message || !message.source) throw new Error(`No message with UID ${uid}`)
      return simpleParser(message.source)
    })

    const to = original.replyTo?.value?.[0]?.address ?? original.from?.value?.[0]?.address
    if (!to) throw new Error(`Could not determine a reply address for UID ${uid}`)

    const subject = replySubject(original.subject)
    const { inReplyTo, references } = replyMeta(original)
    const raw = await buildMime({ from: config.imap.username, to, subject, inReplyTo, references, text: body })

    // APPEND stages the message in Drafts. No SMTP — nothing is sent.
    const mailbox = await findDraftsMailbox(client)
    const appended = await client.append(mailbox, raw, ['\\Draft'])

    return {
      ok: true,
      draft: { mailbox, uid: appended?.uid ?? null },
      inReplyToUid: Number(uid),
      to,
      subject
    }
  })

  console.log(JSON.stringify(result, null, 2))
}
