import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

export async function list(argv) {
  const { options } = parseArgs(argv, {
    flags: ['--count', '--config'],
    booleans: ['--unread']
  })

  const config = loadValidatedConfig(options.config)
  const count = options.count !== undefined ? Number(options.count) : 10
  const unread = Boolean(options.unread)

  const result = await withClient(config, client => withInbox(client, async () => {
    const total = client.mailbox.exists
    const range = unread
      ? await client.search({ seen: false })
      : `${Math.max(1, total - count + 1)}:*`

    const messages = []
    if (!(Array.isArray(range) && range.length === 0)) {
      for await (const message of client.fetch(range, { uid: true, envelope: true, flags: true })) {
        messages.push({
          seq: message.seq,
          uid: message.uid,
          date: message.envelope.date ?? null,
          from: message.envelope.from?.[0]?.address ?? null,
          subject: message.envelope.subject ?? null,
          unread: !message.flags?.has('\\Seen')
        })
      }
    }

    const selected = unread ? messages : messages.slice(-count)
    return { ok: true, mailbox: 'INBOX', total, returned: selected.length, messages: selected }
  }))

  console.log(JSON.stringify(result, null, 2))
}
