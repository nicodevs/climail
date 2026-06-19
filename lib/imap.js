import { ImapFlow } from 'imapflow'

function createClient(config) {
  return new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.imap.username, pass: config.imap.password },
    logger: false
  })
}

// Connect, run the callback, and always log out — even on failure.
async function withClient(config, callback) {
  const client = createClient(config)
  await client.connect()

  try {
    return await callback(client)
  } finally {
    await client.logout()
  }
}

// Lock a mailbox for the duration of the callback, then release it.
async function withMailbox(client, mailbox, callback) {
  const lock = await client.getMailboxLock(mailbox)

  try {
    return await callback()
  } finally {
    lock.release()
  }
}

async function withInbox(client, callback) {
  return withMailbox(client, 'INBOX', callback)
}

// Locate the Drafts mailbox by its special-use flag, falling back to "Drafts".
async function findDraftsMailbox(client) {
  const boxes = await client.list()
  const drafts = boxes.find(box => box.specialUse === '\\Drafts')
  return drafts?.path ?? 'Drafts'
}

export { createClient, withClient, withMailbox, withInbox, findDraftsMailbox }
