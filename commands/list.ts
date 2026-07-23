import { defineCommand } from 'citty'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { parseCount, configArg, mailboxArg } from '../lib/cli.js'

const list = defineCommand({
  meta: { name: 'list', description: 'List recent messages as JSON' },
  args: {
    count: {
      type: 'string',
      valueHint: 'N',
      description: 'How many recent messages to return (default 10)',
    },
    unread: { type: 'boolean', description: 'Only unread messages' },
    mailbox: mailboxArg,
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const count = parseCount(args.count, 10)
    const unread = Boolean(args.unread)
    const mailbox = args.mailbox ?? 'INBOX'

    return withClient(config, (client) =>
      withMailbox(client, mailbox, async () => {
        const total = client.mailbox ? client.mailbox.exists : 0

        const range = unread
          ? (await client.search({ seen: false })) || []
          : `${Math.max(1, total - count + 1)}:*`

        const messages = []
        // A string range (e.g. "91:*") always fetches; a uid array only when non-empty.
        const hasRange = typeof range === 'string' || range.length > 0

        if (hasRange) {
          for await (const message of client.fetch(range, {
            uid: true,
            envelope: true,
            flags: true,
          })) {
            messages.push({
              seq: message.seq,
              uid: message.uid,
              date: message.envelope?.date ?? null,
              from: message.envelope?.from?.[0]?.address ?? null,
              subject: message.envelope?.subject ?? null,
              unread: !message.flags?.has('\\Seen'),
            })
          }
        }

        const selected = unread ? messages : messages.slice(-count)

        return { ok: true, mailbox, total, returned: selected.length, messages: selected }
      }),
    )
  },
})

export { list }
