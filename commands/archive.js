import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox, findArchiveMailbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

export async function archive(argv) {
  const { options, positionals } = parseArgs(argv, { flags: ['--config'] })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]

  if (!uid) throw new Error('Usage: climail archive <uid>')

  const result = await withClient(config, async client => {
    const destination = await findArchiveMailbox(client)

    return withInbox(client, async () => {
      // Moving out of INBOX archives the message: on Gmail it drops the Inbox
      // label while keeping the mail in All Mail, rather than trashing it.
      const moved = await client.messageMove(String(uid), destination, { uid: true })
      if (!moved) throw new Error(`Could not archive UID ${uid} — not found in INBOX`)
      return { ok: true, uid: Number(uid), destination, archived: true }
    })
  })

  console.log(JSON.stringify(result, null, 2))
}
