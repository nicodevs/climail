import { defineCommand } from 'citty'
import type { SearchObject } from 'imapflow'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient, withMailbox } from '../lib/imap.js'
import { parseCount, configArg, mailboxArg } from '../lib/cli.js'

function toDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: "${value}"`)
  }

  return date
}

// With no criteria, fall back to "all" so the command still returns recent mail.
function buildQuery(options: {
  from?: string
  to?: string
  subject?: string
  body?: string
  text?: string
  since?: string
  before?: string
  unread?: boolean
}): SearchObject {
  const query: SearchObject = {}

  if (options.from) {
    query.from = options.from
  }

  if (options.to) {
    query.to = options.to
  }

  if (options.subject) {
    query.subject = options.subject
  }

  if (options.body) {
    query.body = options.body
  }

  if (options.text) {
    query.text = options.text
  }

  if (options.since) {
    query.since = toDate(options.since)
  }

  if (options.before) {
    query.before = toDate(options.before)
  }

  if (options.unread) {
    query.seen = false
  }

  return Object.keys(query).length ? query : { all: true }
}

function newestFirst(uids: number[], count: number) {
  return uids.slice(-count).reverse()
}

const search = defineCommand({
  meta: { name: 'search', description: 'Search a mailbox (default INBOX)' },
  args: {
    from: { type: 'string', description: 'Match the From address' },
    to: { type: 'string', description: 'Match the To address' },
    subject: { type: 'string', description: 'Match the subject' },
    body: { type: 'string', description: 'Match the body' },
    text: { type: 'string', description: 'Match anywhere in the message' },
    since: { type: 'string', valueHint: 'date', description: 'Only messages on/after this date' },
    before: { type: 'string', valueHint: 'date', description: 'Only messages before this date' },
    count: {
      type: 'string',
      valueHint: 'N',
      description: 'How many matches to return (default 25)',
    },
    unread: { type: 'boolean', description: 'Only unread messages' },
    mailbox: mailboxArg,
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const count = parseCount(args.count, 25)
    const query = buildQuery(args)
    const mailbox = args.mailbox ?? 'INBOX'

    return withClient(config, (client) =>
      withMailbox(client, mailbox, async () => {
        const uids = (await client.search(query, { uid: true })) || []

        const messages = []

        if (uids.length) {
          const wanted = newestFirst(uids, count)

          for await (const message of client.fetch(
            wanted,
            { uid: true, envelope: true, flags: true },
            { uid: true },
          )) {
            messages.push({
              seq: message.seq,
              uid: message.uid,
              date: message.envelope?.date ?? null,
              from: message.envelope?.from?.[0]?.address ?? null,
              subject: message.envelope?.subject ?? null,
              unread: !message.flags?.has('\\Seen'),
            })
          }
          // fetch() yields in mailbox order; restore newest-first to match `wanted`.
          messages.sort((a, b) => b.uid - a.uid)
        }

        return {
          ok: true,
          mailbox,
          query,
          matched: uids.length,
          returned: messages.length,
          messages,
        }
      }),
    )
  },
})

export { search }
