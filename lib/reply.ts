import type { ParsedMail } from 'mailparser'
import { addresses, firstAddress } from './address.js'

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function replySubject(subject: string | undefined) {
  const original = subject ?? ''

  return /^re:/i.test(original) ? original : `Re: ${original}`.trim()
}

function replyTarget(parsed: ParsedMail): string | null {
  return firstAddress(parsed.replyTo) ?? firstAddress(parsed.from)
}

/**
 * Reply-all recipients: the primary target in To, and every other original
 * recipient (To + Cc) in Cc — minus our own address and the To address.
 */
function replyAllRecipients(parsed: ParsedMail, self: string) {
  const to = replyTarget(parsed)

  const skip = new Set(
    [to, self]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  )

  const cc: string[] = []

  for (const address of [...addresses(parsed.to), ...addresses(parsed.cc)]) {
    const key = address.toLowerCase()

    if (skip.has(key)) {
      continue
    }

    skip.add(key)
    cc.push(address)
  }

  return { to, cc }
}

/**
 * Threading headers for a reply to a parsed message: In-Reply-To is the
 * original's Message-ID; References is the existing chain plus that Message-ID.
 */
function replyMeta(parsed: ParsedMail) {
  return {
    inReplyTo: parsed.messageId ?? undefined,
    references: [...toArray(parsed.references), parsed.messageId].filter((id): id is string =>
      Boolean(id),
    ),
  }
}

export { replySubject, replyMeta, replyTarget, replyAllRecipients }
