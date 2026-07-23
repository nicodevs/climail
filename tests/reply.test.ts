import { describe, expect, it } from 'vitest'
import type { AddressObject, ParsedMail } from 'mailparser'
import { replyAllRecipients, replyMeta, replySubject, replyTarget } from '../lib/reply.js'

// Minimal AddressObject builder — reply helpers only read `.value[].address`.
function addr(...emails: string[]): AddressObject {
  return { value: emails.map((email) => ({ address: email })), html: '', text: '' }
}

function mail(parts: Partial<ParsedMail>): ParsedMail {
  return parts as ParsedMail
}

describe('replySubject', () => {
  it('adds a Re: prefix', () => {
    expect(replySubject('Lunch?')).toBe('Re: Lunch?')
  })

  it('does not double an existing Re:', () => {
    expect(replySubject('Re: Lunch?')).toBe('Re: Lunch?')
  })

  it('handles a missing subject', () => {
    expect(replySubject(undefined)).toBe('Re:')
  })
})

describe('replyTarget', () => {
  it('prefers Reply-To over From', () => {
    const parsed = mail({ replyTo: addr('reply@x.com'), from: addr('sender@x.com') })

    expect(replyTarget(parsed)).toBe('reply@x.com')
  })

  it('falls back to From when Reply-To is absent', () => {
    const parsed = mail({ from: addr('sender@x.com') })

    expect(replyTarget(parsed)).toBe('sender@x.com')
  })

  it('returns null when neither is present', () => {
    expect(replyTarget(mail({}))).toBeNull()
  })
})

describe('replyAllRecipients', () => {
  it('targets the sender and cc-es the other recipients, minus self and target', () => {
    const parsed = mail({
      from: addr('sender@x.com'),
      to: addr('me@x.com', 'alice@x.com'),
      cc: addr('bob@x.com'),
    })

    const { to, cc } = replyAllRecipients(parsed, 'me@x.com')

    expect(to).toBe('sender@x.com')
    expect(cc).toEqual(['alice@x.com', 'bob@x.com'])
  })

  it('deduplicates recipients case-insensitively', () => {
    const parsed = mail({
      from: addr('sender@x.com'),
      to: addr('Alice@x.com'),
      cc: addr('alice@x.com'),
    })

    const { cc } = replyAllRecipients(parsed, 'me@x.com')

    expect(cc).toEqual(['Alice@x.com'])
  })
})

describe('replyMeta', () => {
  it('threads via In-Reply-To and appends to References', () => {
    const parsed = mail({ messageId: '<id-2>', references: ['<id-0>', '<id-1>'] })

    expect(replyMeta(parsed)).toEqual({
      inReplyTo: '<id-2>',
      references: ['<id-0>', '<id-1>', '<id-2>'],
    })
  })

  it('normalizes a single string References into a list', () => {
    const parsed = mail({ messageId: '<id-1>', references: '<id-0>' })

    expect(replyMeta(parsed)).toEqual({
      inReplyTo: '<id-1>',
      references: ['<id-0>', '<id-1>'],
    })
  })
})
