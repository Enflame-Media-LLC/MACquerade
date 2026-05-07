/**
 * Tests for the standalone macOS helper script.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const script = readFileSync('scripts/mac-randomize.sh', 'utf8')

describe('scripts/mac-randomize.sh', () => {
  it('does not parse interface metadata through shell eval', () => {
    const start = script.indexOf('# Parse interface data into parallel arrays')
    const end = script.indexOf('if [ "$iface_count" -eq 0 ]')
    const interfaceParsingBlock = script.slice(start, end)

    expect(interfaceParsingBlock).not.toContain('eval "$(')
    expect(interfaceParsingBlock).not.toMatch(/\beval\b/)
  })
})
