import { defineCommand } from 'citty'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { configArg } from '../lib/cli.js'

const move = defineCommand({
  meta: { name: 'move', description: 'Move a message to another mailbox' },
  args: {
    uid: { type: 'positional', required: true, description: 'Message UID' },
    mailbox: { type: 'positional', required: true, description: 'Destination mailbox' },
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const { uid, mailbox: destination } = args

    return withClient(config, (client) =>
      withInbox(client, async () => {
        // Create is not idempotent in IMAP; ignore the rejection if it already exists.
        await client.mailboxCreate(destination).catch(() => undefined)

        const moved = await client.messageMove(uid, destination, { uid: true })

        if (!moved) {
          throw new Error(`Could not move UID ${uid} — not found in INBOX`)
        }

        return { ok: true, uid: Number(uid), destination, moved: true }
      }),
    )
  },
})

export { move }
