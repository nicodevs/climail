import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

export async function deleteMessage(argv) {
  const { options, positionals } = parseArgs(argv, { flags: ['--config'] })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]

  if (!uid) throw new Error('Usage: climail delete <uid>')

  const result = await withClient(config, client => withInbox(client, async () => {
    // On Gmail this moves the message to Trash rather than erasing it outright.
    const deleted = await client.messageDelete(String(uid), { uid: true })
    if (!deleted) throw new Error(`Could not delete UID ${uid} — not found in INBOX`)
    return { ok: true, uid: Number(uid), deleted: true }
  }))

  console.log(JSON.stringify(result, null, 2))
}
