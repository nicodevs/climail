import { defineCommand } from 'citty'
import { loadValidatedConfig } from '../lib/config.js'
import { withClient } from '../lib/imap.js'
import { configArg } from '../lib/cli.js'

type LabelEntry = {
  path: string
  name: string
  specialUse: string | null
  subscribed: boolean | null
  messages?: number | null
  unseen?: number | null
}

const labels = defineCommand({
  meta: { name: 'labels', description: 'List labels/folders' },
  args: {
    counts: { type: 'boolean', description: 'Add message + unread totals per label' },
    config: configArg,
  },
  run: async ({ args }) => {
    const config = loadValidatedConfig(args.config)
    const withCounts = Boolean(args.counts)

    return withClient(config, async (client) => {
      const boxes = await client.list()

      const list: LabelEntry[] = []

      for (const box of boxes) {
        const entry: LabelEntry = {
          path: box.path,
          name: box.name,
          specialUse: box.specialUse ?? null,
          subscribed: box.subscribed ?? null,
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
  },
})

export { labels }
