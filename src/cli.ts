#!/usr/bin/env node

import chalk from 'chalk'
import minimist from 'minimist'
import * as spoof from './index.js'
import * as oui from './oui.js'
import { stripIndent } from 'common-tags'
import { createRequire } from 'module'
import type { NetworkInterface } from './types.js'

const require = createRequire(import.meta.url)

interface ParsedArgs {
  _: string[]
  verbose?: boolean
  v?: boolean
  quiet?: boolean
  q?: boolean
  'dry-run'?: boolean
  n?: boolean
  version?: boolean
  'prefer-ifconfig'?: boolean
  format?: string
  wifi?: boolean
  local?: boolean
  vendor?: string
  timeout?: number
}

interface OperationResult {
  device: string
  port?: string
  currentAddress?: string | null
  newAddress?: string
  success: boolean
  error?: string
}

interface ErrorWithCode extends Error {
  code?: string
}

const argv = minimist<ParsedArgs>(process.argv.slice(2), {
  alias: {
    v: 'verbose',
    q: 'quiet',
    n: 'dry-run'
  },
  boolean: [
    'version',
    'prefer-ifconfig',
    'dry-run',
    'verbose',
    'quiet'
  ],
  string: ['format', 'vendor'],
  default: {
    timeout: spoof.DEFAULT_TIMEOUT
  }
})
const cmd = argv._[0]
const isJson = argv.format === 'json'
const isDryRun = argv['dry-run']
const isVerbose = argv.verbose && !argv.quiet
const isQuiet = argv.quiet
const timeout = argv.timeout

function requireArg(value: string | undefined, message: string): string {
  if (!value) throw new Error(message)
  return value
}

function requireDevices(devices: string[], commandName: string): void {
  if (devices.length === 0) {
    throw new Error(`Please provide at least one device for ${commandName}`)
  }
}

// Validate mutually exclusive flags
if (argv.verbose && argv.quiet) {
  outputError(new Error('Cannot use --verbose and --quiet together'))
  process.exitCode = 1
  process.exit(1)
}

// Validate format flag
if (argv.format && argv.format !== 'json') {
  outputError(new Error(`Unknown format: ${argv.format}. Supported formats: json`))
  process.exitCode = 1
  process.exit(1)
}

// Configure tool preference before any operations
if (argv['prefer-ifconfig']) {
  spoof.setPreferIfconfig(true)
}

// Main entry point - use async IIFE
;(async () => {
  try {
    await init()
  } catch (err) {
    outputError(err as ErrorWithCode)
    process.exitCode = 1
  }
})()

/**
 * Output a message respecting --quiet and --format flags
 */
function output(message: string): void {
  if (isQuiet) return
  if (isJson) return // JSON mode uses structured output only
  console.log(message)
}

/**
 * Output verbose/debug information
 */
function verbose(message: string): void {
  if (!isVerbose) return
  console.error(chalk.dim(`[VERBOSE] ${message}`))
}

/**
 * Output an error respecting --format flag
 */
function outputError(err: ErrorWithCode): void {
  if (isJson) {
    const errorObj: { message: string; code?: string } = { message: err.message }
    if ('code' in err && err.code) {
      errorObj.code = err.code
    }
    console.log(JSON.stringify({
      success: false,
      error: errorObj
    }, null, 2))
  } else {
    console.error(chalk.red('Error:', err.message))
  }
}

/**
 * Output JSON response for commands
 */
function outputJson(data: Record<string, unknown>): void {
  const response = {
    success: true,
    ...data,
    platform: process.platform,
    version: (require('../package.json') as { version: string }).version
  }
  console.log(JSON.stringify(response, null, 2))
}

async function init(): Promise<void> {
  if (cmd === 'version' || argv.version) {
    version()
  } else if (cmd === 'list' || cmd === 'ls') {
    await list()
  } else if (cmd === 'set') {
    const mac = requireArg(argv._[1], 'Please provide a MAC address to set')
    const devices = argv._.slice(2)
    await set(mac, devices)
  } else if (cmd === 'randomize') {
    const devices = argv._.slice(1)
    await randomize(devices)
  } else if (cmd === 'reset') {
    const devices = argv._.slice(1)
    await reset(devices)
  } else if (cmd === 'normalize') {
    const mac = requireArg(argv._[1], 'Please provide a MAC address to normalize')
    normalizeCmd(mac)
  } else if (cmd === 'lookup') {
    const mac = argv._[1]
    lookupCmd(mac)
  } else if (cmd === 'vendors') {
    const query = argv._.slice(1).join(' ')
    vendorsCmd(query)
  } else {
    help()
  }
}

function help(): void {
  const message = stripIndent`
    MACquerade - Spoof your MAC address

    Example (randomize MAC address on macOS):
      macquerade randomize en0

    Usage:
      macquerade list [--wifi]                            List available devices.
      macquerade set <mac> <devices>...                   Set device MAC address.
      macquerade randomize [--local] [--vendor=<name>] <devices>...
                                                     Set device MAC address randomly.
      macquerade reset <devices>...                       Reset device MAC address to default.
      macquerade normalize <mac>                          Given a MAC address, normalize it.
      macquerade lookup <mac>                             Look up vendor for a MAC address.
      macquerade vendors [<query>]                        Search OUI vendor database.
      macquerade help                                     Shows this help message.
      macquerade version                                  Show package version.

    Options:
      --wifi              Try to only show wireless interfaces.
      --local             Set the locally administered flag on randomized MACs.
      --vendor=<name>     Use a specific vendor's OUI prefix when randomizing.
      --prefer-ifconfig   On Linux, use ifconfig instead of ip command.
      --format=json       Output in JSON format (for scripting/automation).
      --dry-run, -n       Show what would happen without making changes.
      --verbose, -v       Show detailed diagnostic information.
      --quiet, -q         Suppress non-essential output.
      --timeout=<ms>      Timeout for operations in milliseconds (default: 30000).

    Examples:
      macquerade lookup 00:03:93:12:34:56       # Look up Apple device
      macquerade vendors apple                   # Search for Apple OUIs
      macquerade randomize en0 --vendor=samsung  # Randomize as Samsung device

    Exit codes:
      0  Success
      1  Error
      2  Dry-run would fail (device not found, etc.)
  `
  console.log(message)
}

function version(): void {
  const ver = (require('../package.json') as { version: string }).version
  if (isJson) {
    outputJson({ version: ver })
  } else {
    console.log(ver)
  }
}

async function set(mac: string, devices: string[]): Promise<void> {
  verbose(`Setting MAC address to ${mac} for devices: ${devices.join(', ')}`)
  requireDevices(devices, 'set')

  const results: OperationResult[] = []

  for (const device of devices) {
    verbose(`Looking up device: ${device}`)
    const it = await spoof.findInterfaceAsync(device, { timeout })

    if (!it) {
      if (isDryRun) {
        results.push({ device, success: false, error: 'Device not found' })
        if (!isJson && !isQuiet) {
          console.log(chalk.yellow(`[DRY-RUN] Would fail: Could not find device for ${device}`))
        }
        process.exitCode = 2
        continue
      }
      throw new Error('Could not find device for ' + device)
    }

    verbose(`Found device ${it.device} (${it.port}) with current MAC: ${it.currentAddress}`)

    if (isDryRun) {
      const result: OperationResult = {
        device: it.device,
        port: it.port,
        currentAddress: it.currentAddress,
        newAddress: mac,
        success: true
      }
      results.push(result)
      if (!isJson && !isQuiet) {
        console.log(chalk.cyan(`[DRY-RUN] Would set ${it.device} (${it.port}) MAC to ${mac}`))
      }
      continue
    }

    await setMACAddress(it.device, mac, it.port)
    results.push({ device: it.device, port: it.port, newAddress: mac, success: true })
    output(`Set ${it.device} (${it.port}) MAC to ${mac}`)
  }

  if (isJson && isDryRun) {
    outputJson({ dryRun: true, operations: results })
  } else if (isJson) {
    outputJson({ operations: results })
  }
}

function normalizeCmd(mac: string): void {
  verbose(`Normalizing MAC address: ${mac}`)
  const normalized = spoof.normalize(mac)
  if (isJson) {
    outputJson({ input: mac, normalized })
  } else {
    console.log(normalized)
  }
}

async function randomize(devices: string[]): Promise<void> {
  verbose(`Randomizing MAC address for devices: ${devices.join(', ')}`)
  requireDevices(devices, 'randomize')

  if (argv.local) {
    verbose('Using locally administered address flag')
  }
  if (argv.vendor) {
    verbose(`Using vendor prefix for: ${argv.vendor}`)
  }

  const results: OperationResult[] = []

  for (const device of devices) {
    verbose(`Looking up device: ${device}`)
    const it = await spoof.findInterfaceAsync(device, { timeout })

    if (!it) {
      if (isDryRun) {
        results.push({ device, success: false, error: 'Device not found' })
        if (!isJson && !isQuiet) {
          console.log(chalk.yellow(`[DRY-RUN] Would fail: Could not find device for ${device}`))
        }
        process.exitCode = 2
        continue
      }
      throw new Error('Could not find device for ' + device)
    }

    let mac: string
    let vendorInfo: { vendor: string; prefix: string } | undefined

    if (argv.vendor) {
      // Use vendor-specific randomization
      const result = oui.randomizeAsVendorWithInfo(argv.vendor, argv.local)
      mac = result.mac
      vendorInfo = { vendor: result.vendor, prefix: result.prefix }
      verbose(`Generated vendor MAC: ${mac} (${vendorInfo.vendor}) for ${it.device}`)
    } else {
      // Use default VM vendor randomization
      mac = spoof.randomize(argv.local)
      verbose(`Generated random MAC: ${mac} for ${it.device}`)
    }

    if (isDryRun) {
      const result: OperationResult & { vendor?: string } = {
        device: it.device,
        port: it.port,
        currentAddress: it.currentAddress,
        newAddress: mac,
        success: true
      }
      if (vendorInfo) {
        result.vendor = vendorInfo.vendor
      }
      results.push(result)
      if (!isJson && !isQuiet) {
        const vendorMsg = vendorInfo ? ` (${vendorInfo.vendor})` : ''
        console.log(chalk.cyan(`[DRY-RUN] Would set ${it.device} (${it.port}) MAC to ${mac}${vendorMsg}`))
      }
      continue
    }

    await setMACAddress(it.device, mac, it.port)
    const opResult: OperationResult & { vendor?: string } = {
      device: it.device,
      port: it.port,
      newAddress: mac,
      success: true
    }
    if (vendorInfo) {
      opResult.vendor = vendorInfo.vendor
    }
    results.push(opResult)
    const vendorMsg = vendorInfo ? ` (${vendorInfo.vendor})` : ''
    output(`Set ${it.device} (${it.port}) MAC to ${mac}${vendorMsg}`)
  }

  if (isJson && isDryRun) {
    outputJson({ dryRun: true, operations: results })
  } else if (isJson) {
    outputJson({ operations: results })
  }
}

async function reset(devices: string[]): Promise<void> {
  verbose(`Resetting MAC address to hardware default for devices: ${devices.join(', ')}`)
  requireDevices(devices, 'reset')

  const results: OperationResult[] = []

  for (const device of devices) {
    verbose(`Looking up device: ${device}`)
    const it = await spoof.findInterfaceAsync(device, { timeout })

    if (!it) {
      if (isDryRun) {
        results.push({ device, success: false, error: 'Device not found' })
        if (!isJson && !isQuiet) {
          console.log(chalk.yellow(`[DRY-RUN] Would fail: Could not find device for ${device}`))
        }
        process.exitCode = 2
        continue
      }
      throw new Error('Could not find device for ' + device)
    }

    if (!it.address) {
      if (isDryRun) {
        results.push({ device: it.device, success: false, error: 'Could not read hardware MAC address' })
        if (!isJson && !isQuiet) {
          console.log(chalk.yellow(`[DRY-RUN] Would fail: Could not read hardware MAC address for ${device}`))
        }
        process.exitCode = 2
        continue
      }
      throw new Error('Could not read hardware MAC address for ' + device)
    }

    verbose(`Found device ${it.device} (${it.port}) - hardware MAC: ${it.address}, current: ${it.currentAddress}`)

    if (isDryRun) {
      const result: OperationResult = {
        device: it.device,
        port: it.port,
        currentAddress: it.currentAddress,
        newAddress: it.address,
        success: true
      }
      results.push(result)
      if (!isJson && !isQuiet) {
        console.log(chalk.cyan(`[DRY-RUN] Would reset ${it.device} (${it.port}) MAC to ${it.address}`))
      }
      continue
    }

    await setMACAddress(it.device, it.address, it.port)
    results.push({ device: it.device, port: it.port, newAddress: it.address, success: true })
    output(`Reset ${it.device} (${it.port}) MAC to ${it.address}`)
  }

  if (isJson && isDryRun) {
    outputJson({ dryRun: true, operations: results })
  } else if (isJson) {
    outputJson({ operations: results })
  }
}

async function list(): Promise<void> {
  verbose('Listing network interfaces')

  const targets: string[] = []
  if (argv.wifi) {
    verbose('Filtering for Wi-Fi interfaces only')
    targets.push('wi-fi')
  }

  const interfaces = await spoof.findInterfacesAsync(targets, { timeout })
  verbose(`Found ${interfaces.length} interface(s)`)

  if (isJson) {
    const formatted = interfaces.map((it: NetworkInterface) => ({
      port: it.port,
      device: it.device,
      address: it.address || null,
      currentAddress: it.currentAddress || null,
      spoofed: it.address && it.currentAddress && it.address !== it.currentAddress
    }))
    outputJson({ interfaces: formatted })
    return
  }

  interfaces.forEach((it: NetworkInterface) => {
    const line: string[] = []
    line.push('-', chalk.bold.green(it.port), 'on device', chalk.bold.green(it.device))
    if (it.address) {
      line.push('with MAC address', chalk.bold.cyan(it.address))
    }
    if (it.currentAddress && it.currentAddress !== it.address) {
      line.push('currently set to', chalk.bold.red(it.currentAddress))
    }
    console.log(line.join(' '))
  })
}

async function setMACAddress(device: string, mac: string, port: string): Promise<void> {
  verbose(`Checking permissions for MAC address change on ${device}`)

  if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
    throw new Error('Must run as root (or using sudo) to change network settings')
  }

  verbose(`Executing setInterfaceMACAsync(${device}, ${mac}, ${port})`)
  await spoof.setInterfaceMACAsync(device, mac, port, { timeout })
  verbose(`Successfully changed MAC address on ${device}`)
}

/**
 * Look up vendor for a MAC address
 */
function lookupCmd(mac: string): void {
  if (!mac) {
    throw new Error('Please provide a MAC address to look up')
  }

  verbose(`Looking up vendor for MAC: ${mac}`)
  const result = oui.lookup(mac)

  if (isJson) {
    if (result) {
      outputJson({
        input: mac,
        vendor: result.vendor,
        prefix: result.prefix
      })
    } else {
      outputJson({
        input: mac,
        vendor: null,
        prefix: null,
        message: 'Vendor not found in database'
      })
    }
    return
  }

  if (result) {
    console.log(result.vendor)
  } else {
    console.log(chalk.yellow('Vendor not found in database'))
  }
}

/**
 * Search OUI vendor database
 */
function vendorsCmd(query: string): void {
  verbose(`Searching vendors for: ${query || '(showing stats)'}`)

  // If no query, show database stats
  if (!query) {
    const stats = oui.getDatabaseStats()
    if (isJson) {
      outputJson({
        totalPrefixes: stats.totalPrefixes,
        uniqueVendors: stats.uniqueVendors
      })
    } else {
      console.log(`OUI Database: ${stats.totalPrefixes} prefixes from ${stats.uniqueVendors} vendors`)
      console.log(chalk.dim('Usage: macquerade vendors <query>'))
    }
    return
  }

  const results = oui.searchVendors(query, 50)
  verbose(`Found ${results.length} matching vendors`)

  if (isJson) {
    outputJson({
      query,
      count: results.length,
      vendors: results
    })
    return
  }

  if (results.length === 0) {
    console.log(chalk.yellow(`No vendors found matching: ${query}`))
    return
  }

  console.log(chalk.dim(`Found ${results.length} vendor(s) matching "${query}":\n`))
  for (const { prefix, vendor } of results) {
    console.log(`${chalk.cyan(prefix)} - ${vendor}`)
  }
}
