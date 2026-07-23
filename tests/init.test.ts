import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancel, isCancel, password, select, text } from '@clack/prompts'
import { loadConfig, saveConfig, localConfigPath } from '../lib/config.js'
import { init } from '../commands/init.js'
import { invoke } from './support.js'

vi.mock('../lib/config.js')
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  select: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  log: { success: vi.fn(), info: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadConfig).mockReturnValue(null)
  vi.mocked(isCancel).mockReturnValue(false)
  vi.mocked(select).mockResolvedValue('global')
  vi.mocked(localConfigPath).mockReturnValue('/cwd/climail.conf')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('init', () => {
  it('collects answers and saves a full config', async () => {
    vi.mocked(text)
      .mockResolvedValueOnce('imap.gmail.com') // IMAP host
      .mockResolvedValueOnce('993') // IMAP port
      .mockResolvedValueOnce('me@gmail.com') // username
      .mockResolvedValueOnce('smtp.gmail.com') // SMTP host
      .mockResolvedValueOnce('465') // SMTP port
    vi.mocked(password).mockResolvedValue('app-pw')

    await invoke(init, [])

    expect(saveConfig).toHaveBeenCalledWith(
      {
        imap: {
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
          username: 'me@gmail.com',
          password: 'app-pw',
        },
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true, username: null, password: null },
      },
      undefined,
    )
  })

  it('defaults SMTP off when the host is left blank', async () => {
    vi.mocked(text)
      .mockResolvedValueOnce('imap.gmail.com')
      .mockResolvedValueOnce('993')
      .mockResolvedValueOnce('me@gmail.com')
      .mockResolvedValueOnce('') // blank SMTP host
    vi.mocked(password).mockResolvedValue('app-pw')

    await invoke(init, [])

    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        smtp: { host: null, port: 465, secure: true, username: null, password: null },
      }),
      undefined,
    )
  })

  it('saves to a local path when the local scope is chosen', async () => {
    vi.mocked(select).mockResolvedValue('local')
    vi.mocked(text)
      .mockResolvedValueOnce('imap.gmail.com')
      .mockResolvedValueOnce('993')
      .mockResolvedValueOnce('me@gmail.com')
      .mockResolvedValueOnce('') // blank SMTP host
    vi.mocked(password).mockResolvedValue('app-pw')

    await invoke(init, [])

    expect(saveConfig).toHaveBeenCalledWith(expect.any(Object), '/cwd/climail.conf')
  })

  it('skips the scope prompt when an explicit --config path is given', async () => {
    vi.mocked(text)
      .mockResolvedValueOnce('imap.gmail.com')
      .mockResolvedValueOnce('993')
      .mockResolvedValueOnce('me@gmail.com')
      .mockResolvedValueOnce('')
    vi.mocked(password).mockResolvedValue('app-pw')

    await invoke(init, ['--config', '/tmp/custom.conf'])

    expect(select).not.toHaveBeenCalled()
    expect(saveConfig).toHaveBeenCalledWith(expect.any(Object), '/tmp/custom.conf')
  })

  it('cancels without saving when a prompt is aborted', async () => {
    vi.mocked(text).mockResolvedValue('imap.gmail.com')
    vi.mocked(isCancel).mockReturnValueOnce(true)

    await invoke(init, [])

    expect(cancel).toHaveBeenCalledWith('Setup cancelled')
    expect(saveConfig).not.toHaveBeenCalled()
  })
})
