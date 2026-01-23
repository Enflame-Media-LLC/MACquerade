/**
 * OUI (Organizationally Unique Identifier) database module
 * Provides vendor lookup, search, and MAC address generation by vendor
 */

import { createRequire } from 'node:module'
import { randomInt as cryptoRandomInt } from 'node:crypto'
import zeroFill from 'zero-fill'

const require = createRequire(import.meta.url)

// Load OUI database
const ouiData: Record<string, string> = require('./data/oui.json')

/**
 * Vendor lookup result
 */
export interface VendorInfo {
  /** The vendor/manufacturer name */
  vendor: string
  /** The OUI prefix (e.g., "00:11:22") */
  prefix: string
}

/**
 * MAC address format regex patterns
 */
const MAC_PATTERNS = {
  // Standard formats: 00:11:22:33:44:55, 00-11-22-33-44-55
  COLON_OR_DASH: /^([0-9A-Fa-f]{2})[:_-]([0-9A-Fa-f]{2})[:_-]([0-9A-Fa-f]{2})(?:[:_-]([0-9A-Fa-f]{2})[:_-]([0-9A-Fa-f]{2})[:_-]([0-9A-Fa-f]{2}))?$/,
  // Cisco format: 0011.2233.4455
  CISCO: /^([0-9A-Fa-f]{4})\.([0-9A-Fa-f]{4})\.([0-9A-Fa-f]{4})$/,
  // No separator: 001122334455 or 001122
  NO_SEP: /^([0-9A-Fa-f]{6}|[0-9A-Fa-f]{12})$/
}

/**
 * Normalize a MAC address or OUI prefix to uppercase colon format
 * @param mac - MAC address or OUI prefix in any format
 * @returns Normalized prefix (e.g., "00:11:22") or undefined if invalid
 */
function normalizePrefix(mac: string): string | undefined {
  const input = mac.trim().toUpperCase()

  // Try colon/dash format
  let match = MAC_PATTERNS.COLON_OR_DASH.exec(input)
  if (match) {
    return `${match[1]}:${match[2]}:${match[3]}`
  }

  // Try Cisco format
  match = MAC_PATTERNS.CISCO.exec(input)
  if (match) {
    const hex = match[1] + match[2] + match[3]
    return `${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}`
  }

  // Try no separator format
  match = MAC_PATTERNS.NO_SEP.exec(input)
  if (match) {
    const hex = match[1]
    return `${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}`
  }

  return undefined
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching vendor names
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Look up vendor by MAC address or OUI prefix
 * @param mac - MAC address or OUI prefix (e.g., "00:11:22:33:44:55" or "00:11:22")
 * @returns Vendor information or null if not found
 */
export function lookup(mac: string): VendorInfo | null {
  const prefix = normalizePrefix(mac)
  if (!prefix) {
    return null
  }

  const vendor = ouiData[prefix]
  if (vendor) {
    return { vendor, prefix }
  }

  return null
}

/**
 * Search vendors by name with fuzzy matching
 * @param query - Vendor name pattern to search for
 * @param limit - Maximum number of results (default: 50)
 * @returns Array of matching vendors, sorted by relevance
 */
export function searchVendors(query: string, limit: number = 50): VendorInfo[] {
  const pattern = query.toLowerCase().trim()

  if (!pattern) {
    return []
  }

  // Score and filter matches
  const matches: Array<VendorInfo & { score: number }> = []

  for (const [prefix, vendor] of Object.entries(ouiData)) {
    const vendorLower = vendor.toLowerCase()
    let score = 0

    // Exact match (highest priority)
    if (vendorLower === pattern) {
      score = 100
    }
    // Starts with query
    else if (vendorLower.startsWith(pattern)) {
      score = 80
    }
    // Contains query as word
    else if (vendorLower.includes(` ${pattern}`) || vendorLower.includes(`${pattern} `)) {
      score = 60
    }
    // Contains query anywhere
    else if (vendorLower.includes(pattern)) {
      score = 40
    }
    // Fuzzy match (for typo tolerance)
    else {
      // Check each word in vendor name
      const words = vendorLower.split(/[\s,.\-()]+/)
      for (const word of words) {
        if (word.length >= 3 && pattern.length >= 3) {
          const distance = levenshteinDistance(pattern, word)
          const maxLen = Math.max(pattern.length, word.length)
          // Allow up to 2 character difference for words >= 5 chars
          // Allow up to 1 character difference for shorter words
          const threshold = maxLen >= 5 ? 2 : 1
          if (distance <= threshold) {
            score = Math.max(score, 20 - distance * 5)
          }
        }
      }
    }

    if (score > 0) {
      matches.push({ vendor, prefix, score })
    }
  }

  // Sort by score (descending), then by vendor name (ascending)
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.vendor.localeCompare(b.vendor)
  })

  // Return without score property
  return matches.slice(0, limit).map(({ vendor, prefix }) => ({ vendor, prefix }))
}

/**
 * Get all unique vendor names in the database
 * @returns Array of unique vendor names
 */
export function getVendorNames(): string[] {
  return [...new Set(Object.values(ouiData))].toSorted()
}

/**
 * Get all OUI prefixes for a specific vendor
 * @param vendorName - Exact vendor name
 * @returns Array of OUI prefixes for this vendor
 */
export function getPrefixesForVendor(vendorName: string): string[] {
  const prefixes: string[] = []
  const vendorLower = vendorName.toLowerCase()

  for (const [prefix, vendor] of Object.entries(ouiData)) {
    if (vendor.toLowerCase() === vendorLower) {
      prefixes.push(prefix)
    }
  }

  return prefixes.toSorted()
}

/**
 * Get database statistics
 * @returns Object with database stats
 */
export function getDatabaseStats(): { totalPrefixes: number; uniqueVendors: number } {
  const vendors = new Set(Object.values(ouiData))
  return {
    totalPrefixes: Object.keys(ouiData).length,
    uniqueVendors: vendors.size
  }
}

/**
 * Generate a random MAC address with a specific vendor prefix
 * @param vendorQuery - Vendor name to match
 * @param localAdmin - Set the locally administered bit (default: false)
 * @returns Random MAC address with the vendor's prefix
 * @throws Error if no vendor matches the query
 */
export function randomizeAsVendor(vendorQuery: string, localAdmin: boolean = false): string {
  const matches = searchVendors(vendorQuery, 100)

  if (matches.length === 0) {
    throw new Error(`No vendor found matching: ${vendorQuery}`)
  }

  // Pick a random matching vendor
  const randomIndex = cryptoRandomInt(0, matches.length)
  const { prefix } = matches[randomIndex]

  // Parse the prefix bytes
  const prefixBytes = prefix.split(':').map(b => parseInt(b, 16))

  // Generate random suffix bytes
  const mac: number[] = [
    prefixBytes[0],
    prefixBytes[1],
    prefixBytes[2],
    cryptoRandomInt(0x00, 0x100), // 0-255
    cryptoRandomInt(0x00, 0x100),
    cryptoRandomInt(0x00, 0x100)
  ]

  if (localAdmin) {
    // Set the locally administered bit (second least significant bit of first byte)
    mac[0] |= 2
  }

  const macString = mac
    .map(byte => zeroFill(2, byte.toString(16)))
    .join(':')
    .toUpperCase()

  return macString
}

/**
 * Get the vendor information for a randomly generated MAC
 * Useful for displaying which vendor was selected
 * @param vendorQuery - Vendor name to match
 * @returns Object with the selected vendor info and generated MAC
 */
export function randomizeAsVendorWithInfo(
  vendorQuery: string,
  localAdmin: boolean = false
): { mac: string; vendor: string; prefix: string } {
  const matches = searchVendors(vendorQuery, 100)

  if (matches.length === 0) {
    throw new Error(`No vendor found matching: ${vendorQuery}`)
  }

  // Pick a random matching vendor
  const randomIndex = cryptoRandomInt(0, matches.length)
  const { prefix, vendor } = matches[randomIndex]

  // Parse the prefix bytes
  const prefixBytes = prefix.split(':').map(b => parseInt(b, 16))

  // Generate random suffix bytes
  const mac: number[] = [
    prefixBytes[0],
    prefixBytes[1],
    prefixBytes[2],
    cryptoRandomInt(0x00, 0x100),
    cryptoRandomInt(0x00, 0x100),
    cryptoRandomInt(0x00, 0x100)
  ]

  if (localAdmin) {
    mac[0] |= 2
  }

  const macString = mac
    .map(byte => zeroFill(2, byte.toString(16)))
    .join(':')
    .toUpperCase()

  return { mac: macString, vendor, prefix }
}

export {
  normalizePrefix,
  ouiData
}
