import { defineCommand } from 'citty'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { configArg, mailboxArg } from '../lib/cli.js'

const label = defineCommand({
  meta: { name: 'label', description: 'Apply a Gmail label to a message' },
  args: {
    uid: { type: 'positional', required: true, description: 'Message UID' },
    name: { type: 'positional', required: true, description: 'Label name' },
    mailbox: mailboxArg,
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const { uid, name } = args
    const mailbox = args.mailbox ?? 'INBOX'

    return withClient(config, (client) =>
      withMailbox(client, mailbox, async () => {
        // A Gmail label is a mailbox: copying into it adds the label, leaving the
        // message in its source mailbox. Create it first if new (an existing label rejects).
        await client.mailboxCreate(name).catch(() => undefined)

        const copied = await client.messageCopy(uid, name, { uid: true })

        if (!copied) {
          throw new Error(`Could not apply label "${name}" — UID ${uid} not found in ${mailbox}`)
        }

        return { ok: true, uid: Number(uid), mailbox, label: name, applied: true }
      }),
    )
  },
})

export { label }
