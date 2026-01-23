/*! spoof. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
import cp from 'child_process'
import { randomInt as cryptoRandomInt } from 'node:crypto'
import { quote } from 'shell-quote'
import zeroFill from 'zero-fill'
import { createRequire } from 'module'
import type { NetworkInterface, RandomFunction } from './types.js'

// winreg is CommonJS-only, use createRequire for compatibility
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Winreg = require('winreg') as typeof import('winreg')

// Windows registry key for interface MAC. Checked on Windows 7
const WIN_REGISTRY_PATH = '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002BE10318}'

// Regex to validate a MAC address
// Example: 00-00-00-00-00-00 or 00:00:00:00:00:00 or 000000000000
const MAC_ADDRESS_RE = /([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})/i

// Regex to validate a MAC address in cisco-style
// Example: 0123.4567.89ab
const CISCO_MAC_ADDRESS_RE = /([0-9A-F]{0,4})\.([0-9A-F]{0,4})\.([0-9A-F]{0,4})/i

// Linux tool detection and preference
let preferIfconfig = false

/**
 * Check if the `ip` command (iproute2) is available on the system.
 */
function hasIpCommand(): boolean {
  try {
    cp.execSync('which ip', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// Detect ip command availability at module load time (Linux only)
const ipCommandAvailable = process.platform === 'linux' ? hasIpCommand() : false

/**
 * Set whether to prefer ifconfig over ip command on Linux.
 * Useful for users who want legacy behavior or compatibility testing.
 */
function setPreferIfconfig(value: boolean): void {
  preferIfconfig = Boolean(value)
}

/**
 * Returns the list of interfaces found on this machine as reported by the
 * `networksetup` command.
 */
function findInterfaces(targets?: string[]): NetworkInterface[] {
  if (!targets) targets = []

  targets = targets.map(target => target.toLowerCase())

  if (process.platform === 'darwin') {
    return findInterfacesDarwin(targets)
  } else if (process.platform === 'linux') {
    return findInterfacesLinux(targets)
  } else if (process.platform === 'win32') {
    return findInterfacesWin32(targets)
  }

  return []
}

function findInterfacesDarwin(targets: string[]): NetworkInterface[] {
  // Parse the output of `networksetup -listallhardwareports` which gives
  // us 3 fields per port:
  // - the port name,
  // - the device associated with this port, if any,
  // - the MAC address, if any, otherwise 'N/A'

  let output = cp.execSync('networksetup -listallhardwareports').toString()

  const details: string[] = []
  while (true) {
    const result = /(?:Hardware Port|Device|Ethernet Address): (.+)/.exec(output)
    if (!result || !result[1]) {
      break
    }
    details.push(result[1])
    output = output.slice(result.index + result[1].length)
  }

  const interfaces: NetworkInterface[] = [] // to return

  // Split the results into chunks of 3 (for our three fields) and yield
  // those that match `targets`.
  for (let i = 0; i < details.length; i += 3) {
    const port = details[i]
    const device = details[i + 1]
    const rawAddress = details[i + 2]
    const addressMatch = MAC_ADDRESS_RE.exec(rawAddress.toUpperCase())
    const address = addressMatch ? normalize(addressMatch[0]) ?? null : null

    const it: NetworkInterface = {
      address,
      currentAddress: getInterfaceMAC(device),
      device,
      port
    }

    if (targets.length === 0) {
      // Not trying to match anything in particular, return everything.
      interfaces.push(it)
      continue
    }

    for (let j = 0; j < targets.length; j++) {
      const target = targets[j]
      if (target === port.toLowerCase() || target === device.toLowerCase()) {
        interfaces.push(it)
        break
      }
    }
  }

  return interfaces
}

/**
 * Dispatcher for Linux interface discovery.
 * Uses `ip` command if available (and not preferring ifconfig), falls back to `ifconfig`.
 */
function findInterfacesLinux(targets: string[]): NetworkInterface[] {
  if (!preferIfconfig && ipCommandAvailable) {
    return findInterfacesLinuxIp(targets)
  }
  return findInterfacesLinuxIfconfig(targets)
}

/**
 * Parse Linux interfaces using the `ip link show` command (iproute2).
 * This is the modern approach for Linux distributions that don't include net-tools.
 */
function findInterfacesLinuxIp(targets: string[]): NetworkInterface[] {
  const output = cp.execSync('ip link show', { stdio: 'pipe' }).toString()
  const lines = output.split('\n')

  const interfaces: NetworkInterface[] = []
  let currentDevice: string | null = null
  let currentFlags = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match device line: "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> ..."
    const deviceMatch = /^\d+:\s+(\S+?)[@:]/.exec(line)
    if (deviceMatch) {
      currentDevice = deviceMatch[1]
      // Extract flags for later use (port type detection)
      const flagsMatch = /<([^>]+)>/.exec(line)
      currentFlags = flagsMatch ? flagsMatch[1] : ''
      continue
    }

    // Match MAC address line: "    link/ether 00:11:22:33:44:55 brd ff:ff:ff:ff:ff:ff"
    const macMatch = /^\s+link\/ether\s+([0-9a-f:]+)/i.exec(line)
    if (macMatch && currentDevice) {
      const address = normalize(macMatch[1]) ?? null
      // Determine port type based on device name and flags
      const port = getLinuxPortType(currentDevice, currentFlags)

      const it: NetworkInterface = {
        address,
        currentAddress: getInterfaceMACLinux(currentDevice),
        device: currentDevice,
        port
      }

      if (targets.length === 0) {
        interfaces.push(it)
      } else {
        for (const target of targets) {
          if (target === port.toLowerCase() || target === currentDevice.toLowerCase()) {
            interfaces.push(it)
            break
          }
        }
      }

      currentDevice = null
      currentFlags = ''
    }
  }

  return interfaces
}

/**
 * Determine the port type for a Linux interface based on device name.
 */
function getLinuxPortType(device: string, _flags: string): string {
  // Wireless interfaces typically have names starting with 'wl' or 'wlan'
  if (device.startsWith('wl') || device.startsWith('wlan')) {
    return 'Wi-Fi'
  }
  // Ethernet interfaces: eth*, en*, em*
  if (device.startsWith('eth') || device.startsWith('en') || device.startsWith('em')) {
    return 'Ethernet'
  }
  // Loopback
  if (device === 'lo') {
    return 'Loopback'
  }
  // Bridge interfaces
  if (device.startsWith('br') || device.startsWith('virbr')) {
    return 'Bridge'
  }
  // Docker/container interfaces
  if (device.startsWith('docker') || device.startsWith('veth')) {
    return 'Virtual'
  }
  // Default
  return device
}

/**
 * Get current MAC address using `ip link show` for a specific device.
 */
function getInterfaceMACLinux(device: string): string | null {
  // Try ip command first if available
  if (ipCommandAvailable && !preferIfconfig) {
    try {
      const output = cp.execSync(quote(['ip', 'link', 'show', device]), { stdio: 'pipe' }).toString()
      const macMatch = /link\/ether\s+([0-9a-f:]+)/i.exec(output)
      return macMatch ? normalize(macMatch[1]) ?? null : null
    } catch {
      // Fall through to ifconfig
    }
  }
  // Fallback to ifconfig
  try {
    const output = cp.execSync(quote(['ifconfig', device]), { stdio: 'pipe' }).toString()
    const address = MAC_ADDRESS_RE.exec(output)
    return address ? normalize(address[0]) ?? null : null
  } catch {
    return null
  }
}

/**
 * Get current MAC address using `getmac /v /fo csv` for a specific Windows device.
 */
function getInterfaceMACWin32(device: string): string | null {
  try {
    const output = cp.execSync('getmac /v /fo csv', { stdio: 'pipe' }).toString()
    const lines = output.trim().split('\n')

    // Skip header line, parse data lines
    // CSV format: "Connection Name","Network Adapter","Physical Address","Transport Name"
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Parse CSV line respecting quoted fields
      const fields = parseCSVLine(line)
      if (fields.length >= 3) {
        const connectionName = fields[0]
        const physicalAddress = fields[2]

        // Match by connection name (case-insensitive)
        if (connectionName.toLowerCase() === device.toLowerCase()) {
          // getmac returns MAC in format XX-XX-XX-XX-XX-XX
          return normalize(physicalAddress) ?? null
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Parse a CSV line respecting quoted fields.
 * Handles fields like: "Connection Name","Value with, comma","Simple"
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      // Check for escaped quote (two consecutive quotes)
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  // Push last field
  fields.push(current)

  return fields
}

/**
 * Parse Linux interfaces using the `ifconfig` command (net-tools - legacy).
 */
function findInterfacesLinuxIfconfig(targets: string[]): NetworkInterface[] {
  // Parse the output of `ifconfig` which gives us:
  // - the adapter description
  // - the adapter name/device associated with this, if any,
  // - the MAC address, if any

  let output = cp.execSync('ifconfig', { stdio: 'pipe' }).toString()

  const details: string[] = []
  while (true) {
    const result = /(.*?)HWaddr(.*)/mi.exec(output)
    if (!result || !result[1] || !result[2]) {
      break
    }
    details.push(result[1], result[2])
    output = output.slice(result.index + result[0].length)
  }

  const interfaces: NetworkInterface[] = []

  for (let i = 0; i < details.length; i += 2) {
    const s = details[i].split(':')

    let device = ''
    let port = ''
    if (s.length >= 2) {
      device = s[0].split(' ')[0]
      port = s[1].trim()
    }

    let address: string | null = details[i + 1].trim()
    if (address) {
      address = normalize(address) ?? null
    }

    const it: NetworkInterface = {
      address,
      currentAddress: getInterfaceMAC(device),
      device,
      port
    }

    if (targets.length === 0) {
      // Not trying to match anything in particular, return everything.
      interfaces.push(it)
      continue
    }

    for (let j = 0; j < targets.length; j++) {
      const target = targets[j]
      if (target === port.toLowerCase() || target === device.toLowerCase()) {
        interfaces.push(it)
        break
      }
    }
  }

  return interfaces
}

function findInterfacesWin32(targets: string[]): NetworkInterface[] {
  const output = cp.execSync('ipconfig /all', { stdio: 'pipe' }).toString()

  const interfaces: NetworkInterface[] = []
  const lines = output.split('\n')
  let it: NetworkInterface | null = null
  for (let i = 0; i < lines.length; i++) {
    // Check if new device
    let result: RegExpExecArray | null
    if (lines[i].substring(0, 1).match(/[A-Z]/)) {
      if (it !== null) {
        if (targets.length === 0) {
          // Not trying to match anything in particular, return everything.
          interfaces.push(it)
        } else {
          for (let j = 0; j < targets.length; j++) {
            const target = targets[j]
            if (target === it.port.toLowerCase() || target === it.device.toLowerCase()) {
              interfaces.push(it)
              break
            }
          }
        }
      }

      it = {
        port: '',
        device: '',
        address: null,
        currentAddress: null
      }

      result = /adapter (.+?):/.exec(lines[i])
      if (!result) {
        continue
      }

      it.device = result[1]
    }

    if (!it) {
      continue
    }

    // Try to find address
    result = /Physical Address.+?:(.*)/mi.exec(lines[i])
    if (result) {
      it.address = normalize(result[1].trim()) ?? null
      // Get current MAC using getmac command, fallback to hardware address
      it.currentAddress = getInterfaceMACWin32(it.device) || it.address
      continue
    }

    // Try to find description
    result = /description.+?:(.*)/mi.exec(lines[i])
    if (result) {
      it.description = result[1].trim()
      continue
    }
  }
  return interfaces
}

/**
 * Returns the first interface which matches `target`
 */
function findInterface(target: string): NetworkInterface | undefined {
  const interfaces = findInterfaces([target])
  return interfaces && interfaces[0]
}

/**
 * Returns currently-set MAC address of given interface. This is distinct from the
 * interface's hardware MAC address.
 */
function getInterfaceMAC(device: string): string | null {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    let output: string
    try {
      output = cp.execSync(quote(['ifconfig', device]), { stdio: 'pipe' }).toString()
    } catch {
      return null
    }

    const address = MAC_ADDRESS_RE.exec(output)
    return address ? normalize(address[0]) ?? null : null
  } else if (process.platform === 'win32') {
    return getInterfaceMACWin32(device)
  }
  return null
}

/**
 * Sets the mac address for given `device` to `mac`.
 *
 * Device varies by platform:
 *   OS X, Linux: this is the interface name in ifconfig
 *   Windows: this is the network adapter name in ipconfig
 */
function setInterfaceMAC(device: string, mac: string, port?: string): void {
  if (!MAC_ADDRESS_RE.exec(mac)) {
    throw new Error(mac + ' is not a valid MAC address')
  }

  const isWirelessPort = port && port.toLowerCase() === 'wi-fi'

  if (process.platform === 'darwin') {
    if (isWirelessPort) {
      // Turn off the device, assuming it's an airport device, to disassociate from any
      // networks and then turn it back on so we can change the MAC.
      try {
        cp.execSync(quote(['networksetup', '-setairportpower', device, 'off']))
        cp.execSync(quote(['networksetup', '-setairportpower', device, 'on']))
      } catch (err) {
        throw new Error('Unable to power cycle wifi device', { cause: err })
      }
    }

    // Change the MAC.
    try {
      cp.execSync(quote(['ifconfig', device, 'ether', mac]))
    } catch (err) {
      throw new Error('Unable to change MAC address', { cause: err })
    }

    // Restart airport so it will associate with known networks (if any)
    if (isWirelessPort) {
      try {
        cp.execSync(quote(['networksetup', '-setairportpower', device, 'off']))
        cp.execSync(quote(['networksetup', '-setairportpower', device, 'on']))
      } catch (err) {
        throw new Error('Unable to restart wifi device', { cause: err })
      }
    }
  } else if (process.platform === 'linux') {
    // Set the device's mac address.
    // Handles shutting down and starting back up interface.
    if (!preferIfconfig && ipCommandAvailable) {
      // Use ip command (iproute2 - modern)
      try {
        cp.execSync(quote(['ip', 'link', 'set', 'dev', device, 'down']))
        cp.execSync(quote(['ip', 'link', 'set', 'dev', device, 'address', mac]))
        cp.execSync(quote(['ip', 'link', 'set', 'dev', device, 'up']))
      } catch (err) {
        throw new Error('Unable to change MAC address', { cause: err })
      }
    } else {
      // Use ifconfig command (net-tools - legacy)
      try {
        cp.execSync(quote(['ifconfig', device, 'down', 'hw', 'ether', mac]))
        cp.execSync(quote(['ifconfig', device, 'up']))
      } catch (err) {
        throw new Error('Unable to change MAC address', { cause: err })
      }
    }
  } else if (process.platform === 'win32') {
    // Locate adapter's registry and update network address (mac)
    const regKey = new Winreg({
      hive: Winreg.HKLM,
      key: WIN_REGISTRY_PATH
    })

    regKey.keys((err: Error | null, keys: Winreg.Registry[]) => {
      if (err) {
        console.log('ERROR: ' + err)
      } else {
        // Loop over all available keys and find the right adapter
        for (let i = 0; i < keys.length; i++) {
          tryWindowsKey(keys[i].key, device, mac)
        }
      }
    })
  }
}

/**
 * Tries to set the "NetworkAddress" value on the specified registry key for given
 * `device` to `mac`.
 */
function tryWindowsKey(key: string, device: string, mac: string): boolean {
  // Skip the Properties key to avoid problems with permissions
  if (key.indexOf('Properties') > -1) {
    return false
  }

  const networkAdapterKeyPath = new Winreg({
    hive: Winreg.HKLM,
    key
  })

  // we need to format the MAC a bit for Windows
  mac = mac.replace(/:/g, '')

  networkAdapterKeyPath.values((err: Error | null, values: Winreg.RegistryItem[]) => {
    let gotAdapter = false
    if (err) {
      console.log('ERROR: ' + err)
    } else {
      for (let x = 0; x < values.length; x++) {
        if (values[x].name === 'AdapterModel') {
          gotAdapter = true
          break
        }
      }

      if (gotAdapter) {
        networkAdapterKeyPath.set('NetworkAddress', 'REG_SZ', mac, () => {
          try {
            cp.execFileSync('netsh', ['interface', 'set', 'interface', device, 'disable'])
            cp.execFileSync('netsh', ['interface', 'set', 'interface', device, 'enable'])
          } catch (err) {
            throw new Error('Unable to restart device, is the cmd running as admin?', { cause: err })
          }
        })
      }
    }
  })

  return false
}

/**
 * Generates and returns a random MAC address.
 */
function randomize(localAdmin?: boolean): string {
  // Randomly assign a VM vendor's MAC address prefix, which should
  // decrease chance of colliding with existing device's addresses.

  const vendors: [number, number, number][] = [
    [0x00, 0x05, 0x69], // VMware
    [0x00, 0x50, 0x56], // VMware
    [0x00, 0x0C, 0x29], // VMware
    [0x00, 0x16, 0x3E], // Xen
    [0x00, 0x03, 0xFF], // Microsoft Hyper-V, Virtual Server, Virtual PC
    [0x00, 0x1C, 0x42], // Parallels
    [0x00, 0x0F, 0x4B], // Virtual Iron 4
    [0x08, 0x00, 0x27] // Sun Virtual Box
  ]

  // Windows needs specific prefixes sometimes
  // http://www.wikihow.com/Change-a-Computer's-Mac-Address-in-Windows
  const windowsPrefixes: number[] = [
    0xD2,
    0xD6,
    0xDA,
    0xDE
  ]

  const vendor = [...vendors[random(0, vendors.length - 1)]]

  if (process.platform === 'win32') {
    vendor[0] = windowsPrefixes[random(0, 3)]
  }

  const mac: number[] = [
    vendor[0],
    vendor[1],
    vendor[2],
    random(0x00, 0x7f),
    random(0x00, 0xff),
    random(0x00, 0xff)
  ]

  if (localAdmin) {
    // Universally administered and locally administered addresses are
    // distinguished by setting the second least significant bit of the
    // most significant byte of the address. If the bit is 0, the address
    // is universally administered. If it is 1, the address is locally
    // administered. In the example address 02-00-00-00-00-01 the most
    // significant byte is 02h. The binary is 00000010 and the second
    // least significant bit is 1. Therefore, it is a locally administered
    // address.[3] The bit is 0 in all OUIs.
    mac[0] |= 2
  }

  return mac
    .map(byte => zeroFill(2, byte.toString(16)))
    .join(':')
    .toUpperCase()
}

/**
 * Takes a MAC address in various formats:
 *
 *      - 00:00:00:00:00:00,
 *      - 00-00-00-00-00-00,
 *      - 0000.0000.0000
 *
 *  ... and returns it in the format 00:00:00:00:00:00.
 */
function normalize(mac: string): string | undefined {
  let m = CISCO_MAC_ADDRESS_RE.exec(mac)
  if (m) {
    const halfwords = m.slice(1)
    mac = halfwords.map((halfword) => {
      return zeroFill(4, halfword)
    }).join('')
    return chunk(mac, 2).join(':').toUpperCase()
  }

  m = MAC_ADDRESS_RE.exec(mac)
  if (m) {
    const bytes = m.slice(1)
    return bytes
      .map(byte => zeroFill(2, byte))
      .join(':')
      .toUpperCase()
  }

  return undefined
}

function chunk(str: string, n: number): string[] {
  const arr: string[] = []
  for (let i = 0; i < str.length; i += n) {
    arr.push(str.slice(i, i + n))
  }
  return arr
}

/**
 * Default cryptographically secure random function.
 */
function defaultRandom(min: number, max: number): number {
  return cryptoRandomInt(min, max + 1) // cryptoRandomInt max is exclusive
}

// Current random function (can be swapped for testing)
let randomFn: RandomFunction = defaultRandom

/**
 * Return a random integer between min and max (inclusive).
 * Uses crypto.randomInt by default for cryptographically secure randomness.
 */
function random(min: number, max: number): number {
  return randomFn(min, max)
}

/**
 * Set a custom random function for testing purposes.
 * Pass null to restore the default cryptographically secure random function.
 */
function setRandomFunction(fn: RandomFunction | null): void {
  randomFn = fn === null ? defaultRandom : fn
}

export {
  findInterface,
  findInterfaces,
  normalize,
  parseCSVLine,
  randomize,
  setInterfaceMAC,
  setPreferIfconfig,
  setRandomFunction
}

export type { NetworkInterface, RandomFunction } from './types.js'
