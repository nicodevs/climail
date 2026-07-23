import { defineCommand } from 'citty'
import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import type { SendMailOptions } from 'nodemailer'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox, findDraftsMailbox } from '../lib/imap.js'
import { replySubject, replyMeta, replyTarget, replyAllRecipients } from '../lib/reply.js'
import { configArg } from '../lib/cli.js'

function buildMime(mail: SendMailOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    new MailComposer(mail).compile().build((error, message) => {
      if (error) {
        reject(error)
      } else {
        resolve(message)
      }
    })
  })
}

const draftReply = defineCommand({
  meta: { name: 'draft-reply', description: 'Stage a threaded reply in Drafts' },
  args: {
    uid: { type: 'positional', required: true, description: 'UID of the message to reply to' },
    body: { type: 'string', description: 'Reply body text' },
    all: { type: 'boolean', description: 'Reply to all original recipients' },
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const uid = args.uid
    const body = args.body ?? ''
    const replyAll = Boolean(args.all)

    return withClient(config, async (client) => {
      const original = await withInbox(client, async () => {
        const message = await client.fetchOne(uid, { source: true }, { uid: true })

        if (!message || !message.source) {
          throw new Error(`No message with UID ${uid}`)
        }

        return simpleParser(message.source)
      })

      const { to, cc } = replyAll
        ? replyAllRecipients(original, config.imap.username)
        : { to: replyTarget(original), cc: [] }
      if (!to) {
        throw new Error(`Could not determine a reply address for UID ${uid}`)
      }

      const subject = replySubject(original.subject)
      const { inReplyTo, references } = replyMeta(original)

      const raw = await buildMime({
        from: config.imap.username,
        to,
        cc: cc.length ? cc : undefined,
        subject,
        inReplyTo,
        references,
        text: body,
      })

      // APPEND stages the message in Drafts. No SMTP — nothing is sent.
      const mailbox = await findDraftsMailbox(client)
      const appended = await client.append(mailbox, raw, ['\\Draft'])

      return {
        ok: true,
        draft: { mailbox, uid: appended ? (appended.uid ?? null) : null },
        inReplyToUid: Number(uid),
        to,
        cc,
        replyAll,
        subject,
      }
    })
  },
})

export { draftReply }
