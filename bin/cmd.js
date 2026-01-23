#!/usr/bin/env node

import chalk from 'chalk'
import minimist from 'minimist'
import * as spoof from '../index.js'
import { stripIndent } from 'common-tags'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const argv = minimist(process.argv.slice(2), {
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
  string: ['format']
})
const cmd = argv._[0]
const isJson = argv.format === 'json'
const isDryRun = argv['dry-run']
const isVerbose = argv.verbose && !argv.quiet
const isQuiet = argv.quiet

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

try {
  init()
} catch (err) {
  outputError(err)
  process.exitCode = 1
}

/**
 * Output a message respecting --quiet and --format flags
 * @param {string} message
 */
function output (message) {
  if (isQuiet) return
  if (isJson) return // JSON mode uses structured output only
  console.log(message)
}

/**
 * Output verbose/debug information
 * @param {string} message
 */
function verbose (message) {
  if (!isVerbose) return
  console.error(chalk.dim(`[VERBOSE] ${message}`))
}

/**
 * Output an error respecting --format flag
 * @param {Error & { code?: string }} err
 */
function outputError (err) {
  if (isJson) {
    /** @type {{ message: string, code?: string }} */
    const errorObj = { message: err.message }
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
 * @param {object} data
 */
function outputJson (data) {
  const response = {
    success: true,
    ...data,
    platform: process.platform,
    version: require('../package.json').version
  }
  console.log(JSON.stringify(response, null, 2))
}

function init () {
  if (cmd === 'version' || argv.version) {
    version()
  } else if (cmd === 'list' || cmd === 'ls') {
    list()
  } else if (cmd === 'set') {
    const mac = argv._[1]
    const devices = argv._.slice(2)
    set(mac, devices)
  } else if (cmd === 'randomize') {
    const devices = argv._.slice(1)
    randomize(devices)
  } else if (cmd === 'reset') {
    const devices = argv._.slice(1)
    reset(devices)
  } else if (cmd === 'normalize') {
    const mac = argv._[1]
    normalize(mac)
  } else {
    help()
  }
}

function help () {
  const message = stripIndent`
    spoof - Spoof your MAC address

    Example (randomize MAC address on macOS):
      spoof randomize en0

    Usage:
      spoof list [--wifi]                     List available devices.
      spoof set <mac> <devices>...            Set device MAC address.
      spoof randomize [--local] <devices>...  Set device MAC address randomly.
      spoof reset <devices>...                Reset device MAC address to default.
      spoof normalize <mac>                   Given a MAC address, normalize it.
      spoof help                              Shows this help message.
      spoof version                           Show package version.

    Options:
      --wifi              Try to only show wireless interfaces.
      --local             Set the locally administered flag on randomized MACs.
      --prefer-ifconfig   On Linux, use ifconfig instead of ip command.
      --format=json       Output in JSON format (for scripting/automation).
      --dry-run, -n       Show what would happen without making changes.
      --verbose, -v       Show detailed diagnostic information.
      --quiet, -q         Suppress non-essential output.

    Exit codes:
      0  Success
      1  Error
      2  Dry-run would fail (device not found, etc.)
  `
  console.log(message)
}

function version () {
  const ver = require('../package.json').version
  if (isJson) {
    outputJson({ version: ver })
  } else {
    console.log(ver)
  }
}

function set (mac, devices) {
  verbose(`Setting MAC address to ${mac} for devices: ${devices.join(', ')}`)

  const results = []

  devices.forEach(device => {
    verbose(`Looking up device: ${device}`)
    const it = spoof.findInterface(device)

    if (!it) {
      if (isDryRun) {
        results.push({ device, success: false, error: 'Device not found' })
        if (!isJson && !isQuiet) {
          console.log(chalk.yellow(`[DRY-RUN] Would fail: Could not find device for ${device}`))
        }
        process.exitCode = 2
        return
      }
      throw new Error('Could not find device for ' + device)
    }

    verbose(`Found device ${it.device} (${it.port}) with current MAC: ${it.currentAddress}`)

    if (isDryRun) {
      const result = {
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
      return
    }

    setMACAddress(it.device, mac, it.port)
    results.push({ device: it.device, port: it.port, newAddress: mac, success: true })
    output(`Set ${it.device} (${it.port}) MAC to ${mac}`)
  })

  if (isJson && isDryRun) {
    outputJson({ dryRun: true, operations: results })
  } else if (isJson) {
    outputJson({ operations: results })
  }
}

function normalize (mac) {
  verbose(`Normalizing MAC address: ${mac}`)
  const normalized = spoof.normalize(mac)
  if (isJson) {
    outputJson({ input: mac, normalized })
  } else {
    console.log(normalized)
  }
}

function randomize (devices) {
  verbose(`Randomizing MAC address for devices: ${devices.join(', ')}`)
  if (argv.local) {
    verbose('Using locally administered address flag')
  }

  const results = []

  devices.forEach(device => {
    verbose(`Looking up device: ${device}`)
    const it = spoof.findInterface(device)

    if (!it) {
      if (isDryRun) {
        results.push({ device, success: false, error: 'Device not found' })
        if (!isJson && !isQuiet) {
          console.log(chalk.yellow(`[DRY-RUN] Would fail: Could not find device for ${device}`))
        }
        process.exitCode = 2
        return
      }
      throw new Error('Could not find device for ' + device)
    }

    const mac = spoof.randomize(argv.local)
    verbose(`Generated random MAC: ${mac} for ${it.device}`)

    if (isDryRun) {
      const result = {
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
      return
    }

    setMACAddress(it.device, mac, it.port)
    results.push({ device: it.device, port: it.port, newAddress: mac, success: true })
    output(`Set ${it.device} (${it.port}) MAC to ${mac}`)
  })

  if (isJson && isDryRun) {
    outputJson({ dryRun: true, operations: results })
  } else if (isJson) {
    outputJson({ operations: results })
  }
}

function reset (devices) {
  verbose(`Resetting MAC address to hardware default for devices: ${devices.join(', ')}`)

  const results = []

  devices.forEach(device => {
    verbose(`Looking up device: ${device}`)
    const it = spoof.findInterface(device)

    if (!it) {
      if (isDryRun) {
        results.push({ device, success: false, error: 'Device not found' })
        if (!isJson && !isQuiet) {
          console.log(chalk.yellow(`[DRY-RUN] Would fail: Could not find device for ${device}`))
        }
        process.exitCode = 2
        return
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
        return
      }
      throw new Error('Could not read hardware MAC address for ' + device)
    }

    verbose(`Found device ${it.device} (${it.port}) - hardware MAC: ${it.address}, current: ${it.currentAddress}`)

    if (isDryRun) {
      const result = {
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
      return
    }

    setMACAddress(it.device, it.address, it.port)
    results.push({ device: it.device, port: it.port, newAddress: it.address, success: true })
    output(`Reset ${it.device} (${it.port}) MAC to ${it.address}`)
  })

  if (isJson && isDryRun) {
    outputJson({ dryRun: true, operations: results })
  } else if (isJson) {
    outputJson({ operations: results })
  }
}

function list () {
  verbose('Listing network interfaces')

  const targets = []
  if (argv.wifi) {
    verbose('Filtering for Wi-Fi interfaces only')
    targets.push('wi-fi')
  }

  const interfaces = spoof.findInterfaces(targets)
  verbose(`Found ${interfaces.length} interface(s)`)

  if (isJson) {
    const formatted = interfaces.map(it => ({
      port: it.port,
      device: it.device,
      address: it.address || null,
      currentAddress: it.currentAddress || null,
      spoofed: it.address && it.currentAddress && it.address !== it.currentAddress
    }))
    outputJson({ interfaces: formatted })
    return
  }

  interfaces.forEach(it => {
    const line = []
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

function setMACAddress (device, mac, port) {
  verbose(`Checking permissions for MAC address change on ${device}`)

  if (process.platform !== 'win32' && process.getuid() !== 0) {
    throw new Error('Must run as root (or using sudo) to change network settings')
  }

  verbose(`Executing setInterfaceMAC(${device}, ${mac}, ${port})`)
  spoof.setInterfaceMAC(device, mac, port)
  verbose(`Successfully changed MAC address on ${device}`)
}
