import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

export async function label(argv) {
  const { options, positionals } = parseArgs(argv, { flags: ['--config'] })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]
  const name = positionals[1]

  if (!uid || !name) throw new Error('Usage: climail label <uid> <name>')

  const result = await withClient(config, client => withInbox(client, async () => {
    // A Gmail label is a mailbox; copying the message into it adds the label
    // (the message stays in the Inbox). Create it first if it's new.
    try {
      await client.mailboxCreate(name)
    } catch {
      // Already exists — nothing to do.
    }

    const copied = await client.messageCopy(String(uid), name, { uid: true })
    if (!copied) throw new Error(`Could not apply label "${name}" — UID ${uid} not found in INBOX`)

    return { ok: true, uid: Number(uid), label: name, applied: true }
  }))

  console.log(JSON.stringify(result, null, 2))
}
