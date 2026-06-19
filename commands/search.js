import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withInbox } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

// Parse a --since/--before value into a Date the IMAP server understands.
function toDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: "${value}"`)
  return date
}

// Build an imapflow search query from the provided flags. With no criteria we
// fall back to "all" so the command still returns the most recent messages.
function buildQuery(options) {
  const query = {}
  if (options.from) query.from = options.from
  if (options.to) query.to = options.to
  if (options.subject) query.subject = options.subject
  if (options.body) query.body = options.body
  if (options.text) query.text = options.text
  if (options.since) query.since = toDate(options.since)
  if (options.before) query.before = toDate(options.before)
  if (options.unread) query.seen = false
  return Object.keys(query).length ? query : { all: true }
}

export async function search(argv) {
  const { options } = parseArgs(argv, {
    flags: ['--from', '--to', '--subject', '--body', '--text', '--since', '--before', '--count', '--config'],
    booleans: ['--unread']
  })

  const config = loadValidatedConfig(options.config)
  const count = options.count !== undefined ? Number(options.count) : 25
  const query = buildQuery(options)

  const result = await withClient(config, client => withInbox(client, async () => {
    const uids = await client.search(query, { uid: true })

    const messages = []
    if (uids.length) {
      // Newest first, capped at --count, then fetch envelopes for the hits.
      const wanted = uids.slice(-count).reverse()
      for await (const message of client.fetch(wanted, { uid: true, envelope: true, flags: true }, { uid: true })) {
        messages.push({
          seq: message.seq,
          uid: message.uid,
          date: message.envelope.date ?? null,
          from: message.envelope.from?.[0]?.address ?? null,
          subject: message.envelope.subject ?? null,
          unread: !message.flags?.has('\\Seen')
        })
      }
      // fetch() yields in mailbox order; restore newest-first to match `wanted`.
      messages.sort((a, b) => b.uid - a.uid)
    }

    return { ok: true, mailbox: 'INBOX', query, matched: uids.length, returned: messages.length, messages }
  }))

  console.log(JSON.stringify(result, null, 2))
}
