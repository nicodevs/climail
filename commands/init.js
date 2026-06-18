import { intro, outro, text, password, isCancel, cancel, log } from '@clack/prompts'
import { loadConfig, saveConfig } from '../lib/config.js'

function required(value) {
  return value ? undefined : 'Required'
}

export async function init() {
  intro('emailcheck setup')

  const existing = loadConfig()

  const host = await text({
    message: 'IMAP host',
    placeholder: 'imap.gmail.com',
    initialValue: existing?.imap.host ?? 'imap.gmail.com'
  })
  if (isCancel(host)) return cancel('Setup cancelled')

  const portValue = await text({
    message: 'IMAP port',
    initialValue: String(existing?.imap.port ?? 993)
  })
  if (isCancel(portValue)) return cancel('Setup cancelled')

  const username = await text({
    message: 'Email address',
    initialValue: existing?.imap.username ?? '',
    validate: required
  })
  if (isCancel(username)) return cancel('Setup cancelled')

  const pass = await password({
    message: 'Password (Gmail: use an app password)',
    validate: required
  })
  if (isCancel(pass)) return cancel('Setup cancelled')

  const smtpHost = await text({
    message: 'SMTP host for sending (leave blank to skip)',
    initialValue: existing?.smtp.host ?? 'smtp.gmail.com'
  })
  if (isCancel(smtpHost)) return cancel('Setup cancelled')

  let smtp
  if (smtpHost) {
    const smtpPortValue = await text({
      message: 'SMTP port',
      initialValue: String(existing?.smtp.port ?? 465)
    })
    if (isCancel(smtpPortValue)) return cancel('Setup cancelled')
    const smtpPort = Number(smtpPortValue)
    smtp = { host: smtpHost, port: smtpPort, secure: smtpPort === 465 }
  }

  const port = Number(portValue)
  saveConfig({
    imap: { host, port, secure: port === 993, username, password: pass },
    smtp
  })

  log.success('Saved to .env')
  outro('Done. Try: npx emailcheck list --unread')
}
