import { loadValidatedConfig } from '../lib/config.js'
import { withClient } from '../lib/imap.js'
import { parseArgs } from '../lib/args.js'

export async function labels(argv) {
  const { options } = parseArgs(argv, { flags: ['--config'], booleans: ['--counts'] })

  const config = loadValidatedConfig(options.config)
  const withCounts = Boolean(options.counts)

  const result = await withClient(config, async client => {
    const boxes = await client.list()

    const list = []
    for (const box of boxes) {
      const entry = {
        path: box.path,
        name: box.name,
        specialUse: box.specialUse ?? null,
        subscribed: box.subscribed ?? null
      }
      // --counts adds a STATUS round trip per label (total + unread).
      if (withCounts) {
        const status = await client.status(box.path, { messages: true, unseen: true })
        entry.messages = status.messages ?? null
        entry.unseen = status.unseen ?? null
      }
      list.push(entry)
    }

    return { ok: true, count: list.length, labels: list }
  })

  console.log(JSON.stringify(result, null, 2))
}
