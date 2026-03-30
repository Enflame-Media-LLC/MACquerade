/**
 * Tests for pure function exports (normalize, randomize, etc.)
 * No mocking required - tests run against actual library exports.
 */
import { describe, it, expect } from 'vitest'
import * as spoof from '../src/index.ts'
import { randomInt } from 'node:crypto'

describe('spoof.normalize()', () => {
  it('normalizes colon-separated MAC', () => {
    expect(spoof.normalize('00:00:00:00:00:00')).toBe('00:00:00:00:00:00')
  })

  it('normalizes dash-separated MAC', () => {
    expect(spoof.normalize('00-00-00-00-00-00')).toBe('00:00:00:00:00:00')
  })

  it('normalizes Cisco-style MAC', () => {
    expect(spoof.normalize('0000.0000.0000')).toBe('00:00:00:00:00:00')
  })
})

describe('spoof.random', () => {
  it('returns valid, normalized mac addresses', () => {
    const mac = spoof.randomize()
    expect(mac).toBe(spoof.normalize(mac))
  })
})

describe('spoof.setPreferIfconfig()', () => {
  it('is a function', () => {
    expect(typeof spoof.setPreferIfconfig).toBe('function')
  })

  it('accepts true', () => {
    expect(() => spoof.setPreferIfconfig(true)).not.toThrow()
  })

  it('accepts false', () => {
    expect(() => spoof.setPreferIfconfig(false)).not.toThrow()
    // Reset to default
    spoof.setPreferIfconfig(false)
  })
})

describe('spoof.findInterfaces()', () => {
  it('is a function', () => {
    expect(typeof spoof.findInterfaces).toBe('function')
  })

  it('does not throw when called without args', () => {
    expect(() => spoof.findInterfaces()).not.toThrow()
  })

  it('does not throw when called with empty array', () => {
    expect(() => spoof.findInterfaces([])).not.toThrow()
  })

  it('returns an array', () => {
    const interfaces = spoof.findInterfaces()
    expect(Array.isArray(interfaces)).toBe(true)
  })
})

describe('spoof.setRandomFunction()', () => {
  it('is a function', () => {
    expect(typeof spoof.setRandomFunction).toBe('function')
  })

  it('allows custom random for testing', () => {
    let callCount = 0
    const predictableRandom = (min: number, _max: number) => {
      callCount++
      return min
    }

    spoof.setRandomFunction(predictableRandom)
    const mac1 = spoof.randomize()
    expect(callCount).toBeGreaterThan(0)

    const previousCount = callCount
    const mac2 = spoof.randomize()
    expect(callCount).toBeGreaterThan(previousCount)
    expect(mac1).toBe(mac2)

    // Reset to default
    spoof.setRandomFunction(null)

    // Verify crypto random produces varied MACs
    const cryptoMacs = new Set<string>()
    for (let i = 0; i < 10; i++) {
      cryptoMacs.add(spoof.randomize())
    }
    expect(cryptoMacs.size).toBeGreaterThan(1)
  })
})

describe('spoof.randomize() uses cryptographically secure random by default', () => {
  it('crypto.randomInt is available', () => {
    expect(typeof randomInt).toBe('function')
  })

  it('produces valid and unique MACs', () => {
    const macs: string[] = []
    for (let i = 0; i < 100; i++) {
      macs.push(spoof.randomize())
    }

    // All should be valid normalized MACs
    macs.forEach((mac) => {
      expect(mac).toBe(spoof.normalize(mac))
    })

    // High entropy
    const unique = new Set(macs)
    expect(unique.size).toBeGreaterThan(90)
  })
})

describe('spoof.parseCSVLine()', () => {
  it('is a function', () => {
    expect(typeof spoof.parseCSVLine).toBe('function')
  })

  it('parses basic CSV line correctly', () => {
    expect(
      spoof.parseCSVLine('"Ethernet","Intel Adapter","00-11-22-33-44-55","\\Device\\Tcpip"')
    ).toEqual(['Ethernet', 'Intel Adapter', '00-11-22-33-44-55', '\\Device\\Tcpip'])
  })

  it('handles commas inside quoted fields', () => {
    expect(
      spoof.parseCSVLine('"Wi-Fi","Intel(R) Wireless, 802.11ac","AA-BB-CC-DD-EE-FF","\\Device"')
    ).toEqual(['Wi-Fi', 'Intel(R) Wireless, 802.11ac', 'AA-BB-CC-DD-EE-FF', '\\Device'])
  })

  it('handles escaped quotes correctly', () => {
    expect(
      spoof.parseCSVLine('"Name with ""quotes""","Adapter","00-00-00-00-00-00",""')
    ).toEqual(['Name with "quotes"', 'Adapter', '00-00-00-00-00-00', ''])
  })

  it('handles empty quoted fields', () => {
    expect(
      spoof.parseCSVLine('"","Empty","",""')
    ).toEqual(['', 'Empty', '', ''])
  })
})
