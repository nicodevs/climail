import { defineCommand } from 'citty'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { configArg, mailboxArg } from '../lib/cli.js'

// "star"/"unstar" are aliases for flag/unflag — Gmail renders \Flagged as the star.
const ACTIONS: Record<string, { op: 'add' | 'remove'; flag: string }> = {
  read: { op: 'add', flag: '\\Seen' },
  unread: { op: 'remove', flag: '\\Seen' },
  flag: { op: 'add', flag: '\\Flagged' },
  unflag: { op: 'remove', flag: '\\Flagged' },
  star: { op: 'add', flag: '\\Flagged' },
  unstar: { op: 'remove', flag: '\\Flagged' },
}

const mark = defineCommand({
  meta: { name: 'mark', description: 'Set flags: read | unread | flag | unflag | star | unstar' },
  args: {
    uid: { type: 'positional', required: true, description: 'Message UID' },
    action: {
      type: 'positional',
      required: true,
      description: 'read | unread | flag | unflag | star | unstar',
    },
    mailbox: mailboxArg,
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const { uid, action } = args
    const mailbox = args.mailbox ?? 'INBOX'
    const spec = ACTIONS[action]

    if (!spec) {
      throw new Error(`Unknown action "${action}". Use: ${Object.keys(ACTIONS).join(', ')}`)
    }

    return withClient(config, (client) =>
      withMailbox(client, mailbox, async () => {
        const changed =
          spec.op === 'add'
            ? await client.messageFlagsAdd(uid, [spec.flag], { uid: true })
            : await client.messageFlagsRemove(uid, [spec.flag], { uid: true })

        if (!changed) {
          throw new Error(`Could not mark UID ${uid} — not found in ${mailbox}`)
        }

        return { ok: true, uid: Number(uid), mailbox, action, flag: spec.flag, applied: true }
      }),
    )
  },
})

export { mark }
