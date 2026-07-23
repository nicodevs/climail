import { defineCommand } from 'citty'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { configArg } from '../lib/cli.js'

const deleteMessage = defineCommand({
  meta: { name: 'delete', description: 'Delete a message (Gmail: moves to Trash)' },
  args: {
    uid: { type: 'positional', required: true, description: 'Message UID' },
    from: { type: 'string', description: 'Mailbox to delete from (default INBOX)' },
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const uid = args.uid
    const mailbox = args.from ?? 'INBOX'

    return withClient(config, (client) =>
      withMailbox(client, mailbox, async () => {
        // On Gmail this moves the message to Trash rather than erasing it outright.
        const deleted = await client.messageDelete(uid, { uid: true })

        if (!deleted) {
          throw new Error(`Could not delete UID ${uid} — not found in ${mailbox}`)
        }

        return { ok: true, uid: Number(uid), mailbox, deleted: true }
      }),
    )
  },
})

export { deleteMessage }
