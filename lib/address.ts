import type { AddressObject } from 'mailparser'

/** Plain address strings from a mailparser field. Grouped (array) headers aren't expanded. */
function addresses(field: AddressObject | AddressObject[] | undefined): string[] {
  if (!field || Array.isArray(field)) {
    return []
  }

  return field.value
    .map((entry) => entry.address)
    .filter((address): address is string => Boolean(address))
}

/** First address on a field, or null. */
function firstAddress(field: AddressObject | AddressObject[] | undefined): string | null {
  return addresses(field)[0] ?? null
}

export { addresses, firstAddress }
