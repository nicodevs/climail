function toArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

// "Re: " prefix without doubling it up.
function replySubject(subject) {
  const original = subject ?? ''
  return /^re:/i.test(original) ? original : `Re: ${original}`.trim()
}

// Threading headers for a reply to a parsed message: In-Reply-To is the
// original's Message-ID; References is the existing chain plus that Message-ID.
function replyMeta(parsed) {
  return {
    inReplyTo: parsed.messageId ?? undefined,
    references: [...toArray(parsed.references), parsed.messageId].filter(Boolean)
  }
}

export { replySubject, replyMeta }
