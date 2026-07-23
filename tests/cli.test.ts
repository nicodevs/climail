import { describe, expect, it } from 'vitest'
import { parseCount } from '../lib/cli.js'

describe('parseCount', () => {
  it('returns the fallback when unset', () => {
    expect(parseCount(undefined, 10)).toBe(10)
  })

  it('parses a positive integer', () => {
    expect(parseCount('5', 10)).toBe(5)
  })

  it.each(['0', '-3', 'abc', '2.5'])('rejects %j', (value) => {
    expect(() => parseCount(value, 10)).toThrow('--count must be a positive integer')
  })
})
