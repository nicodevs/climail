function toArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

// "Re: " prefix without doubling it up.
function replySubject(subject) {
  const original = subject ?? ''
  return /^re:/i.test(original) ? original : `Re: ${original}`.trim()
}

function addresses(field) {
  return field?.value?.map(value => value.address).filter(Boolean) ?? []
}

// The primary reply target: the Reply-To address if set, else the sender.
function replyTarget(parsed) {
  return parsed.replyTo?.value?.[0]?.address ?? parsed.from?.value?.[0]?.address ?? null
}

// Reply-all recipients: the primary target in To, and every other original
// recipient (To + Cc) in Cc — minus our own address and the To address.
function replyAllRecipients(parsed, self) {
  const to = replyTarget(parsed)
  const skip = new Set([to, self].filter(Boolean).map(value => value.toLowerCase()))

  const cc = []
  for (const address of [...addresses(parsed.to), ...addresses(parsed.cc)]) {
    const key = address.toLowerCase()
    if (skip.has(key)) continue
    skip.add(key)
    cc.push(address)
  }

  return { to, cc }
}

// Threading headers for a reply to a parsed message: In-Reply-To is the
// original's Message-ID; References is the existing chain plus that Message-ID.
function replyMeta(parsed) {
  return {
    inReplyTo: parsed.messageId ?? undefined,
    references: [...toArray(parsed.references), parsed.messageId].filter(Boolean)
  }
}

export { replySubject, replyMeta, replyTarget, replyAllRecipients }
