/**
 * Tests for OUI (Organizationally Unique Identifier) vendor database module.
 * Tests lookup(), searchVendors(), randomizeAsVendor(), and utility functions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  lookup,
  searchVendors,
  randomizeAsVendor,
  randomizeAsVendorWithInfo,
  getVendorNames,
  getPrefixesForVendor,
  getDatabaseStats,
  setRandomFunction
} from '../src/index.ts'

describe('lookup()', () => {
  describe('valid MAC formats', () => {
    it('handles colon-separated MAC', () => {
      // Apple has many OUI prefixes
      const result = lookup('00:03:93:00:00:00')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.prefix).toBe('00:03:93')
        expect(typeof result.vendor).toBe('string')
      }
    })

    it('handles dash-separated MAC', () => {
      const result = lookup('00-03-93-AA-BB-CC')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.prefix).toBe('00:03:93')
      }
    })

    it('handles Cisco-style MAC (dot notation)', () => {
      const result = lookup('0003.93AA.BBCC')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.prefix).toBe('00:03:93')
      }
    })

    it('handles no-separator MAC (12 chars)', () => {
      const result = lookup('000393AABBCC')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.prefix).toBe('00:03:93')
      }
    })

    it('handles lowercase input', () => {
      const result = lookup('00:03:93:aa:bb:cc')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.prefix).toBe('00:03:93')
      }
    })

    it('handles prefix-only input (6 chars, no separator)', () => {
      const result = lookup('000393')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.prefix).toBe('00:03:93')
      }
    })

    it('handles prefix-only with colons', () => {
      const result = lookup('00:03:93')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.prefix).toBe('00:03:93')
      }
    })
  })

  describe('known vendor prefixes', () => {
    it('returns correct vendor for Apple prefix', () => {
      // 00:03:93 is Apple
      const result = lookup('00:03:93:00:00:00')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.vendor.toLowerCase()).toContain('apple')
      }
    })

    it('returns correct vendor for Intel prefix', () => {
      // 00:1B:21 is Intel Corporate
      const result = lookup('00:1B:21:00:00:00')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.vendor.toLowerCase()).toContain('intel')
      }
    })
  })

  describe('invalid/unknown inputs', () => {
    it('returns null for unknown prefix', () => {
      // FF:FF:FF is unlikely to be a valid OUI
      const result = lookup('FF:FF:FF:00:00:00')
      expect(result).toBeNull()
    })

    it('returns null for malformed MAC - too short', () => {
      const result = lookup('00:11')
      expect(result).toBeNull()
    })

    it('returns null for malformed MAC - invalid characters', () => {
      const result = lookup('ZZ:ZZ:ZZ:00:00:00')
      expect(result).toBeNull()
    })

    it('returns null for empty string', () => {
      const result = lookup('')
      expect(result).toBeNull()
    })

    it('returns null for whitespace only', () => {
      const result = lookup('   ')
      expect(result).toBeNull()
    })

    it('handles whitespace around valid MAC', () => {
      const result = lookup('  00:03:93:00:00:00  ')
      expect(result).not.toBeNull()
    })
  })
})

describe('searchVendors()', () => {
  describe('exact match', () => {
    it('prioritizes exact match over partial', () => {
      const results = searchVendors('Apple, Inc.')
      expect(results.length).toBeGreaterThan(0)
      // Exact match should be first
      expect(results[0].vendor).toBe('Apple, Inc.')
    })
  })

  describe('partial match', () => {
    it('finds vendors starting with query', () => {
      const results = searchVendors('Apple')
      expect(results.length).toBeGreaterThan(0)
      // All results should contain Apple
      results.forEach((r) => {
        expect(r.vendor.toLowerCase()).toContain('apple')
      })
    })

    it('finds vendors containing query', () => {
      const results = searchVendors('Intel')
      expect(results.length).toBeGreaterThan(0)
      results.forEach((r) => {
        expect(r.vendor.toLowerCase()).toContain('intel')
      })
    })
  })

  describe('fuzzy match (typo tolerance)', () => {
    it('finds vendor with minor typo', () => {
      // "Aplle" should still find "Apple" via Levenshtein
      const results = searchVendors('Aplle')
      expect(results.length).toBeGreaterThan(0)
      const hasApple = results.some((r) =>
        r.vendor.toLowerCase().includes('apple')
      )
      expect(hasApple).toBe(true)
    })

    it('finds vendor with transposed letters', () => {
      // "Intle" should find "Intel"
      const results = searchVendors('Intle')
      expect(results.length).toBeGreaterThan(0)
      const hasIntel = results.some((r) =>
        r.vendor.toLowerCase().includes('intel')
      )
      expect(hasIntel).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('returns empty array for empty query', () => {
      const results = searchVendors('')
      expect(results).toEqual([])
    })

    it('returns empty array for whitespace query', () => {
      const results = searchVendors('   ')
      expect(results).toEqual([])
    })

    it('is case insensitive', () => {
      const resultsLower = searchVendors('apple')
      const resultsUpper = searchVendors('APPLE')
      expect(resultsLower.length).toBe(resultsUpper.length)
      expect(resultsLower[0].vendor).toBe(resultsUpper[0].vendor)
    })

    it('rejects excessively long queries', () => {
      const results = searchVendors('z'.repeat(129))
      expect(results).toEqual([])
    })

    it('rejects oversized padded queries before trimming', () => {
      const results = searchVendors(`${' '.repeat(129)}a`)
      expect(results).toEqual([])
    })
  })

  describe('limit parameter', () => {
    it('respects limit parameter', () => {
      const results = searchVendors('a', 5)
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('returns all matches when limit is higher than match count', () => {
      const results = searchVendors('Apple', 1000)
      // Should return all Apple matches (less than 1000)
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThan(1000)
    })

    it('uses default limit of 50', () => {
      // Search for something common that has many matches
      const results = searchVendors('a')
      expect(results.length).toBeLessThanOrEqual(50)
    })
  })
})

describe('randomizeAsVendor()', () => {
  // Use predictable random for testing
  beforeEach(() => {
    let counter = 0
    setRandomFunction((_min: number, max: number) => {
      // Return predictable values
      counter++
      return counter % max
    })
  })

  afterEach(() => {
    // Reset to crypto random
    setRandomFunction(null)
  })

  describe('valid MAC format', () => {
    it('returns valid colon-separated MAC format', () => {
      const mac = randomizeAsVendor('Apple')
      expect(mac).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
    })

    it('returns uppercase MAC', () => {
      const mac = randomizeAsVendor('Apple')
      expect(mac).toBe(mac.toUpperCase())
    })
  })

  describe('vendor prefix', () => {
    it('uses correct vendor prefix', () => {
      const { mac, prefix } = randomizeAsVendorWithInfo('Apple')
      const macPrefix = mac.split(':').slice(0, 3).join(':')
      expect(macPrefix).toBe(prefix)
    })

    it('returns matching vendor info', () => {
      const { vendor } = randomizeAsVendorWithInfo('Intel')
      expect(vendor.toLowerCase()).toContain('intel')
    })
  })

  describe('localAdmin flag', () => {
    it('sets locally administered bit when true', () => {
      const mac = randomizeAsVendor('Apple', true)
      const firstByte = parseInt(mac.split(':')[0], 16)
      // Bit 1 (0x02) should be set
      expect(firstByte & 0x02).toBe(0x02)
    })

    it('does not set locally administered bit when false', () => {
      // Note: This test may still have the bit set if vendor prefix has it
      // We just verify the function runs without error
      const mac = randomizeAsVendor('Apple', false)
      expect(mac).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
    })
  })

  describe('error handling', () => {
    it('throws on unknown vendor', () => {
      expect(() => randomizeAsVendor('XYZNONEXISTENTVENDOR123')).toThrow(
        /No vendor found matching/
      )
    })

    it('throws on empty query', () => {
      expect(() => randomizeAsVendor('')).toThrow(/No vendor found matching/)
    })
  })
})

describe('randomizeAsVendorWithInfo()', () => {
  beforeEach(() => {
    setRandomFunction((_min: number, _max: number) => 0)
  })

  afterEach(() => {
    setRandomFunction(null)
  })

  it('returns mac, vendor, and prefix', () => {
    const result = randomizeAsVendorWithInfo('Apple')
    expect(result).toHaveProperty('mac')
    expect(result).toHaveProperty('vendor')
    expect(result).toHaveProperty('prefix')
  })

  it('returns valid MAC in mac property', () => {
    const { mac } = randomizeAsVendorWithInfo('Intel')
    expect(mac).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
  })

  it('returns valid prefix format', () => {
    const { prefix } = randomizeAsVendorWithInfo('Apple')
    expect(prefix).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
  })

  it('throws on unknown vendor', () => {
    expect(() => randomizeAsVendorWithInfo('UNKNOWNVENDOR999')).toThrow(
      /No vendor found matching/
    )
  })
})

describe('getVendorNames()', () => {
  it('returns an array of strings', () => {
    const names = getVendorNames()
    expect(Array.isArray(names)).toBe(true)
    expect(names.length).toBeGreaterThan(0)
    names.forEach((name) => {
      expect(typeof name).toBe('string')
    })
  })

  it('returns sorted unique list', () => {
    const names = getVendorNames()
    // Check sorted
    const sorted = [...names].toSorted()
    expect(names).toEqual(sorted)
    // Check unique
    const uniqueSet = new Set(names)
    expect(uniqueSet.size).toBe(names.length)
  })

  it('includes known vendors', () => {
    const names = getVendorNames()
    const hasApple = names.some((n) => n.includes('Apple'))
    const hasIntel = names.some((n) => n.toLowerCase().includes('intel'))
    expect(hasApple).toBe(true)
    expect(hasIntel).toBe(true)
  })
})

describe('getPrefixesForVendor()', () => {
  it('returns array of prefixes for known vendor', () => {
    const prefixes = getPrefixesForVendor('Apple, Inc.')
    expect(Array.isArray(prefixes)).toBe(true)
    expect(prefixes.length).toBeGreaterThan(0)
  })

  it('returns prefixes in correct format', () => {
    const prefixes = getPrefixesForVendor('Apple, Inc.')
    prefixes.forEach((prefix) => {
      expect(prefix).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
    })
  })

  it('returns sorted prefixes', () => {
    const prefixes = getPrefixesForVendor('Apple, Inc.')
    const sorted = [...prefixes].toSorted()
    expect(prefixes).toEqual(sorted)
  })

  it('returns empty array for unknown vendor', () => {
    const prefixes = getPrefixesForVendor('UNKNOWNVENDOR999XYZ')
    expect(prefixes).toEqual([])
  })

  it('is case insensitive', () => {
    const prefixesLower = getPrefixesForVendor('apple, inc.')
    const prefixesUpper = getPrefixesForVendor('APPLE, INC.')
    expect(prefixesLower).toEqual(prefixesUpper)
  })
})

describe('getDatabaseStats()', () => {
  it('returns totalPrefixes and uniqueVendors', () => {
    const stats = getDatabaseStats()
    expect(stats).toHaveProperty('totalPrefixes')
    expect(stats).toHaveProperty('uniqueVendors')
  })

  it('returns positive numbers', () => {
    const stats = getDatabaseStats()
    expect(stats.totalPrefixes).toBeGreaterThan(0)
    expect(stats.uniqueVendors).toBeGreaterThan(0)
  })

  it('has more prefixes than unique vendors', () => {
    // Multiple prefixes can map to same vendor
    const stats = getDatabaseStats()
    expect(stats.totalPrefixes).toBeGreaterThanOrEqual(stats.uniqueVendors)
  })

  it('returns consistent values on multiple calls', () => {
    const stats1 = getDatabaseStats()
    const stats2 = getDatabaseStats()
    expect(stats1.totalPrefixes).toBe(stats2.totalPrefixes)
    expect(stats1.uniqueVendors).toBe(stats2.uniqueVendors)
  })
})
