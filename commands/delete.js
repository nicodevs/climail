import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

export async function deleteMessage(argv) {
  const { options, positionals } = parseArgs(argv, { flags: ['--config', '--from'] })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]
  const mailbox = options.from ?? 'INBOX'

  if (!uid) throw new Error('Usage: climail delete <uid> [--from <mailbox>]')

  const result = await withClient(config, client => withMailbox(client, mailbox, async () => {
    // On Gmail this moves the message to Trash rather than erasing it outright.
    const deleted = await client.messageDelete(String(uid), { uid: true })
    if (!deleted) throw new Error(`Could not delete UID ${uid} — not found in ${mailbox}`)
    return { ok: true, uid: Number(uid), mailbox, deleted: true }
  }))

  console.log(JSON.stringify(result, null, 2))
}
