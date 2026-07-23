import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readUserConfig, writeUserConfig, write } from 'rc9'
import { loadValidatedConfig, saveConfig, RC_NAME } from '../lib/config.js'
import { CONFIG, CONFIG_NO_SMTP } from './support.js'

vi.mock('rc9')

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('saveConfig', () => {
  it('writes the full config to the user config file by default', () => {
    saveConfig(CONFIG)

    expect(writeUserConfig).toHaveBeenCalledWith(CONFIG, RC_NAME)
  })

  it('writes to an explicit path when given one', () => {
    saveConfig(CONFIG_NO_SMTP, '/tmp/climail.conf')

    expect(write).toHaveBeenCalledWith(CONFIG_NO_SMTP, { dir: '/tmp', name: 'climail.conf' })
  })
})

describe('loadValidatedConfig', () => {
  it('throws when no configuration is found', () => {
    vi.mocked(readUserConfig).mockReturnValue({})

    expect(() => loadValidatedConfig()).toThrow('No configuration found')
  })
})
