#!/usr/bin/env node

import { init } from '../commands/init.js'
import { list } from '../commands/list.js'
import { read } from '../commands/read.js'
import { label } from '../commands/label.js'
import { draftReply } from '../commands/draft-reply.js'
import { send } from '../commands/send.js'
import { deleteMessage } from '../commands/delete.js'
import { move } from '../commands/move.js'

const command = process.argv[2]
const args = process.argv.slice(3)

const commands = {
  init,
  list: () => list(args),
  read: () => read(args),
  label: () => label(args),
  'draft-reply': () => draftReply(args),
  send: () => send(args),
  delete: () => deleteMessage(args),
  move: () => move(args)
}

async function main() {
  if (!command || !commands[command]) {
    console.log(`
Usage: climail <command>

Commands:
  init                  Setup wizard for IMAP credentials
  list                  List recent messages as JSON [--count N] [--unread]
  read <uid>            Fetch one message: body + attachments [--save-attachments <dir>]
  label <uid> <name>    Apply a Gmail label to a message
  draft-reply <uid>     Stage a threaded reply in Drafts [--body "<text>"]
  send                  Send mail (SMTP). New:   --to <addr> [--subject] [--body]
                        Reply:  --to <addr> --reply-to <uid> [--body]
                        Draft:  --draft <uid> (send an existing draft, then remove it)
  delete <uid>          Delete a message (Gmail: moves to Trash)
  move <uid> <mailbox>  Move a message to another mailbox

All commands accept --config <path> to point at a specific .env file
(defaults to .env in the current directory).

Examples:
  npx climail init
  npx climail list --unread
  npx climail read 167 --save-attachments ./att
  npx climail label 167 Triaged
  npx climail draft-reply 167 --body "Thanks, will do."
  npx climail send --to you@example.com --subject "Hi" --body "Hello"
  npx climail send --to them@example.com --reply-to 167 --body "On it."
  npx climail send --draft 3
  npx climail delete 167
  npx climail move 167 Archive
`)
    process.exit(command ? 1 : 0)
  }

  try {
    await commands[command]()
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
