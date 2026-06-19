import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

// Each action maps to adding or removing a single IMAP flag. "star"/"unstar"
// are aliases for flag/unflag (Gmail renders \Flagged as the star).
const ACTIONS = {
  read: { op: 'add', flag: '\\Seen' },
  unread: { op: 'remove', flag: '\\Seen' },
  flag: { op: 'add', flag: '\\Flagged' },
  unflag: { op: 'remove', flag: '\\Flagged' },
  star: { op: 'add', flag: '\\Flagged' },
  unstar: { op: 'remove', flag: '\\Flagged' }
}

export async function mark(argv) {
  const { options, positionals } = parseArgs(argv, { flags: ['--config'] })

  const config = loadValidatedConfig(options.config)
  const uid = positionals[0]
  const action = positionals[1]

  if (!uid || !action) {
    throw new Error('Usage: climail mark <uid> <read|unread|flag|unflag|star|unstar>')
  }

  const spec = ACTIONS[action]
  if (!spec) throw new Error(`Unknown action "${action}". Use: ${Object.keys(ACTIONS).join(', ')}`)

  const result = await withClient(config, client => withInbox(client, async () => {
    const changed = spec.op === 'add'
      ? await client.messageFlagsAdd(String(uid), [spec.flag], { uid: true })
      : await client.messageFlagsRemove(String(uid), [spec.flag], { uid: true })

    if (!changed) throw new Error(`Could not mark UID ${uid} — not found in INBOX`)

    return { ok: true, uid: Number(uid), action, flag: spec.flag, applied: true }
  }))

  console.log(JSON.stringify(result, null, 2))
}
