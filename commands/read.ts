import { defineCommand } from 'citty'
import { writeFile, mkdir } from 'fs/promises'
import { basename, join } from 'path'
import { simpleParser, type ParsedMail } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { addresses, firstAddress } from '../lib/address.js'
import { configArg, mailboxArg } from '../lib/cli.js'

// Attachment names are untrusted: strip to a bare filename so "../../.ssh/authorized_keys"
// can't escape saveDir. Normalize backslashes first, or basename() would keep them on POSIX.
function safeFilename(raw: string | undefined): string | null {
  if (!raw) {
    return null
  }

  const name = basename(raw.replaceAll('\\', '/'))

  return name === '.' || name === '..' ? null : name
}

async function collectAttachments(parsed: ParsedMail, saveDir: string | null) {
  const attachments = []

  for (const attachment of parsed.attachments ?? []) {
    let saved = null

    if (saveDir) {
      await mkdir(saveDir, { recursive: true })
      const name = safeFilename(attachment.filename) ?? `attachment-${attachments.length + 1}`
      const path = join(saveDir, name)

      await writeFile(path, attachment.content)
      saved = path
    }

    attachments.push({
      filename: attachment.filename ?? null,
      contentType: attachment.contentType ?? null,
      size: attachment.size ?? attachment.content?.length ?? null,
      cid: attachment.cid ?? null,
      saved,
    })
  }

  return attachments
}

const read = defineCommand({
  meta: { name: 'read', description: 'Fetch one message: body + attachments' },
  args: {
    uid: { type: 'positional', required: true, description: 'Message UID' },
    'save-attachments': {
      type: 'string',
      valueHint: 'dir',
      description: 'Save attachments to this directory',
    },
    mailbox: mailboxArg,
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const uid = args.uid
    const saveDir = args['save-attachments'] ?? null
    const mailbox = args.mailbox ?? 'INBOX'

    return withClient(config, (client) =>
      withMailbox(client, mailbox, async () => {
        const message = await client.fetchOne(uid, { source: true }, { uid: true })

        if (!message || !message.source) {
          throw new Error(`No message with UID ${uid} in ${mailbox}`)
        }

        const parsed = await simpleParser(message.source)
        const attachments = await collectAttachments(parsed, saveDir)

        return {
          ok: true,
          uid: Number(uid),
          mailbox,
          from: firstAddress(parsed.from),
          to: addresses(parsed.to),
          subject: parsed.subject ?? null,
          date: parsed.date ?? null,
          text: parsed.text ?? null,
          html: parsed.html || null,
          attachments,
        }
      }),
    )
  },
})

export { read }
