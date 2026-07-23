import { runCommand, type CommandDef } from 'citty'
import type { Config } from '../lib/config.js'

// A fully-populated config so command code paths that read imap/smtp fields work
// without touching the environment or a real config file.
const CONFIG: Config = {
  imap: {
    host: 'imap.example.com',
    port: 993,
    secure: true,
    username: 'me@example.com',
    password: 'pw',
  },
  smtp: { host: 'smtp.example.com', port: 465, secure: true, username: null, password: null },
}

// A config with SMTP disabled, to exercise the "SMTP is not configured" guards.
const CONFIG_NO_SMTP: Config = {
  imap: CONFIG.imap,
  smtp: { host: null, port: 465, secure: true, username: null, password: null },
}

// Parse the given raw argv through citty and return the command's result, exactly
// as the CLI would run it.
async function invoke(command: CommandDef<any>, rawArgs: string[] = []): Promise<any> {
  const { result } = await runCommand(command, { rawArgs })

  return result
}

// Wrap an array as the async iterator that client.fetch yields.
async function* asyncIter<T>(items: T[]) {
  for (const item of items) {
    yield item
  }
}

export { CONFIG, CONFIG_NO_SMTP, invoke, asyncIter }
