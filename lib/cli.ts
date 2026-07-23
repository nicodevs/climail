const configArg = {
  type: 'string',
  description: 'Path to a specific config file (defaults to ~/.config/climail.conf)',
} as const

const mailboxArg = {
  type: 'string',
  valueHint: 'name',
  description: 'Mailbox to operate on (default INBOX)',
} as const

/** Parse a `--count` value into a positive integer, or `fallback` when it's unset. */
function parseCount(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback
  }

  const count = Number(value)

  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`--count must be a positive integer, got "${value}"`)
  }

  return count
}

export { parseCount, configArg, mailboxArg }
