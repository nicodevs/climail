import { z } from 'zod'
import { existsSync } from 'fs'
import { dirname, basename, join } from 'path'
import { readUserConfig, writeUserConfig, parseFile, write } from 'rc9'

// Lives at ~/.config/climail.conf (or $XDG_CONFIG_HOME) so climail works from any directory.
const RC_NAME = 'climail.conf'

// A local config in the working directory (created by `init` with the "local" scope).
function localConfigPath(): string {
  return join(process.cwd(), RC_NAME)
}

const configSchema = z.object({
  imap: z.object({
    host: z.string(),
    port: z.coerce.number().int().default(993),
    secure: z.boolean().default(true),
    username: z.string(),
    // Coerce: an all-digits password can round-trip through the config file as a number.
    password: z.coerce.string(),
  }),
  smtp: z
    .object({
      host: z.string().nullable().default(null),
      port: z.coerce.number().int().default(465),
      secure: z.boolean().default(true),
      username: z.string().nullable().default(null),
      password: z.coerce.string().nullable().default(null),
    })
    .prefault({}),
})

type Config = z.infer<typeof configSchema>

function readRaw(configPath?: string): Record<string, unknown> {
  if (configPath) {
    return existsSync(configPath) ? parseFile(configPath) : {}
  }

  // A local config in the current directory takes precedence over the global one.
  const local = localConfigPath()

  if (existsSync(local)) {
    return parseFile(local)
  }

  return readUserConfig(RC_NAME)
}

function loadConfig(configPath?: string): Config | null {
  const raw = readRaw(configPath)
  const imap = (raw.imap ?? {}) as Record<string, unknown>

  if (!imap.host && !imap.username && !imap.password) {
    return null
  }

  const result = configSchema.safeParse(raw)

  if (!result.success) {
    throw new Error(`Configuration validation failed:\n${z.prettifyError(result.error)}`)
  }

  return result.data
}

function loadValidatedConfig(configPath?: string): Config {
  const config = loadConfig(configPath)

  if (!config) {
    throw new Error('No configuration found. Run "npx climail init" first.')
  }

  return config
}

function saveConfig(config: Config, configPath?: string) {
  if (configPath) {
    write(config, { dir: dirname(configPath), name: basename(configPath) })
  } else {
    writeUserConfig(config, RC_NAME)
  }
}

export { loadConfig, loadValidatedConfig, saveConfig, localConfigPath, RC_NAME }

export type { Config }
