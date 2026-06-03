#!/usr/bin/env node
/**
 * Update OUI Database Script
 *
 * Downloads the IEEE OUI database and converts it to JSON format.
 * Run with: npx tsx scripts/update-oui.ts
 *
 * Source: https://standards-oui.ieee.org/oui/oui.csv
 */

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))

const IEEE_OUI_URL = 'https://standards-oui.ieee.org/oui/oui.csv'
const OUTPUT_PATH = resolve(scriptDir, '../src/data/oui.json')

// Top vendors to prioritize (most common device manufacturers)
const TOP_VENDORS = [
  'apple',
  'samsung',
  'intel',
  'cisco',
  'huawei',
  'dell',
  'hewlett',
  'hp ',
  'lenovo',
  'microsoft',
  'google',
  'amazon',
  'asus',
  'netgear',
  'tp-link',
  'd-link',
  'linksys',
  'ubiquiti',
  'vmware',
  'broadcom',
  'qualcomm',
  'realtek',
  'mediatek',
  'nvidia',
  'amd',
  'lg ',
  'sony',
  'panasonic',
  'toshiba',
  'motorola',
  'nokia',
  'ericsson',
  'honeywell',
  'siemens',
  'bosch',
  'schneider',
  'texas instruments',
  'raspberry',
  'espressif',
  'arduino',
  'seagate',
  'western digital',
  'sandisk',
  'kingston',
  'crucial',
  'corsair',
  'logitech',
  'razer',
  'belkin',
  'zyxel',
  'arris',
  'aruba',
  'juniper',
  'fortinet',
  'palo alto',
  'f5 ',
  'checkpoint',
  'sonicwall',
  'meraki',
  'ruckus',
  'cambium',
  'mikrotik',
  'synology',
  'qnap',
  'buffalo',
  'netapp',
  'emc',
  'hitachi',
  'fujitsu',
  'nec',
  'ibm',
  'oracle',
  'supermicro',
  'inspur',
  'hikvision',
  'dahua',
  'axis',
  'bosch security',
  'honeywell security',
  'johnson controls',
  'schneider electric',
  'abb',
  'rockwell',
  'emerson',
  'ge ',
  'philips',
  'osram',
  'signify',
  'lutron',
  'control4',
  'crestron',
  'savant',
  'elan',
  'ring',
  'nest',
  'ecobee',
  'honeywell home',
  'emerson sensi'
]

async function downloadOUI(): Promise<string> {
  console.log(`Downloading OUI database from ${IEEE_OUI_URL}...`)

  const response = await fetch(IEEE_OUI_URL)
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  console.log(`Downloaded ${(text.length / 1024 / 1024).toFixed(2)} MB`)
  return text
}

function parseCSV(csv: string): Map<string, string> {
  const lines = csv.split('\n')
  const entries = new Map<string, string>()

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // CSV format: Registry,Assignment,Organization Name,Organization Address
    // We need Assignment (OUI) and Organization Name
    const match = line.match(/^([^,]*),([0-9A-Fa-f]{6}),([^,"]*)/)
    if (match) {
      const oui = match[2].toUpperCase()
      const vendor = match[3].trim()

      if (oui && vendor) {
        // Convert OUI to colon format: 001122 -> 00:11:22
        const prefix = `${oui.slice(0, 2)}:${oui.slice(2, 4)}:${oui.slice(4, 6)}`
        entries.set(prefix, vendor)
      }
    }
  }

  return entries
}

function filterTopVendors(entries: Map<string, string>, limit: number = 2000): Record<string, string> {
  const result: Record<string, string> = {}
  const vendorCounts = new Map<string, number>()

  // Count entries per vendor (normalized)
  for (const vendor of entries.values()) {
    const normalized = vendor.toLowerCase()
    vendorCounts.set(normalized, (vendorCounts.get(normalized) || 0) + 1)
  }

  // First pass: add all entries from top vendors
  for (const [prefix, vendor] of entries) {
    const vendorLower = vendor.toLowerCase()
    for (const topVendor of TOP_VENDORS) {
      if (vendorLower.includes(topVendor)) {
        result[prefix] = vendor
        break
      }
    }
  }

  console.log(`Added ${Object.keys(result).length} entries from top vendors`)

  // Second pass: add remaining entries up to limit
  // Sort by vendor frequency (most common first)
  const remaining = [...entries.entries()]
    .filter(([prefix]) => !(prefix in result))
    .toSorted((a, b) => {
      const countA = vendorCounts.get(a[1].toLowerCase()) || 0
      const countB = vendorCounts.get(b[1].toLowerCase()) || 0
      return countB - countA
    })

  for (const [prefix, vendor] of remaining) {
    if (Object.keys(result).length >= limit) break
    result[prefix] = vendor
  }

  return result
}

async function main(): Promise<void> {
  try {
    const csv = await downloadOUI()
    const entries = parseCSV(csv)
    console.log(`Parsed ${entries.size} OUI entries`)

    const filtered = filterTopVendors(entries, 2000)
    const sortedResult: Record<string, string> = {}

    // Sort by prefix for consistent output
    const sortedKeys = Object.keys(filtered).toSorted()
    for (const key of sortedKeys) {
      sortedResult[key] = filtered[key]
    }

    const uniqueVendors = new Set(Object.values(sortedResult))
    console.log(`Selected ${Object.keys(sortedResult).length} prefixes from ${uniqueVendors.size} vendors`)

    // Write to file
    const json = JSON.stringify(sortedResult, null, 2)
    writeFileSync(OUTPUT_PATH, json + '\n')
    console.log(`Wrote ${(json.length / 1024).toFixed(2)} KB to ${OUTPUT_PATH}`)

    console.log('\nDone! OUI database updated successfully.')
  } catch (error) {
    console.error('Error updating OUI database:', error)
    process.exit(1)
  }
}

main()
