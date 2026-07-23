#!/usr/bin/env node

import { defineCommand, runCommand, showUsage, type CommandDef } from 'citty'
import { init } from '../commands/init.js'
import { list } from '../commands/list.js'
import { search } from '../commands/search.js'
import { labels } from '../commands/labels.js'
import { read } from '../commands/read.js'
import { label } from '../commands/label.js'
import { mark } from '../commands/mark.js'
import { draftReply } from '../commands/draft-reply.js'
import { send } from '../commands/send.js'
import { forward } from '../commands/forward.js'
import { archive } from '../commands/archive.js'
import { deleteMessage } from '../commands/delete.js'
import { move } from '../commands/move.js'

const subCommands: Record<string, CommandDef<any>> = {
  init,
  list,
  search,
  labels,
  read,
  label,
  mark,
  'draft-reply': draftReply,
  send,
  forward,
  archive,
  delete: deleteMessage,
  move,
}

const main = defineCommand({
  meta: { name: 'climail', description: 'IMAP/SMTP email from the command line, as JSON' },
  subCommands,
})

async function run() {
  const argv = process.argv.slice(2)
  const [name, ...rest] = argv
  const command = name ? subCommands[name] : undefined
  const wantsHelp = argv.includes('--help') || argv.includes('-h')

  if (!command) {
    await showUsage(main)
    process.exit(name ? 1 : 0)
  }

  if (wantsHelp) {
    await showUsage(command, main)

    return
  }

  // Data commands return a value to print as JSON; init runs its own UI and returns nothing.
  const { result } = await runCommand(command, { rawArgs: rest })

  if (result !== undefined) {
    console.log(JSON.stringify(result, null, 2))
  }
}

// One-line error for scripted callers, not citty's default stack dump.
run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
