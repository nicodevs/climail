import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { ImapFlow } from 'imapflow'
import { parseFile } from 'rc9'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const confPath = resolve(here, 'climail.conf')
const binPath = resolve(here, '../../dist/climail.mjs')
const hasConf = existsSync(confPath)

// Drive the built CLI as a real user would — one process per command — and parse
// its JSON stdout. This is the only test layer that exercises live IMAP/SMTP.
async function climail(...args: string[]): Promise<any> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [binPath, ...args, '--config', confPath],
    { timeout: 60_000 },
  )

  return stdout.trim() ? JSON.parse(stdout) : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}

// A message sent to yourself can take a few seconds to land, so poll the inbox
// for the unique subject rather than reading immediately after send.
async function waitForUid(subject: string): Promise<number> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { messages } = await climail('search', '--subject', subject)

    if (messages[0]) {
      return messages[0].uid
    }

    await sleep(2000)
  }

  throw new Error(`Message "${subject}" never arrived`)
}

// climail has no command to remove a label/folder or to reach mail that moved out
// of INBOX, so tear those down over a direct IMAP connection: drop the test
// mailboxes (on Gmail this just unlabels), then trash every message tagged with
// this run's token from INBOX and All Mail.
async function teardown(token: string, mailboxes: string[]): Promise<void> {
  const { imap } = parseFile(confPath)

  const client = new ImapFlow({
    host: String(imap.host),
    port: Number(imap.port),
    secure: imap.secure !== false,
    auth: { user: String(imap.username), pass: String(imap.password) },
    logger: false,
  })

  await client.connect()

  try {
    for (const name of mailboxes) {
      await client.mailboxDelete(name).catch(() => undefined)
    }

    const boxes = await client.list()
    const allMail = boxes.find((box) => box.specialUse === '\\All')?.path
    const targets = ['INBOX', allMail].filter((box): box is string => Boolean(box))

    for (const box of targets) {
      const lock = await client.getMailboxLock(box)

      try {
        const uids = await client.search({ subject: token }, { uid: true })

        if (uids && uids.length) {
          await client.messageDelete(uids, { uid: true })
        }
      } finally {
        lock.release()
      }
    }
  } finally {
    await client.logout()
  }
}

// Without a config these tests are skipped, so the default suite stays green for
// anyone who hasn't opted in. `npm run test:e2e` surfaces the missing file.
describe('e2e prerequisites', () => {
  it('has a config at tests/e2e/climail.conf', () => {
    expect(hasConf, 'Create tests/e2e/climail.conf — see climail.conf.example').toBe(true)
  })
})

describe.runIf(hasConf)('mailbox lifecycle', () => {
  const stamp = Date.now()
  const token = `e2e-${stamp}`
  const subject = `climail ${token}`
  const labelName = `climail-test-${stamp}`
  const folderName = `climail-box-${stamp}`
  let self: string
  let uid = 0
  let draft: { uid: number; mailbox: string } | null = null

  beforeAll(() => {
    self = String(parseFile(confPath).imap.username)
  })

  // The token sweep clears every message this run created — including any left
  // behind by a failed step and the copies moved out of INBOX by move/archive.
  afterAll(async () => {
    await teardown(token, [labelName, folderName]).catch(() => undefined)
  })

  it('lists mailboxes', async () => {
    const result = await climail('labels')

    expect(result.ok).toBe(true)
    expect(result.count).toBeGreaterThan(0)
  })

  it('lists the inbox', async () => {
    const result = await climail('list')

    expect(result.ok).toBe(true)
    expect(result.mailbox).toBe('INBOX')
  })

  it('sends a message to self', async () => {
    const sent = await climail(
      'send',
      '--to',
      self,
      '--subject',
      subject,
      '--body',
      `${token} body`,
    )

    expect(sent.ok).toBe(true)
    expect(sent.accepted).toContain(self)
  })

  it('finds it in the inbox', async () => {
    uid = await waitForUid(subject)

    expect(uid).toBeGreaterThan(0)
  })

  it('reads it back with matching contents', async () => {
    const message = await climail('read', String(uid))

    expect(message.from).toBe(self)
    expect(message.subject).toBe(subject)
    expect(message.text).toContain(token)
  })

  it('marks it read then starred', async () => {
    expect((await climail('mark', String(uid), 'read')).applied).toBe(true)
    expect((await climail('mark', String(uid), 'star')).applied).toBe(true)
  })

  it('applies a Gmail label', async () => {
    const result = await climail('label', String(uid), labelName)

    expect(result.ok).toBe(true)
    expect(result.applied).toBe(true)
  })

  it('stages a threaded reply in Drafts', async () => {
    const result = await climail('draft-reply', String(uid), '--body', `${token} reply`)

    expect(result.ok).toBe(true)
    expect(result.to).toBe(self)
    expect(result.subject).toBe(`Re: ${subject}`)
    expect(typeof result.draft.uid).toBe('number')

    draft = result.draft
  })

  it('removes the draft', async () => {
    const removed = await climail('delete', String(draft!.uid), '--from', draft!.mailbox)

    expect(removed.deleted).toBe(true)
    draft = null
  })

  it('forwards it to self', async () => {
    const result = await climail('forward', String(uid), '--to', self)

    expect(result.ok).toBe(true)
    expect(result.accepted).toContain(self)
    expect(result.subject).toBe(`Fwd: ${subject}`)
  })

  it('finds and removes the forwarded copy', async () => {
    const fwdUid = await waitForUid(`Fwd: ${subject}`)
    const removed = await climail('delete', String(fwdUid))

    expect(removed.deleted).toBe(true)
  })

  it('moves it to another folder', async () => {
    const result = await climail('move', String(uid), folderName)

    expect(result.moved).toBe(true)
    expect(result.destination).toBe(folderName)
  })

  it('archives a fresh message', async () => {
    const archiveSubject = `${subject} archive`
    const sent = await climail('send', '--to', self, '--subject', archiveSubject, '--body', token)

    expect(sent.ok).toBe(true)

    const archiveUid = await waitForUid(archiveSubject)
    const result = await climail('archive', String(archiveUid))

    expect(result.archived).toBe(true)
  })
})
