import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readUserConfig } from 'rc9'
import { loadConfig } from '../lib/config.js'

vi.mock('rc9')

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadConfig', () => {
  it('returns null when no IMAP credentials are present', () => {
    vi.mocked(readUserConfig).mockReturnValue({})

    expect(loadConfig()).toBeNull()
  })

  it('parses a valid config', () => {
    vi.mocked(readUserConfig).mockReturnValue({
      imap: {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        username: 'me@gmail.com',
        password: 'secret',
      },
    })

    const config = loadConfig()

    expect(config?.imap).toEqual({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      username: 'me@gmail.com',
      password: 'secret',
    })
  })

  it('coerces a string IMAP port to a number', () => {
    vi.mocked(readUserConfig).mockReturnValue({
      imap: { host: 'imap.example.com', port: '143', username: 'me@example.com', password: 'pw' },
    })

    const config = loadConfig()

    expect(config?.imap.port).toBe(143)
    expect(typeof config?.imap.port).toBe('number')
  })

  it('applies smtp and secure defaults when unset', () => {
    vi.mocked(readUserConfig).mockReturnValue({
      imap: { host: 'imap.example.com', username: 'me@example.com', password: 'pw' },
    })

    const config = loadConfig()

    // No port -> schema default 993; no secure -> default true.
    expect(config?.imap.port).toBe(993)
    expect(config?.imap.secure).toBe(true)
    // No SMTP host -> null host, default port, secure by default, no separate creds.
    expect(config?.smtp).toEqual({
      host: null,
      port: 465,
      secure: true,
      username: null,
      password: null,
    })
  })

  it('reads separate SMTP credentials when present', () => {
    vi.mocked(readUserConfig).mockReturnValue({
      imap: { host: 'imap.example.com', username: 'me@example.com', password: 'pw' },
      smtp: { host: 'smtp.example.com', username: 'smtp-user', password: 'smtp-pass' },
    })

    const config = loadConfig()

    expect(config?.smtp.username).toBe('smtp-user')
    expect(config?.smtp.password).toBe('smtp-pass')
  })
})
