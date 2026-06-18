import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { simpleParser } from 'mailparser'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

async function collectAttachments(parsed, saveDir) {
  const attachments = []

  for (const attachment of parsed.attachments ?? []) {
    let saved = null
    if (saveDir) {
      await mkdir(saveDir, { recursive: true })
      const name = attachment.filename || `attachment-${attachments.length + 1}`
      const path = join(saveDir, name)
      await writeFile(path, attachment.content)
      saved = path
    }
    attachments.push({
      filename: attachment.filename ?? null,
      contentType: attachment.contentType ?? null,
      size: attachment.size ?? attachment.content?.length ?? null,
      cid: attachment.cid ?? null,
      saved
    })
  }

  return attachments
}

export async function read(argv) {
  const { options, positionals } = parseArgs(argv, {
    flags: ['--save-attachments', '--config']
  })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]
  const saveDir = options['save-attachments'] ?? null

  if (!uid) throw new Error('Usage: climail read <uid> [--save-attachments <dir>]')

  const result = await withClient(config, client => withInbox(client, async () => {
    const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
    if (!message || !message.source) throw new Error(`No message with UID ${uid}`)

    const parsed = await simpleParser(message.source)
    const attachments = await collectAttachments(parsed, saveDir)

    return {
      ok: true,
      uid: Number(uid),
      from: parsed.from?.value?.[0]?.address ?? null,
      to: parsed.to?.value?.map(value => value.address) ?? [],
      subject: parsed.subject ?? null,
      date: parsed.date ?? null,
      text: parsed.text ?? null,
      html: parsed.html || null,
      attachments
    }
  }))

  console.log(JSON.stringify(result, null, 2))
}
