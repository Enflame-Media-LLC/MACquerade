/**
 * Tests for the standalone helper script.
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

  it('does not globally redirect stdin away from the script source', () => {
    expect(script).not.toContain('exec < /dev/tty')
    expect(script).toContain('stty -g < /dev/tty')
  })

  it('supports macOS, Linux, and Windows dependency bootstrapping', () => {
    expect(script).toContain('case "$OS_FAMILY" in')
    expect(script).toContain('darwin|linux')
    expect(script).toContain('windows')
    expect(script).toContain('install_or_update_homebrew')
    expect(script).toContain('install_or_update_chocolatey')
    expect(script).not.toContain('Error: This script is designed for macOS only.')
  })

  it('updates package managers and enforces Node 24 before building', () => {
    expect(script).toContain('brew update')
    expect(script).toContain('brew upgrade node')
    expect(script).toContain('run_choco_elevated upgrade chocolatey -y')
    expect(script).toContain('run_choco_elevated upgrade nodejs-lts -y')
    expect(script).toContain('MIN_NODE_MAJOR=24')
    expect(script).toContain('node_major()')
    expect(script).toContain("process.versions.node.split('.')[0]")
  })

  it('verifies downloaded installer scripts before execution', () => {
    expect(script).toContain('HOMEBREW_INSTALL_COMMIT=')
    expect(script).toContain('HOMEBREW_INSTALL_SHA256=')
    expect(script).not.toContain('raw.githubusercontent.com/Homebrew/install/HEAD/install.sh')
    expect(script).toContain('shasum -a 256')
    expect(script).toContain('sha256sum')
    expect(script).toContain('Homebrew installer checksum verification failed')
  })

  it('allows privileged Corepack setup to prompt through the terminal', () => {
    expect(script).toContain('sudo corepack enable > /dev/null < /dev/tty')
  })

  it('uses the platform-specific elevated runner when randomizing interfaces', () => {
    expect(script).toContain('run_spoof_command()')
    expect(script).toContain('sudo node dist/cli.js')
    expect(script).toContain('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command')
    expect(script).toContain('Start-Process -Wait -Verb RunAs')
  })

})
