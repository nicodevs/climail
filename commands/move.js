import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

export async function move(argv) {
  const { options, positionals } = parseArgs(argv, { flags: ['--config'] })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]
  const destination = positionals[1]

  if (!uid || !destination) throw new Error('Usage: emailcheck move <uid> <mailbox>')

  const result = await withClient(config, client => withInbox(client, async () => {
    // The destination must exist before a move; create it if it's new.
    try {
      await client.mailboxCreate(destination)
    } catch {
      // Already exists — nothing to do.
    }

    const moved = await client.messageMove(String(uid), destination, { uid: true })
    if (!moved) throw new Error(`Could not move UID ${uid} — not found in INBOX`)
    return { ok: true, uid: Number(uid), destination, moved: true }
  }))

  console.log(JSON.stringify(result, null, 2))
}
