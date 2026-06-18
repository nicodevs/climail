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

// Lock INBOX for the duration of the callback, then release it.
async function withInbox(client, callback) {
  const lock = await client.getMailboxLock('INBOX')

  try {
    return await callback()
  } finally {
    lock.release()
  }
}

export { createClient, withClient, withInbox }
