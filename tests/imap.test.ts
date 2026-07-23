import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImapFlow } from 'imapflow'
import {
  createClient,
  findArchiveMailbox,
  findDraftsMailbox,
  withClient,
  withInbox,
  withMailbox,
} from '../lib/imap.js'
import { CONFIG } from './support.js'

vi.mock('imapflow', () => ({ ImapFlow: vi.fn() }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createClient', () => {
  it('maps config into ImapFlow options', () => {
    createClient(CONFIG)

    expect(ImapFlow).toHaveBeenCalledWith({
      host: 'imap.example.com',
      port: 993,
      secure: true,
      auth: { user: 'me@example.com', pass: 'pw' },
      logger: false,
    })
  })
})

describe('withClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('connects, runs the callback, and always logs out', async () => {
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
    }

    vi.mocked(ImapFlow).mockImplementation(function () {
      return client as any
    })

    const result = await withClient(CONFIG, async (c) => {
      expect(c).toBe(client)

      return 'done'
    })

    expect(client.connect).toHaveBeenCalledOnce()
    expect(client.logout).toHaveBeenCalledOnce()
    expect(result).toBe('done')
  })

  it('logs out even when the callback throws', async () => {
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
    }

    vi.mocked(ImapFlow).mockImplementation(function () {
      return client as any
    })

    await expect(
      withClient(CONFIG, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(client.logout).toHaveBeenCalledOnce()
  })

  it('rethrows the callback error even when logout also fails', async () => {
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockRejectedValue(new Error('logout failed')),
    }

    vi.mocked(ImapFlow).mockImplementation(function () {
      return client as any
    })

    await expect(
      withClient(CONFIG, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(client.logout).toHaveBeenCalledOnce()
  })
})

describe('withMailbox', () => {
  it('acquires a lock and releases it, even on error', async () => {
    const lock = { release: vi.fn() }
    const client = { getMailboxLock: vi.fn().mockResolvedValue(lock) } as any

    await expect(
      withMailbox(client, 'INBOX', async () => {
        throw new Error('fail')
      }),
    ).rejects.toThrow('fail')

    expect(client.getMailboxLock).toHaveBeenCalledWith('INBOX')
    expect(lock.release).toHaveBeenCalledOnce()
  })

  it('withInbox locks the INBOX', async () => {
    const lock = { release: vi.fn() }
    const client = { getMailboxLock: vi.fn().mockResolvedValue(lock) } as any

    await withInbox(client, async () => 'ok')

    expect(client.getMailboxLock).toHaveBeenCalledWith('INBOX')
  })
})

describe('findDraftsMailbox', () => {
  it('returns the \\Drafts special-use path', async () => {
    const client = {
      list: vi.fn().mockResolvedValue([{ path: '[Gmail]/Drafts', specialUse: '\\Drafts' }]),
    } as any

    expect(await findDraftsMailbox(client)).toBe('[Gmail]/Drafts')
  })

  it('falls back to "Drafts" when none is flagged', async () => {
    const client = { list: vi.fn().mockResolvedValue([{ path: 'INBOX' }]) } as any

    expect(await findDraftsMailbox(client)).toBe('Drafts')
  })
})

describe('findArchiveMailbox', () => {
  it('prefers \\Archive', async () => {
    const client = {
      list: vi.fn().mockResolvedValue([
        { path: 'Archive', specialUse: '\\Archive' },
        { path: 'All', specialUse: '\\All' },
      ]),
    } as any

    expect(await findArchiveMailbox(client)).toBe('Archive')
  })

  it('falls back to \\All (Gmail All Mail)', async () => {
    const client = {
      list: vi.fn().mockResolvedValue([{ path: '[Gmail]/All Mail', specialUse: '\\All' }]),
    } as any

    expect(await findArchiveMailbox(client)).toBe('[Gmail]/All Mail')
  })

  it('falls back to "Archive" when nothing matches', async () => {
    const client = { list: vi.fn().mockResolvedValue([{ path: 'INBOX' }]) } as any

    expect(await findArchiveMailbox(client)).toBe('Archive')
  })
})
