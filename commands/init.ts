import { defineCommand } from 'citty'
import { intro, outro, text, password, select, isCancel, cancel, log } from '@clack/prompts'
import { loadConfig, saveConfig, localConfigPath, type Config } from '../lib/config.js'
import { configArg } from '../lib/cli.js'

function required(value: string | undefined) {
  return value ? undefined : 'Required'
}

async function runInit(configPath?: string) {
  intro('climail setup')

  // An explicit --config path wins; otherwise ask where to save the config.
  let savePath = configPath

  if (!savePath) {
    const scope = await select({
      message: 'Where should the config be saved?',
      options: [
        {
          value: 'global',
          label: 'Global',
          hint: '~/.config/climail.conf, used from any directory',
        },
        { value: 'local', label: 'Local', hint: `${localConfigPath()}, used from this directory` },
      ],
      initialValue: 'global',
    })
    if (isCancel(scope)) {
      return cancel('Setup cancelled')
    }

    if (scope === 'local') {
      savePath = localConfigPath()
    }
  }

  const existing = loadConfig(savePath)

  const host = await text({
    message: 'IMAP host',
    placeholder: 'imap.gmail.com',
    initialValue: existing?.imap.host ?? 'imap.gmail.com',
  })
  if (isCancel(host)) {
    return cancel('Setup cancelled')
  }

  const portValue = await text({
    message: 'IMAP port',
    initialValue: String(existing?.imap.port ?? 993),
  })
  if (isCancel(portValue)) {
    return cancel('Setup cancelled')
  }

  const username = await text({
    message: 'Email address',
    initialValue: existing?.imap.username ?? '',
    validate: required,
  })
  if (isCancel(username)) {
    return cancel('Setup cancelled')
  }

  const pass = await password({
    message: 'Password (Gmail: use an app password)',
    validate: required,
  })
  if (isCancel(pass)) {
    return cancel('Setup cancelled')
  }

  const smtpHost = await text({
    message: 'SMTP host for sending (leave blank to skip)',
    initialValue: existing?.smtp.host ?? 'smtp.gmail.com',
  })
  if (isCancel(smtpHost)) {
    return cancel('Setup cancelled')
  }

  // Off unless a host was entered below.
  let smtp: Config['smtp'] = { host: null, port: 465, secure: true, username: null, password: null }

  if (smtpHost) {
    const smtpPortValue = await text({
      message: 'SMTP port',
      initialValue: String(existing?.smtp.port ?? 465),
    })
    if (isCancel(smtpPortValue)) {
      return cancel('Setup cancelled')
    }

    const smtpPort = Number(smtpPortValue)

    smtp = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      username: null,
      password: null,
    }
  }

  const port = Number(portValue)

  saveConfig(
    {
      imap: { host, port, secure: port === 993, username, password: pass },
      smtp,
    },
    savePath,
  )

  log.success(`Saved config to ${savePath ?? '~/.config/climail.conf'}`)
  outro('Done. Try: npx climail list --unread')
}

const init = defineCommand({
  meta: { name: 'init', description: 'Setup wizard for IMAP credentials' },
  args: { config: configArg },
  run: ({ args }) => runInit(args.config),
})

export { init }
