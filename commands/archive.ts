import { defineCommand } from 'citty'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox, findArchiveMailbox } from '../lib/imap.js'
import { configArg } from '../lib/cli.js'

const archive = defineCommand({
  meta: {
    name: 'archive',
    description: 'Archive a message (Gmail: drops the Inbox label, keeps it)',
  },
  args: {
    uid: { type: 'positional', required: true, description: 'Message UID' },
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const uid = args.uid

    return withClient(config, async (client) => {
      const destination = await findArchiveMailbox(client)

      return withInbox(client, async () => {
        // On Gmail, moving out of INBOX just drops the Inbox label (kept in All Mail).
        const moved = await client.messageMove(uid, destination, { uid: true })

        if (!moved) {
          throw new Error(`Could not archive UID ${uid} — not found in INBOX`)
        }

        return { ok: true, uid: Number(uid), destination, archived: true }
      })
    })
  },
})

export { archive }
