import { z } from 'zod'
import { existsSync, writeFileSync } from 'fs'

const ENV_FILE = '.env'

const configSchema = z.object({
  imap: z.object({
    host: z.string(),
    port: z.coerce.number().int().default(993),
    secure: z.boolean().default(true),
    username: z.string(),
    password: z.string()
  }),
  smtp: z.object({
    host: z.string().nullable().default(null),
    port: z.coerce.number().int().default(465),
    secure: z.boolean().default(true)
  }).default({})
})

// Load the given .env file (if present), then fall back to whatever is already
// in the environment.
function readEnv(envFile) {
  if (existsSync(envFile)) process.loadEnvFile(envFile)
  return process.env
}

function loadConfig(envFile = ENV_FILE) {
  const env = readEnv(envFile)

  if (!env.IMAP_HOST && !env.IMAP_USERNAME && !env.IMAP_PASSWORD) return null

  const result = configSchema.safeParse({
    imap: {
      host: env.IMAP_HOST,
      port: env.IMAP_PORT,
      secure: (env.IMAP_ENCRYPTION ?? 'ssl') === 'ssl',
      username: env.IMAP_USERNAME,
      password: env.IMAP_PASSWORD
    },
    smtp: {
      host: env.SMTP_HOST ?? null,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT ? Number(env.SMTP_PORT) === 465 : true
    }
  })

  if (!result.success) {
    console.error('Configuration validation failed:')
    console.error(z.prettifyError(result.error))
    process.exit(1)
  }

  return result.data
}

function loadValidatedConfig(envFile = ENV_FILE) {
  const config = loadConfig(envFile)

  if (!config) {
    console.error('No configuration found. Run "npx emailcheck init" first, or create a .env file.')
    process.exit(1)
  }

  return config
}

function saveConfig(config) {
  try {
    const { imap, smtp } = config
    const lines = [
      `IMAP_HOST=${imap.host}`,
      `IMAP_PORT=${imap.port}`,
      `IMAP_ENCRYPTION=${imap.secure ? 'ssl' : 'none'}`,
      `IMAP_USERNAME=${imap.username}`,
      `IMAP_PASSWORD="${imap.password}"`
    ]
    if (smtp?.host) {
      lines.push(`SMTP_HOST=${smtp.host}`, `SMTP_PORT=${smtp.port}`)
    }
    writeFileSync(ENV_FILE, lines.join('\n') + '\n')
  } catch (error) {
    console.error('Error writing .env file: ' + error.message)
    process.exit(1)
  }
}

export { loadConfig, loadValidatedConfig, saveConfig }
