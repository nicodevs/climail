import { describe, expect, it } from 'vitest'
import type { AddressObject } from 'mailparser'
import { addresses, firstAddress } from '../lib/address.js'

function field(...emails: string[]): AddressObject {
  return { value: emails.map((address) => ({ address })) } as AddressObject
}

describe('addresses', () => {
  it('extracts every address from a field', () => {
    expect(addresses(field('a@x.com', 'b@x.com'))).toEqual(['a@x.com', 'b@x.com'])
  })

  it('drops entries without an address', () => {
    expect(addresses({ value: [{ name: 'No Addr' }, { address: 'a@x.com' }] } as any)).toEqual([
      'a@x.com',
    ])
  })

  it('returns an empty array for an undefined field', () => {
    expect(addresses(undefined)).toEqual([])
  })

  it('returns an empty array for a grouped (array) field', () => {
    expect(addresses([field('a@x.com')] as any)).toEqual([])
  })
})

describe('firstAddress', () => {
  it('returns the first address on the field', () => {
    expect(firstAddress(field('a@x.com', 'b@x.com'))).toBe('a@x.com')
  })

  it('returns null when the field has no addresses', () => {
    expect(firstAddress(undefined)).toBeNull()
    expect(firstAddress({ value: [] } as any)).toBeNull()
  })
})
