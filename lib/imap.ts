import { ImapFlow } from 'imapflow'
import type { Config } from './config.js'

function createClient(config: Config): ImapFlow {
  return new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.imap.username, pass: config.imap.password },
    logger: false,
  })
}

async function withClient<T>(
  config: Config,
  callback: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = createClient(config)

  await client.connect()

  try {
    const result = await callback(client)

    await client.logout()

    return result
  } catch (error) {
    // Don't let a logout failure mask the error that got us here.
    await client.logout().catch(() => undefined)

    throw error
  }
}

async function withMailbox<T>(
  client: ImapFlow,
  mailbox: string,
  callback: () => Promise<T>,
): Promise<T> {
  const lock = await client.getMailboxLock(mailbox)

  try {
    return await callback()
  } finally {
    lock.release()
  }
}

async function withInbox<T>(client: ImapFlow, callback: () => Promise<T>): Promise<T> {
  return withMailbox(client, 'INBOX', callback)
}

async function findDraftsMailbox(client: ImapFlow): Promise<string> {
  const boxes = await client.list()
  const drafts = boxes.find((box) => box.specialUse === '\\Drafts')

  return drafts?.path ?? 'Drafts'
}

// Falls back to Gmail's "All Mail" (\All), where a move just drops the Inbox label.
async function findArchiveMailbox(client: ImapFlow): Promise<string> {
  const boxes = await client.list()
  const archive = boxes.find((box) => box.specialUse === '\\Archive')

  if (archive) {
    return archive.path
  }

  const all = boxes.find((box) => box.specialUse === '\\All')

  if (all) {
    return all.path
  }

  return 'Archive'
}

export { createClient, withClient, withMailbox, withInbox, findDraftsMailbox, findArchiveMailbox }
