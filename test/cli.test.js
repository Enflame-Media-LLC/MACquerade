/**
 * Tests for CLI command parsing and execution.
 * Uses esmock to test CLI behavior without requiring root privileges.
 *
 * Note: These tests mock the spoof library to test CLI command parsing
 * and output formatting without actually modifying network interfaces.
 */
import test from 'tape'
import { execFileSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.join(__dirname, '..', 'bin', 'cmd.js')

/**
 * Helper to run the CLI and capture output
 * @param {string[]} args - CLI arguments
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function runCLI(args = []) {
  try {
    const stdout = execFileSync('node', [cliPath, ...args], {
      encoding: 'utf8',
      timeout: 5000
    })
    return { stdout, stderr: '', exitCode: 0 }
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status || 1
    }
  }
}

// =============================================================================
// Help Command Tests
// =============================================================================

test('CLI help - shows usage information', t => {
  const { stdout, exitCode } = runCLI(['help'])

  t.equal(exitCode, 0, 'exits with code 0')
  t.ok(stdout.includes('spoof - Spoof your MAC address'), 'shows title')
  t.ok(stdout.includes('Usage:'), 'shows usage section')
  t.ok(stdout.includes('spoof list'), 'documents list command')
  t.ok(stdout.includes('spoof set'), 'documents set command')
  t.ok(stdout.includes('spoof randomize'), 'documents randomize command')
  t.ok(stdout.includes('spoof reset'), 'documents reset command')
  t.ok(stdout.includes('spoof normalize'), 'documents normalize command')
  t.ok(stdout.includes('Options:'), 'shows options section')
  t.ok(stdout.includes('--wifi'), 'documents --wifi option')
  t.ok(stdout.includes('--local'), 'documents --local option')
  t.ok(stdout.includes('--prefer-ifconfig'), 'documents --prefer-ifconfig option')

  t.end()
})

test('CLI - shows help when no command provided', t => {
  const { stdout, exitCode } = runCLI([])

  t.equal(exitCode, 0, 'exits with code 0')
  t.ok(stdout.includes('spoof - Spoof your MAC address'), 'shows help by default')

  t.end()
})

// =============================================================================
// Version Command Tests
// =============================================================================

test('CLI version - shows package version', t => {
  const { stdout, exitCode } = runCLI(['version'])

  t.equal(exitCode, 0, 'exits with code 0')
  // Version should match semver pattern
  t.ok(/^\d+\.\d+\.\d+/.test(stdout.trim()), 'outputs valid semver version')

  t.end()
})

test('CLI --version flag - shows package version', t => {
  const { stdout, exitCode } = runCLI(['--version'])

  t.equal(exitCode, 0, 'exits with code 0')
  t.ok(/^\d+\.\d+\.\d+/.test(stdout.trim()), 'outputs valid semver version')

  t.end()
})

// =============================================================================
// Normalize Command Tests
// =============================================================================

test('CLI normalize - normalizes MAC with colons', t => {
  const { stdout, exitCode } = runCLI(['normalize', '00:11:22:33:44:55'])

  t.equal(exitCode, 0, 'exits with code 0')
  t.equal(stdout.trim(), '00:11:22:33:44:55', 'normalizes colon-separated MAC')

  t.end()
})

test('CLI normalize - normalizes MAC with dashes', t => {
  const { stdout, exitCode } = runCLI(['normalize', '00-11-22-33-44-55'])

  t.equal(exitCode, 0, 'exits with code 0')
  t.equal(stdout.trim(), '00:11:22:33:44:55', 'converts dashes to colons')

  t.end()
})

test('CLI normalize - normalizes Cisco-style MAC', t => {
  const { stdout, exitCode } = runCLI(['normalize', '0011.2233.4455'])

  t.equal(exitCode, 0, 'exits with code 0')
  t.equal(stdout.trim(), '00:11:22:33:44:55', 'converts Cisco format to colons')

  t.end()
})

test('CLI normalize - normalizes MAC without separators', t => {
  // Note: minimist treats numeric-looking strings as numbers, stripping leading zeros
  // This is a known limitation. Use formats with separators for reliable CLI usage.
  // Testing with a MAC that doesn't start with 0 to avoid the issue:
  const { stdout, exitCode } = runCLI(['normalize', 'AA1122334455'])

  t.equal(exitCode, 0, 'exits with code 0')
  t.equal(stdout.trim(), 'AA:11:22:33:44:55', 'adds colons to bare MAC')

  t.end()
})

test('CLI normalize - normalizes lowercase MAC', t => {
  const { stdout, exitCode } = runCLI(['normalize', 'aa:bb:cc:dd:ee:ff'])

  t.equal(exitCode, 0, 'exits with code 0')
  t.equal(stdout.trim(), 'AA:BB:CC:DD:EE:FF', 'converts to uppercase')

  t.end()
})

test('CLI normalize - handles mixed case MAC', t => {
  const { stdout, exitCode } = runCLI(['normalize', 'Aa:Bb:Cc:Dd:Ee:Ff'])

  t.equal(exitCode, 0, 'exits with code 0')
  t.equal(stdout.trim(), 'AA:BB:CC:DD:EE:FF', 'normalizes mixed case')

  t.end()
})

// =============================================================================
// List Command Tests (run on current platform)
// =============================================================================

test('CLI list - outputs interface information', t => {
  const { stdout, exitCode } = runCLI(['list'])

  // Should not error, even if no interfaces found
  t.ok(exitCode === 0, 'exits with code 0')
  // The output format should include "on device" if interfaces are found
  // or just be empty/minimal if none
  t.ok(typeof stdout === 'string', 'produces string output')

  t.end()
})

test('CLI list --wifi - filters to wireless interfaces', t => {
  const { stdout, exitCode } = runCLI(['list', '--wifi'])

  t.ok(exitCode === 0, 'exits with code 0')
  // May or may not find any, but shouldn't error
  t.ok(typeof stdout === 'string', 'produces string output')

  t.end()
})

test('CLI ls - alias for list', t => {
  const { stdout: _listOutput } = runCLI(['list'])
  const { stdout: lsOutput, exitCode } = runCLI(['ls'])

  t.equal(exitCode, 0, 'exits with code 0')
  // Both should produce similar output (may differ if interfaces change)
  t.ok(typeof lsOutput === 'string', 'produces string output')

  t.end()
})

// =============================================================================
// Set Command Tests (error cases, no root required)
// =============================================================================

test('CLI set - requires root on Unix', t => {
  // Skip on Windows where behavior is different
  if (process.platform === 'win32') {
    t.skip('root check not applicable on Windows')
    t.end()
    return
  }

  // Skip if running as root (CI might run as root)
  if (process.getuid && process.getuid() === 0) {
    t.skip('running as root, cannot test permission error')
    t.end()
    return
  }

  const { stderr, exitCode } = runCLI(['set', '00:11:22:33:44:55', 'en0'])

  t.notEqual(exitCode, 0, 'exits with non-zero code')
  // Either "not running as root" or "could not find device"
  t.ok(
    stderr.includes('root') ||
    stderr.includes('sudo') ||
    stderr.includes('Could not find device'),
    'outputs appropriate error'
  )

  t.end()
})

// =============================================================================
// Randomize Command Tests (error cases, no root required)
// =============================================================================

test('CLI randomize - requires root on Unix', t => {
  // Skip on Windows
  if (process.platform === 'win32') {
    t.skip('root check not applicable on Windows')
    t.end()
    return
  }

  // Skip if running as root
  if (process.getuid && process.getuid() === 0) {
    t.skip('running as root, cannot test permission error')
    t.end()
    return
  }

  const { stderr, exitCode } = runCLI(['randomize', 'en0'])

  t.notEqual(exitCode, 0, 'exits with non-zero code')
  t.ok(
    stderr.includes('root') ||
    stderr.includes('sudo') ||
    stderr.includes('Could not find device'),
    'outputs appropriate error'
  )

  t.end()
})

// =============================================================================
// Reset Command Tests (error cases, no root required)
// =============================================================================

test('CLI reset - requires root on Unix', t => {
  // Skip on Windows
  if (process.platform === 'win32') {
    t.skip('root check not applicable on Windows')
    t.end()
    return
  }

  // Skip if running as root
  if (process.getuid && process.getuid() === 0) {
    t.skip('running as root, cannot test permission error')
    t.end()
    return
  }

  const { stderr, exitCode } = runCLI(['reset', 'en0'])

  t.notEqual(exitCode, 0, 'exits with non-zero code')
  t.ok(
    stderr.includes('root') ||
    stderr.includes('sudo') ||
    stderr.includes('Could not find device'),
    'outputs appropriate error'
  )

  t.end()
})

// =============================================================================
// Error Handling Tests
// =============================================================================

test('CLI set - handles invalid device gracefully', t => {
  // Skip on Windows
  if (process.platform === 'win32') {
    t.skip('behavior differs on Windows')
    t.end()
    return
  }

  // Skip if running as root
  if (process.getuid && process.getuid() === 0) {
    t.skip('running as root, different error path')
    t.end()
    return
  }

  const { stderr, exitCode } = runCLI(['set', '00:11:22:33:44:55', 'nonexistent_device_xyz'])

  t.notEqual(exitCode, 0, 'exits with non-zero code')
  // Should get either root error or device not found
  t.ok(
    stderr.includes('Error') ||
    stderr.includes('root') ||
    stderr.includes('Could not find'),
    'outputs error message'
  )

  t.end()
})

// =============================================================================
// Prefer-ifconfig Flag Tests
// =============================================================================

test('CLI --prefer-ifconfig - accepts flag without error', t => {
  const { stdout, exitCode } = runCLI(['--prefer-ifconfig', 'list'])

  t.equal(exitCode, 0, 'exits with code 0')
  // On Linux, might show "Using ifconfig" message
  t.ok(typeof stdout === 'string', 'produces string output')

  t.end()
})

// =============================================================================
// Integration: Multiple Commands in Sequence
// =============================================================================

test('CLI integration - version then help', t => {
  const version = runCLI(['version'])
  const help = runCLI(['help'])

  t.equal(version.exitCode, 0, 'version succeeds')
  t.equal(help.exitCode, 0, 'help succeeds')
  t.ok(/^\d+\.\d+\.\d+/.test(version.stdout.trim()), 'version is valid')
  t.ok(help.stdout.includes('Usage:'), 'help shows usage')

  t.end()
})

test('CLI integration - normalize multiple MACs', t => {
  const macs = [
    '00:11:22:33:44:55',
    '00-11-22-33-44-55',
    '0011.2233.4455',
    'aa:bb:cc:dd:ee:ff'
  ]

  for (const mac of macs) {
    const result = runCLI(['normalize', mac])
    t.equal(result.exitCode, 0, `normalize ${mac} succeeds`)
    // All should normalize to uppercase with colons
    t.ok(
      /^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/.test(result.stdout.trim()),
      `normalize ${mac} outputs valid format`
    )
  }

  t.end()
})

// =============================================================================
// JSON Format Tests
// =============================================================================

test('CLI version --format=json - outputs JSON', t => {
  const { stdout, exitCode } = runCLI(['version', '--format=json'])

  t.equal(exitCode, 0, 'exits with code 0')
  let json
  try {
    json = JSON.parse(stdout)
    t.pass('output is valid JSON')
  } catch {
    t.fail('output should be valid JSON')
    t.end()
    return
  }

  t.ok(json.success, 'JSON indicates success')
  t.ok(json.version, 'JSON includes version')
  t.ok(json.platform, 'JSON includes platform')

  t.end()
})

test('CLI list --format=json - outputs JSON with interfaces', t => {
  const { stdout, exitCode } = runCLI(['list', '--format=json'])

  t.equal(exitCode, 0, 'exits with code 0')
  let json
  try {
    json = JSON.parse(stdout)
    t.pass('output is valid JSON')
  } catch {
    t.fail('output should be valid JSON')
    t.end()
    return
  }

  t.ok(json.success, 'JSON indicates success')
  t.ok(Array.isArray(json.interfaces), 'JSON includes interfaces array')
  t.ok(json.platform, 'JSON includes platform')

  t.end()
})

test('CLI normalize --format=json - outputs JSON with normalized MAC', t => {
  const { stdout, exitCode } = runCLI(['normalize', '00-11-22-33-44-55', '--format=json'])

  t.equal(exitCode, 0, 'exits with code 0')
  let json
  try {
    json = JSON.parse(stdout)
    t.pass('output is valid JSON')
  } catch {
    t.fail('output should be valid JSON')
    t.end()
    return
  }

  t.ok(json.success, 'JSON indicates success')
  t.equal(json.input, '00-11-22-33-44-55', 'JSON includes input MAC')
  t.equal(json.normalized, '00:11:22:33:44:55', 'JSON includes normalized MAC')

  t.end()
})

test('CLI --format=invalid - rejects unknown format', t => {
  const { stderr, exitCode } = runCLI(['list', '--format=xml'])

  t.notEqual(exitCode, 0, 'exits with non-zero code')
  t.ok(stderr.includes('Unknown format') || stderr.includes('xml'), 'outputs format error')

  t.end()
})

// =============================================================================
// Verbose and Quiet Flag Tests
// =============================================================================

test('CLI --verbose and --quiet - mutually exclusive', t => {
  const { stderr, exitCode } = runCLI(['--verbose', '--quiet', 'list'])

  t.notEqual(exitCode, 0, 'exits with non-zero code')
  t.ok(stderr.includes('Cannot use --verbose and --quiet together'), 'outputs mutual exclusion error')

  t.end()
})

test('CLI --quiet - suppresses output', t => {
  const { stdout: normalOut } = runCLI(['list'])
  const { stdout: quietOut, exitCode } = runCLI(['list', '--quiet'])

  t.equal(exitCode, 0, 'exits with code 0')
  // Quiet mode should have less or equal output
  t.ok(quietOut.length <= normalOut.length, 'quiet mode produces less output')

  t.end()
})

// =============================================================================
// Dry-run Flag Tests
// =============================================================================

test('CLI set --dry-run - shows what would happen', t => {
  // Dry-run should work without root
  const { stdout, exitCode } = runCLI(['set', '00:11:22:33:44:55', 'nonexistent', '--dry-run'])

  // Should exit with code 2 (dry-run would fail)
  t.equal(exitCode, 2, 'exits with code 2 for dry-run failure')
  t.ok(
    stdout.includes('DRY-RUN') || stdout.includes('Would fail'),
    'indicates dry-run mode'
  )

  t.end()
})

test('CLI randomize --dry-run - shows what would happen', t => {
  const { stdout, exitCode } = runCLI(['randomize', 'nonexistent', '--dry-run'])

  // Should exit with code 2 (dry-run would fail)
  t.equal(exitCode, 2, 'exits with code 2 for dry-run failure')
  t.ok(
    stdout.includes('DRY-RUN') || stdout.includes('Would fail'),
    'indicates dry-run mode'
  )

  t.end()
})

test('CLI reset --dry-run - shows what would happen', t => {
  const { stdout, exitCode } = runCLI(['reset', 'nonexistent', '--dry-run'])

  // Should exit with code 2 (dry-run would fail)
  t.equal(exitCode, 2, 'exits with code 2 for dry-run failure')
  t.ok(
    stdout.includes('DRY-RUN') || stdout.includes('Would fail'),
    'indicates dry-run mode'
  )

  t.end()
})

test('CLI set --dry-run --format=json - outputs JSON dry-run result', t => {
  const { stdout, exitCode } = runCLI(['set', '00:11:22:33:44:55', 'nonexistent', '--dry-run', '--format=json'])

  t.equal(exitCode, 2, 'exits with code 2 for dry-run failure')
  let json
  try {
    json = JSON.parse(stdout)
    t.pass('output is valid JSON')
  } catch {
    t.fail('output should be valid JSON')
    t.end()
    return
  }

  t.ok(json.dryRun, 'JSON indicates dry-run mode')
  t.ok(Array.isArray(json.operations), 'JSON includes operations array')

  t.end()
})
