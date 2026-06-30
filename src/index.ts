/*! MACquerade. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
import cp from 'node:child_process'
import path from 'node:path'
import type { ExecFileOptionsWithStringEncoding, ExecFileSyncOptions } from 'node:child_process'
import { promisify } from 'node:util'
import { randomInt as cryptoRandomInt } from 'node:crypto'
import Winreg from 'winreg'
import type { NetworkInterface, RandomFunction, AsyncOptions } from './types.js'

// Promisified execFile for async operations
const execFileAsync = promisify(cp.execFile)

// Default timeout for async operations (30 seconds)
const DEFAULT_TIMEOUT = 30000
// Resolve the Windows system root from the environment so non-standard installs
// (e.g. Windows on a drive other than C:) still locate the real system binaries.
// Falls back to the conventional C:\Windows when the variable is unset, which is
// also the case when these constants are evaluated on non-Windows hosts.
const WINDOWS_SYSTEM_ROOT = process.env.SystemRoot ?? process.env.windir ?? 'C:\\Windows'
const DEFAULT_WINDOWS_DIR = WINDOWS_SYSTEM_ROOT
const WINDOWS_SYSTEM32_DIR = 'System32'
const GETMAC_EXE = 'getmac.exe'
const IPCONFIG_EXE = 'ipconfig.exe'
const NETSH_EXE = 'netsh.exe'

// Restrict command lookup to trusted system directories so privileged callers
// are not exposed to attacker-controlled PATH entries.
const TRUSTED_POSIX_SYSTEM_PATH = '/run/current-system/sw/bin:/usr/sbin:/usr/bin:/sbin:/bin'
const WINDOWS_SYSTEM32_PATH = path.win32.join(WINDOWS_SYSTEM_ROOT, WINDOWS_SYSTEM32_DIR)
const TRUSTED_WINDOWS_SYSTEM_PATH = [
  WINDOWS_SYSTEM32_PATH,
  WINDOWS_SYSTEM_ROOT,
  path.win32.join(WINDOWS_SYSTEM32_PATH, 'Wbem')
].join(';')

// Deprecation warning tracking (show once per function)
const deprecationWarnings = new Set<string>()

/**
 * Show deprecation warning for sync functions (once per function name)
 */
function warnDeprecated(fnName: string): void {
  if (!deprecationWarnings.has(fnName)) {
    deprecationWarnings.add(fnName)
    console.warn(
      `[DEPRECATION WARNING] ${fnName}() is deprecated and will be removed in a future version. ` +
      `Use the async version instead (e.g., ${fnName.replace('Sync', '')}()).`
    )
  }
}

/**
 * Create exec options with timeout, abort signal, and safe PATH support.
 */
function createCommandEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const trustedPath = process.platform === 'win32'
    ? TRUSTED_WINDOWS_SYSTEM_PATH
    : TRUSTED_POSIX_SYSTEM_PATH

  return {
    ...baseEnv,
    PATH: trustedPath,
    Path: trustedPath
  }
}

function isMissingCommandError(err: unknown): boolean {
  const e = err as NodeJS.ErrnoException & { status?: number }
  return e.code === 'ENOENT' || e.status === 127
}

function createExecOptions(options: AsyncOptions = {}): ExecFileOptionsWithStringEncoding {
  const execOptions: ExecFileOptionsWithStringEncoding = {
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    env: createCommandEnv(),
    encoding: 'utf8'
  }

  if (options.signal) {
    execOptions.signal = options.signal
  }

  return execOptions
}

function createExecFileSyncOptions(options: ExecFileSyncOptions = {}): ExecFileSyncOptions {
  return {
    timeout: DEFAULT_TIMEOUT,
    ...options,
    env: createCommandEnv(options.env)
  }
}


/**
 * Build the absolute path to a Windows System32 executable.
 *
 * Windows searches the current working directory and PATH for bare command
 * names. Use an absolute System32 path for built-in Windows tools that may run
 * in elevated processes so a planted executable cannot be selected instead.
 */
function getWindowsSystem32Executable(executable: string): string {
  return path.win32.join(DEFAULT_WINDOWS_DIR, WINDOWS_SYSTEM32_DIR, executable)
}

// Windows registry key for interface MAC. Checked on Windows 7
const WIN_REGISTRY_PATH = '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002BE10318}'

// Regex to extract a MAC address from command output (unanchored for extraction)
// Example: 00-00-00-00-00-00 or 00:00:00:00:00:00 or 000000000000
const MAC_ADDRESS_RE = /([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})/i

// Anchored regex to validate a MAC address from user input
const MAC_VALIDATION_RE = /^([0-9A-F]{1,2})[:-]([0-9A-F]{1,2})[:-]([0-9A-F]{1,2})[:-]([0-9A-F]{1,2})[:-]([0-9A-F]{1,2})[:-]([0-9A-F]{1,2})$/i

// Regex to validate a device name (alphanumeric, dots, dashes, underscores)
const DEVICE_NAME_RE = /^[a-zA-Z0-9._-]+$/

// Regex to validate a MAC address in cisco-style (anchored, requires at least 1 hex digit per group)
// Example: 0123.4567.89ab
const CISCO_MAC_ADDRESS_RE = /^([0-9A-F]{1,4})\.([0-9A-F]{1,4})\.([0-9A-F]{1,4})$/i

// Linux tool detection and preference
let preferIfconfig = false

/**
 * Check if the `ip` command (iproute2) is available on the system.
 * @deprecated Use hasIpCommandAsync() instead
 */
function hasIpCommand(): boolean {
  try {
    cp.execFileSync('which', ['ip'], createExecFileSyncOptions({ stdio: 'pipe' }))
    return true
  } catch {
    return false
  }
}

/**
 * Check if the `ip` command (iproute2) is available on the system (async).
 * Uses execFile with a sanitized PATH so command lookup is limited to trusted directories.
 */
async function hasIpCommandAsync(options: AsyncOptions = {}): Promise<boolean> {
  try {
    await execFileAsync('which', ['ip'], createExecOptions(options))
    return true
  } catch {
    return false
  }
}

// Lazy detection of ip command availability (Linux only)
let cachedIpCommandAvailable: boolean | null = null
function getIpCommandAvailable(): boolean {
  if (cachedIpCommandAvailable === null) {
    cachedIpCommandAvailable = process.platform === 'linux' ? hasIpCommand() : false
  }
  return cachedIpCommandAvailable
}

// Cache for async ip command check
let ipCommandAvailableAsync: boolean | null = null

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

  let output = cp.execFileSync('networksetup', ['-listallhardwareports'], createExecFileSyncOptions({ stdio: 'pipe' })).toString()

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
  try {
    if (!preferIfconfig && getIpCommandAvailable()) {
      return findInterfacesLinuxIp(targets)
    }
    return findInterfacesLinuxIfconfig(targets)
  } catch (err) {
    if (isMissingCommandError(err)) {
      return []
    }
    throw err
  }
}

/**
 * Parse Linux interfaces using the `ip link show` command (iproute2).
 * This is the modern approach for Linux distributions that don't include net-tools.
 */
function findInterfacesLinuxIp(targets: string[]): NetworkInterface[] {
  const output = cp.execFileSync('ip', ['link', 'show'], createExecFileSyncOptions({ stdio: 'pipe' })).toString()
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
  if (!preferIfconfig) {
    try {
      const output = cp.execFileSync('ip', ['link', 'show', device], createExecFileSyncOptions({ stdio: 'pipe' })).toString()
      const macMatch = /link\/ether\s+([0-9a-f:]+)/i.exec(output)
      const mac = macMatch ? normalize(macMatch[1]) ?? null : null
      if (mac) return mac
    } catch {
      // Fall through to ifconfig
    }
  }
  // Fallback to ifconfig
  try {
    const output = cp.execFileSync('ifconfig', [device], createExecFileSyncOptions({ stdio: 'pipe' })).toString()
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
    const output = cp.execFileSync(getWindowsSystem32Executable(GETMAC_EXE), ['/v', '/fo', 'csv'], createExecFileSyncOptions({ stdio: 'pipe' })).toString()
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

  let output = cp.execFileSync('ifconfig', [], createExecFileSyncOptions({ stdio: 'pipe' })).toString()

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

/**
 * Returns true when an interface should be included in the result set: either no
 * targets were requested (return everything) or the interface matches one.
 */
function win32InterfaceMatches(it: NetworkInterface, targets: string[]): boolean {
  if (targets.length === 0) {
    return true
  }
  return targets.some(target =>
    target === it.port.toLowerCase() || target === it.device.toLowerCase())
}

/**
 * Begin a fresh interface record for an `ipconfig /all` adapter header line,
 * extracting the device name when present.
 */
function startWin32Interface(line: string): NetworkInterface {
  const it: NetworkInterface = {
    port: '',
    device: '',
    address: null,
    currentAddress: null
  }
  const result = /adapter (.+?):/.exec(line)
  if (result) {
    it.device = result[1]
  }
  return it
}

/**
 * Apply a single non-header `ipconfig /all` line to the current interface record,
 * filling in its description. Address handling differs between the sync and async
 * code paths (current-MAC lookup), so it is handled by the callers.
 */
function applyWin32DescriptionLine(it: NetworkInterface, line: string): void {
  const result = /description.+?:(.*)/mi.exec(line)
  if (result) {
    it.description = result[1].trim()
  }
}

const WIN32_ADAPTER_HEADER_RE = /^[A-Z]/
const WIN32_PHYSICAL_ADDRESS_RE = /Physical Address.+?:(.*)/mi

function findInterfacesWin32(targets: string[]): NetworkInterface[] {
  const output = cp.execFileSync(
    getWindowsSystem32Executable(IPCONFIG_EXE),
    ['/all'],
    createExecFileSyncOptions({ stdio: 'pipe' })
  ).toString()

  const interfaces: NetworkInterface[] = []
  let it: NetworkInterface | null = null

  for (const line of output.split('\n')) {
    if (WIN32_ADAPTER_HEADER_RE.test(line)) {
      if (it !== null && win32InterfaceMatches(it, targets)) {
        interfaces.push(it)
      }
      it = startWin32Interface(line)
    }

    if (!it) {
      continue
    }

    const addressMatch = WIN32_PHYSICAL_ADDRESS_RE.exec(line)
    if (addressMatch) {
      it.address = normalize(addressMatch[1].trim()) ?? null
      // Get current MAC using getmac command, fallback to hardware address
      it.currentAddress = getInterfaceMACWin32(it.device) || it.address
      continue
    }

    applyWin32DescriptionLine(it, line)
  }

  // Push the final interface (the loop only pushes when the *next* header is encountered)
  if (it !== null && win32InterfaceMatches(it, targets)) {
    interfaces.push(it)
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
  if (process.platform === 'linux') {
    return getInterfaceMACLinux(device)
  } else if (process.platform === 'darwin') {
    let output: string
    try {
      output = cp.execFileSync('ifconfig', [device], createExecFileSyncOptions({ stdio: 'pipe' })).toString()
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
  if (!DEVICE_NAME_RE.test(device)) {
    throw new Error(device + ' is not a valid device name')
  }
  if (!MAC_VALIDATION_RE.exec(mac)) {
    throw new Error(mac + ' is not a valid MAC address')
  }
  mac = normalize(mac) ?? mac

  const isWirelessPort = port && port.toLowerCase() === 'wi-fi'

  if (process.platform === 'darwin') {
    if (isWirelessPort) {
      // Turn off the device, assuming it's an airport device, to disassociate from any
      // networks and then turn it back on so we can change the MAC.
      try {
        cp.execFileSync('networksetup', ['-setairportpower', device, 'off'], createExecFileSyncOptions())
        cp.execFileSync('networksetup', ['-setairportpower', device, 'on'], createExecFileSyncOptions())
      } catch (err) {
        throw new Error('Unable to power cycle wifi device', { cause: err })
      }
    }

    // Change the MAC.
    try {
      cp.execFileSync('ifconfig', [device, 'ether', mac], createExecFileSyncOptions())
    } catch (err) {
      throw new Error('Unable to change MAC address', { cause: err })
    }

    // Restart airport so it will associate with known networks (if any)
    if (isWirelessPort) {
      try {
        cp.execFileSync('networksetup', ['-setairportpower', device, 'off'], createExecFileSyncOptions())
        cp.execFileSync('networksetup', ['-setairportpower', device, 'on'], createExecFileSyncOptions())
      } catch (err) {
        throw new Error('Unable to restart wifi device', { cause: err })
      }
    }
  } else if (process.platform === 'linux') {
    // Set the device's mac address.
    // Handles shutting down and starting back up interface.
    if (!preferIfconfig && getIpCommandAvailable()) {
      // Use ip command (iproute2 - modern)
      try {
        cp.execFileSync('ip', ['link', 'set', 'dev', device, 'down'], createExecFileSyncOptions())
        cp.execFileSync('ip', ['link', 'set', 'dev', device, 'address', mac], createExecFileSyncOptions())
        cp.execFileSync('ip', ['link', 'set', 'dev', device, 'up'], createExecFileSyncOptions())
      } catch (err) {
        throw new Error('Unable to change MAC address', { cause: err })
      }
    } else {
      // Use ifconfig command (net-tools - legacy)
      try {
        cp.execFileSync('ifconfig', [device, 'down', 'hw', 'ether', mac], createExecFileSyncOptions())
        cp.execFileSync('ifconfig', [device, 'up'], createExecFileSyncOptions())
      } catch (err) {
        throw new Error('Unable to change MAC address', { cause: err })
      }
    }
  } else if (process.platform === 'win32') {
    warnDeprecated('setInterfaceMAC')
    throw new Error('Sync MAC address setting is not supported on Windows. Use setInterfaceMACAsync() instead.')
  }
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
    random(0x00, 0xff),
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
    .map(byte => byte.toString(16).padStart(2, '0'))
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
      return halfword.padStart(4, '0')
    }).join('')
    return chunk(mac, 2).join(':').toUpperCase()
  }

  m = MAC_ADDRESS_RE.exec(mac)
  if (m) {
    const bytes = m.slice(1)
    return bytes
      .map(byte => byte.padStart(2, '0'))
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

// ============================================================================
// ASYNC API (Primary - Use these for new code)
// ============================================================================

/**
 * Get cached async ip command availability (or detect it if not cached).
 */
async function getIpCommandAvailableAsync(options: AsyncOptions = {}): Promise<boolean> {
  if (ipCommandAvailableAsync === null) {
    ipCommandAvailableAsync = await hasIpCommandAsync(options)
  }
  return ipCommandAvailableAsync
}

/**
 * Returns the list of interfaces found on this machine (async version).
 * @param targets - Optional list of interface names to filter
 * @param options - Options including timeout and abort signal
 */
async function findInterfacesAsync(targets?: string[], options: AsyncOptions = {}): Promise<NetworkInterface[]> {
  if (!targets) targets = []

  targets = targets.map(target => target.toLowerCase())

  if (process.platform === 'darwin') {
    return findInterfacesDarwinAsync(targets, options)
  } else if (process.platform === 'linux') {
    return findInterfacesLinuxAsync(targets, options)
  } else if (process.platform === 'win32') {
    return findInterfacesWin32Async(targets, options)
  }

  return []
}

async function findInterfacesDarwinAsync(targets: string[], options: AsyncOptions = {}): Promise<NetworkInterface[]> {
  const { stdout } = await execFileAsync('networksetup', ['-listallhardwareports'], createExecOptions(options))
  let output = stdout

  const details: string[] = []
  while (true) {
    const result = /(?:Hardware Port|Device|Ethernet Address): (.+)/.exec(output)
    if (!result || !result[1]) {
      break
    }
    details.push(result[1])
    output = output.slice(result.index + result[1].length)
  }

  const interfaces: NetworkInterface[] = []

  for (let i = 0; i < details.length; i += 3) {
    const port = details[i]
    const device = details[i + 1]
    const rawAddress = details[i + 2]
    const addressMatch = MAC_ADDRESS_RE.exec(rawAddress.toUpperCase())
    const address = addressMatch ? normalize(addressMatch[0]) ?? null : null

    const it: NetworkInterface = {
      address,
      currentAddress: await getInterfaceMACAsync(device, options),
      device,
      port
    }

    if (targets.length === 0) {
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

async function findInterfacesLinuxAsync(targets: string[], options: AsyncOptions = {}): Promise<NetworkInterface[]> {
  try {
    const ipAvailable = await getIpCommandAvailableAsync(options)
    if (!preferIfconfig && ipAvailable) {
      return await findInterfacesLinuxIpAsync(targets, options)
    }
    return await findInterfacesLinuxIfconfigAsync(targets, options)
  } catch (err) {
    if (isMissingCommandError(err)) {
      return []
    }
    throw err
  }
}

async function findInterfacesLinuxIpAsync(targets: string[], options: AsyncOptions = {}): Promise<NetworkInterface[]> {
  const { stdout } = await execFileAsync('ip', ['link', 'show'], createExecOptions(options))
  const lines = stdout.split('\n')

  const interfaces: NetworkInterface[] = []
  let currentDevice: string | null = null
  let currentFlags = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const deviceMatch = /^\d+:\s+(\S+?)[@:]/.exec(line)
    if (deviceMatch) {
      currentDevice = deviceMatch[1]
      const flagsMatch = /<([^>]+)>/.exec(line)
      currentFlags = flagsMatch ? flagsMatch[1] : ''
      continue
    }

    const macMatch = /^\s+link\/ether\s+([0-9a-f:]+)/i.exec(line)
    if (macMatch && currentDevice) {
      const address = normalize(macMatch[1]) ?? null
      const port = getLinuxPortType(currentDevice, currentFlags)

      const it: NetworkInterface = {
        address,
        currentAddress: await getInterfaceMACLinuxAsync(currentDevice, options),
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

async function findInterfacesLinuxIfconfigAsync(targets: string[], options: AsyncOptions = {}): Promise<NetworkInterface[]> {
  const { stdout } = await execFileAsync('ifconfig', [], createExecOptions(options))
  let output = stdout

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
      currentAddress: await getInterfaceMACAsync(device, options),
      device,
      port
    }

    if (targets.length === 0) {
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

async function findInterfacesWin32Async(targets: string[], options: AsyncOptions = {}): Promise<NetworkInterface[]> {
  const { stdout } = await execFileAsync(
    getWindowsSystem32Executable(IPCONFIG_EXE),
    ['/all'],
    createExecOptions(options)
  )

  const interfaces: NetworkInterface[] = []
  let it: NetworkInterface | null = null

  for (const line of stdout.split('\n')) {
    if (WIN32_ADAPTER_HEADER_RE.test(line)) {
      if (it !== null && win32InterfaceMatches(it, targets)) {
        interfaces.push(it)
      }
      it = startWin32Interface(line)
    }

    if (!it) {
      continue
    }

    const addressMatch = WIN32_PHYSICAL_ADDRESS_RE.exec(line)
    if (addressMatch) {
      it.address = normalize(addressMatch[1].trim()) ?? null
      it.currentAddress = await getInterfaceMACWin32Async(it.device, options) || it.address
      continue
    }

    applyWin32DescriptionLine(it, line)
  }

  // Push the final interface (the loop only pushes when the *next* header is encountered)
  if (it !== null && win32InterfaceMatches(it, targets)) {
    interfaces.push(it)
  }

  return interfaces
}

/**
 * Returns the first interface which matches `target` (async version).
 */
async function findInterfaceAsync(target: string, options: AsyncOptions = {}): Promise<NetworkInterface | undefined> {
  const interfaces = await findInterfacesAsync([target], options)
  return interfaces && interfaces[0]
}

/**
 * Get current MAC address using `ip link show` for a specific device (async version).
 */
async function getInterfaceMACLinuxAsync(device: string, options: AsyncOptions = {}): Promise<string | null> {
  if (!preferIfconfig) {
    try {
      // Safe: execFile with arguments array prevents injection
      const { stdout } = await execFileAsync('ip', ['link', 'show', device], createExecOptions(options))
      const macMatch = /link\/ether\s+([0-9a-f:]+)/i.exec(stdout)
      const mac = macMatch ? normalize(macMatch[1]) ?? null : null
      if (mac) return mac
    } catch {
      // Fall through to ifconfig
    }
  }
  try {
    const { stdout } = await execFileAsync('ifconfig', [device], createExecOptions(options))
    const address = MAC_ADDRESS_RE.exec(stdout)
    return address ? normalize(address[0]) ?? null : null
  } catch {
    return null
  }
}

/**
 * Get current MAC address using `getmac /v /fo csv` for a specific Windows device (async version).
 */
async function getInterfaceMACWin32Async(device: string, options: AsyncOptions = {}): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      getWindowsSystem32Executable(GETMAC_EXE),
      ['/v', '/fo', 'csv'],
      createExecOptions(options)
    )
    const lines = stdout.trim().split('\n')

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const fields = parseCSVLine(line)
      if (fields.length >= 3) {
        const connectionName = fields[0]
        const physicalAddress = fields[2]

        if (connectionName.toLowerCase() === device.toLowerCase()) {
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
 * Returns currently-set MAC address of given interface (async version).
 */
async function getInterfaceMACAsync(device: string, options: AsyncOptions = {}): Promise<string | null> {
  if (process.platform === 'linux') {
    return getInterfaceMACLinuxAsync(device, options)
  } else if (process.platform === 'darwin') {
    try {
      // Safe: execFile with arguments array prevents injection
      const { stdout } = await execFileAsync('ifconfig', [device], createExecOptions(options))
      const address = MAC_ADDRESS_RE.exec(stdout)
      return address ? normalize(address[0]) ?? null : null
    } catch {
      return null
    }
  } else if (process.platform === 'win32') {
    return getInterfaceMACWin32Async(device, options)
  }
  return null
}

/**
 * Sets the MAC address for given `device` to `mac` (async version).
 *
 * Device varies by platform:
 *   OS X, Linux: this is the interface name in ifconfig
 *   Windows: this is the network adapter name in ipconfig
 */
async function setInterfaceMACAsync(device: string, mac: string, port?: string, options: AsyncOptions = {}): Promise<void> {
  if (!DEVICE_NAME_RE.test(device)) {
    throw new Error(device + ' is not a valid device name')
  }
  if (!MAC_VALIDATION_RE.exec(mac)) {
    throw new Error(mac + ' is not a valid MAC address')
  }
  mac = normalize(mac) ?? mac

  const isWirelessPort = port && port.toLowerCase() === 'wi-fi'
  const execOpts = createExecOptions(options)

  if (process.platform === 'darwin') {
    if (isWirelessPort) {
      try {
        // Safe: execFile with arguments array prevents injection
        await execFileAsync('networksetup', ['-setairportpower', device, 'off'], execOpts)
        await execFileAsync('networksetup', ['-setairportpower', device, 'on'], execOpts)
      } catch (err) {
        throw new Error('Unable to power cycle wifi device', { cause: err })
      }
    }

    try {
      await execFileAsync('ifconfig', [device, 'ether', mac], execOpts)
    } catch (err) {
      throw new Error('Unable to change MAC address', { cause: err })
    }

    if (isWirelessPort) {
      try {
        await execFileAsync('networksetup', ['-setairportpower', device, 'off'], execOpts)
        await execFileAsync('networksetup', ['-setairportpower', device, 'on'], execOpts)
      } catch (err) {
        throw new Error('Unable to restart wifi device', { cause: err })
      }
    }
  } else if (process.platform === 'linux') {
    const ipAvailable = await getIpCommandAvailableAsync(options)
    if (!preferIfconfig && ipAvailable) {
      try {
        await execFileAsync('ip', ['link', 'set', 'dev', device, 'down'], execOpts)
        await execFileAsync('ip', ['link', 'set', 'dev', device, 'address', mac], execOpts)
        await execFileAsync('ip', ['link', 'set', 'dev', device, 'up'], execOpts)
      } catch (err) {
        throw new Error('Unable to change MAC address', { cause: err })
      }
    } else {
      try {
        await execFileAsync('ifconfig', [device, 'down', 'hw', 'ether', mac], execOpts)
        await execFileAsync('ifconfig', [device, 'up'], execOpts)
      } catch (err) {
        throw new Error('Unable to change MAC address', { cause: err })
      }
    }
  } else if (process.platform === 'win32') {
    await setInterfaceMACWin32Async(device, mac, options)
  }
}

/**
 * Promisified Windows registry key enumeration.
 */
function getRegistryKeysAsync(regKey: Winreg.Registry): Promise<Winreg.Registry[]> {
  return new Promise((resolve, reject) => {
    regKey.keys((err: Error | null, keys: Winreg.Registry[]) => {
      if (err) reject(err)
      else resolve(keys)
    })
  })
}

/**
 * Promisified Windows registry values retrieval.
 */
function getRegistryValuesAsync(regKey: Winreg.Registry): Promise<Winreg.RegistryItem[]> {
  return new Promise((resolve, reject) => {
    regKey.values((err: Error | null, values: Winreg.RegistryItem[]) => {
      if (err) reject(err)
      else resolve(values)
    })
  })
}

/**
 * Promisified Windows registry value set.
 */
function setRegistryValueAsync(regKey: Winreg.Registry, name: string, type: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    regKey.set(name, type, value, (err: Error | null) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/**
 * Async version of setInterfaceMAC for Windows.
 */
async function setInterfaceMACWin32Async(device: string, mac: string, options: AsyncOptions = {}): Promise<void> {
  const regKey = new Winreg({
    hive: Winreg.HKLM,
    key: WIN_REGISTRY_PATH
  })

  const keys = await getRegistryKeysAsync(regKey)

  for (const key of keys) {
    const found = await tryWindowsKeyAsync(key.key, device, mac, options)
    if (found) return
  }

  throw new Error('Unable to find registry key for network adapter: ' + device)
}

function registryValue(values: Winreg.RegistryItem[], name: string): string | undefined {
  return values.find(value => value.name.toLowerCase() === name.toLowerCase())?.value
}

function registryKeyMatchesDevice(values: Winreg.RegistryItem[], device: string): boolean {
  const normalizedDevice = device.toLowerCase()
  const candidateValueNames = [
    'NetConnectionID',
    'Name',
    'DriverDesc',
    'AdapterModel',
    'NetCfgInstanceId'
  ]

  return candidateValueNames.some((name) => {
    const value = registryValue(values, name)
    return value?.toLowerCase() === normalizedDevice
  })
}

/**
 * Tries to set the "NetworkAddress" value on the specified registry key for given
 * `device` to `mac` (async).
 */
async function tryWindowsKeyAsync(key: string, device: string, mac: string, options: AsyncOptions = {}): Promise<boolean> {
  if (key.indexOf('Properties') > -1) {
    return false
  }

  const networkAdapterKeyPath = new Winreg({
    hive: Winreg.HKLM,
    key
  })

  mac = mac.replace(/:/g, '')

  try {
    const values = await getRegistryValuesAsync(networkAdapterKeyPath)
    if (registryKeyMatchesDevice(values, device)) {
      await setRegistryValueAsync(networkAdapterKeyPath, 'NetworkAddress', 'REG_SZ', mac)
      const execOpts = createExecOptions(options)
      await execFileAsync(getWindowsSystem32Executable(NETSH_EXE), ['interface', 'set', 'interface', device, 'disable'], execOpts)
      await execFileAsync(getWindowsSystem32Executable(NETSH_EXE), ['interface', 'set', 'interface', device, 'enable'], execOpts)
      return true
    }
  } catch (err) {
    throw new Error('Unable to restart device, is the cmd running as admin?', { cause: err })
  }

  return false
}

// ============================================================================
// SYNC API (Deprecated - Maintained for backward compatibility)
// ============================================================================

/**
 * Returns the list of interfaces found on this machine (sync version).
 * @deprecated Use findInterfacesAsync() instead
 */
function findInterfacesSync(targets?: string[]): NetworkInterface[] {
  warnDeprecated('findInterfacesSync')
  return findInterfaces(targets)
}

/**
 * Returns the first interface which matches `target` (sync version).
 * @deprecated Use findInterfaceAsync() instead
 */
function findInterfaceSync(target: string): NetworkInterface | undefined {
  warnDeprecated('findInterfaceSync')
  return findInterface(target)
}

/**
 * Sets the MAC address for given `device` to `mac` (sync version).
 * @deprecated Use setInterfaceMACAsync() instead
 */
function setInterfaceMACSync(device: string, mac: string, port?: string): void {
  warnDeprecated('setInterfaceMACSync')
  setInterfaceMAC(device, mac, port)
}

export {
  // Primary async API
  findInterfacesAsync,
  findInterfaceAsync,
  setInterfaceMACAsync,
  getInterfaceMACAsync,

  // Sync API (maintained for backward compatibility but deprecated)
  findInterface,
  findInterfaces,
  findInterfaceSync,
  findInterfacesSync,
  setInterfaceMAC,
  setInterfaceMACSync,

  // Utility functions (sync-only, no I/O)
  normalize,
  parseCSVLine,
  randomize,
  setPreferIfconfig,
  setRandomFunction,

  // Constants
  DEFAULT_TIMEOUT
}

// Re-export OUI module functions
export {
  lookup,
  searchVendors,
  randomizeAsVendor,
  randomizeAsVendorWithInfo,
  getVendorNames,
  getPrefixesForVendor,
  getDatabaseStats
} from './oui.js'

export type { VendorInfo } from './oui.js'

export type { NetworkInterface, RandomFunction, AsyncOptions } from './types.js'
