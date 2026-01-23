/**
 * Tests for findInterfaces() and platform-specific interface discovery functions.
 * Uses esmock to mock child_process.execSync and return fixture data.
 *
 * Note: This test file mocks child_process to test platform-specific behavior
 * without actually executing system commands. This is safe as we only mock
 * the execSync function to return test fixture data.
 */
import test from 'tape'
import esmock from 'esmock'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Helper to load fixture files
function loadFixture(platform, filename) {
  return fs.readFileSync(
    path.join(__dirname, 'fixtures', platform, filename),
    'utf8'
  )
}

// =============================================================================
// macOS (Darwin) Tests
// =============================================================================

test('findInterfacesDarwin - parses networksetup output correctly', async t => {
  const networksetupOutput = loadFixture('darwin', 'networksetup-listallhardwareports.txt')
  const ifconfigEn0 = loadFixture('darwin', 'ifconfig-en0.txt')
  const ifconfigEn1 = loadFixture('darwin', 'ifconfig-en1.txt')

  // Mock child_process.execSync to return fixture data
  const mockExecSync = (cmd) => {
    if (cmd === 'networksetup -listallhardwareports') {
      return Buffer.from(networksetupOutput)
    }
    // ifconfig calls for individual devices (getInterfaceMAC)
    if (cmd.includes('ifconfig') && cmd.includes('en0')) {
      return Buffer.from(ifconfigEn0)
    }
    if (cmd.includes('ifconfig') && cmd.includes('en1')) {
      return Buffer.from(ifconfigEn1)
    }
    // Default: return empty for other ifconfig calls
    return Buffer.from('')
  }

  // Save original platform
  const originalPlatform = process.platform

  try {
    // Mock the module with our custom execSync
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    // Temporarily override process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })

    const interfaces = spoof.findInterfaces()

    t.ok(Array.isArray(interfaces), 'returns an array')
    t.equal(interfaces.length, 5, 'finds 5 interfaces')

    // Check first interface (Ethernet)
    const ethernet = interfaces.find(i => i.device === 'en0')
    t.ok(ethernet, 'finds en0 device')
    t.equal(ethernet.port, 'Ethernet', 'en0 port is Ethernet')
    t.equal(ethernet.address, '00:11:22:33:44:55', 'en0 has correct hardware MAC')

    // Check Wi-Fi interface
    const wifi = interfaces.find(i => i.device === 'en1')
    t.ok(wifi, 'finds en1 device')
    t.equal(wifi.port, 'Wi-Fi', 'en1 port is Wi-Fi')
    t.equal(wifi.address, 'AA:BB:CC:DD:EE:FF', 'en1 has correct hardware MAC')

    // Check interface with N/A address (Thunderbolt Bridge)
    const bridge = interfaces.find(i => i.device === 'bridge0')
    t.ok(bridge, 'finds bridge0 device')
    t.equal(bridge.address, null, 'bridge0 has null address (N/A)')
  } finally {
    // Restore original platform
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('findInterfacesDarwin - filters by target', async t => {
  const networksetupOutput = loadFixture('darwin', 'networksetup-listallhardwareports.txt')
  const ifconfigEn1 = loadFixture('darwin', 'ifconfig-en1.txt')

  const mockExecSync = (cmd) => {
    if (cmd === 'networksetup -listallhardwareports') {
      return Buffer.from(networksetupOutput)
    }
    if (cmd.includes('ifconfig') && cmd.includes('en1')) {
      return Buffer.from(ifconfigEn1)
    }
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })

    // Filter by device name
    const byDevice = spoof.findInterfaces(['en1'])
    t.equal(byDevice.length, 1, 'filtering by device returns 1 result')
    t.equal(byDevice[0].device, 'en1', 'returns correct device')

    // Filter by port name
    const byPort = spoof.findInterfaces(['wi-fi'])
    t.equal(byPort.length, 1, 'filtering by port returns 1 result')
    t.equal(byPort[0].port, 'Wi-Fi', 'returns correct port')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// Linux Tests (ip command - modern)
// =============================================================================

test('findInterfacesLinuxIp - parses ip link show output correctly', async t => {
  const ipLinkOutput = loadFixture('linux', 'ip-link-show.txt')
  const ipLinkEth0 = loadFixture('linux', 'ip-link-show-eth0.txt')

  const mockExecSync = (cmd) => {
    // hasIpCommand check
    if (cmd === 'which ip') {
      return Buffer.from('/usr/sbin/ip')
    }
    // ip link show (list all)
    if (cmd === 'ip link show') {
      return Buffer.from(ipLinkOutput)
    }
    // ip link show for specific device
    if (cmd.includes('ip') && cmd.includes('link') && cmd.includes('show') && cmd.includes('eth0')) {
      return Buffer.from(ipLinkEth0)
    }
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

    const interfaces = spoof.findInterfaces()

    t.ok(Array.isArray(interfaces), 'returns an array')
    // Should find eth0, wlan0, docker0, br0, enp0s3 (lo doesn't have ether)
    t.ok(interfaces.length >= 5, 'finds at least 5 interfaces with MAC addresses')

    // Check Ethernet interface
    const eth0 = interfaces.find(i => i.device === 'eth0')
    t.ok(eth0, 'finds eth0 device')
    t.equal(eth0.address, '52:54:00:12:34:56', 'eth0 has correct MAC')
    t.equal(eth0.port, 'Ethernet', 'eth0 port type is Ethernet')

    // Check Wi-Fi interface
    const wlan0 = interfaces.find(i => i.device === 'wlan0')
    t.ok(wlan0, 'finds wlan0 device')
    t.equal(wlan0.port, 'Wi-Fi', 'wlan0 port type is Wi-Fi')
    t.equal(wlan0.address, 'AA:BB:CC:DD:EE:FF', 'wlan0 has correct MAC')

    // Check bridge interface
    const br0 = interfaces.find(i => i.device === 'br0')
    t.ok(br0, 'finds br0 device')
    t.equal(br0.port, 'Bridge', 'br0 port type is Bridge')

    // Check docker interface
    const docker0 = interfaces.find(i => i.device === 'docker0')
    t.ok(docker0, 'finds docker0 device')
    t.equal(docker0.port, 'Virtual', 'docker0 port type is Virtual')

    // Check predictable network interface names
    const enp0s3 = interfaces.find(i => i.device === 'enp0s3')
    t.ok(enp0s3, 'finds enp0s3 device (predictable naming)')
    t.equal(enp0s3.port, 'Ethernet', 'enp0s3 port type is Ethernet')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('findInterfacesLinuxIp - filters by target', async t => {
  const ipLinkOutput = loadFixture('linux', 'ip-link-show.txt')
  const ipLinkEth0 = loadFixture('linux', 'ip-link-show-eth0.txt')

  const mockExecSync = (cmd) => {
    if (cmd === 'which ip') return Buffer.from('/usr/sbin/ip')
    if (cmd === 'ip link show') return Buffer.from(ipLinkOutput)
    if (cmd.includes('eth0')) return Buffer.from(ipLinkEth0)
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

    // Filter by device name
    const byDevice = spoof.findInterfaces(['wlan0'])
    t.equal(byDevice.length, 1, 'filtering by device returns 1 result')
    t.equal(byDevice[0].device, 'wlan0', 'returns correct device')

    // Filter by port type (case insensitive)
    const byPort = spoof.findInterfaces(['wi-fi'])
    t.equal(byPort.length, 1, 'filtering by port returns 1 result')
    t.equal(byPort[0].device, 'wlan0', 'returns wlan0 for wi-fi filter')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// Linux Tests (ifconfig - legacy)
// =============================================================================

test('findInterfacesLinuxIfconfig - parses legacy ifconfig output', async t => {
  const ifconfigOutput = loadFixture('linux', 'ifconfig.txt')
  const ifconfigEth0 = loadFixture('linux', 'ifconfig-eth0.txt')

  const mockExecSync = (cmd) => {
    // Simulate ip command not available
    if (cmd === 'which ip') {
      const err = /** @type {Error & {status?: number}} */ (new Error('Command failed'))
      err.status = 1
      throw err
    }
    // ifconfig for list
    if (cmd === 'ifconfig') {
      return Buffer.from(ifconfigOutput)
    }
    // ifconfig for specific device
    if (cmd.includes('ifconfig') && cmd.includes('eth0')) {
      return Buffer.from(ifconfigEth0)
    }
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

    const interfaces = spoof.findInterfaces()

    t.ok(Array.isArray(interfaces), 'returns an array')
    // Legacy ifconfig with HWaddr format should find eth0 and wlan0
    t.ok(interfaces.length >= 2, 'finds at least 2 interfaces')

    const eth0 = interfaces.find(i => i.device === 'eth0')
    t.ok(eth0, 'finds eth0 device')
    t.equal(eth0.address, '52:54:00:12:34:56', 'eth0 has correct MAC')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// Windows Tests
// =============================================================================

test('findInterfacesWin32 - parses ipconfig /all output', async t => {
  const ipconfigOutput = loadFixture('windows', 'ipconfig-all.txt')
  const getmacOutput = loadFixture('windows', 'getmac.txt')

  const mockExecSync = (cmd) => {
    if (cmd === 'ipconfig /all') {
      return Buffer.from(ipconfigOutput)
    }
    if (cmd === 'getmac /v /fo csv') {
      return Buffer.from(getmacOutput)
    }
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'win32', writable: true })

    const interfaces = spoof.findInterfaces()

    t.ok(Array.isArray(interfaces), 'returns an array')
    t.ok(interfaces.length >= 2, 'finds at least 2 interfaces')

    // Check Ethernet
    const ethernet = interfaces.find(i => i.device === 'Ethernet')
    t.ok(ethernet, 'finds Ethernet device')
    t.equal(ethernet.address, '00:11:22:33:44:55', 'Ethernet has correct MAC')

    // Check Wi-Fi
    const wifi = interfaces.find(i => i.device === 'Wi-Fi')
    t.ok(wifi, 'finds Wi-Fi device')
    t.equal(wifi.address, 'AA:BB:CC:DD:EE:FF', 'Wi-Fi has correct MAC')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('findInterfacesWin32 - filters by target', async t => {
  const ipconfigOutput = loadFixture('windows', 'ipconfig-all.txt')
  const getmacOutput = loadFixture('windows', 'getmac.txt')

  const mockExecSync = (cmd) => {
    if (cmd === 'ipconfig /all') return Buffer.from(ipconfigOutput)
    if (cmd === 'getmac /v /fo csv') return Buffer.from(getmacOutput)
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'win32', writable: true })

    // Filter by device name
    const byDevice = spoof.findInterfaces(['wi-fi'])
    t.equal(byDevice.length, 1, 'filtering by device returns 1 result')
    t.equal(byDevice[0].device, 'Wi-Fi', 'returns correct device')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// findInterface (singular) Tests
// =============================================================================

test('findInterface - returns first matching interface', async t => {
  const networksetupOutput = loadFixture('darwin', 'networksetup-listallhardwareports.txt')
  const ifconfigEn0 = loadFixture('darwin', 'ifconfig-en0.txt')

  const mockExecSync = (cmd) => {
    if (cmd === 'networksetup -listallhardwareports') return Buffer.from(networksetupOutput)
    if (cmd.includes('ifconfig')) return Buffer.from(ifconfigEn0)
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })

    const iface = spoof.findInterface('en0')
    t.ok(iface, 'returns an interface')
    t.equal(iface.device, 'en0', 'returns correct device')
    t.equal(iface.port, 'Ethernet', 'returns correct port')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('findInterface - returns undefined for non-existent device', async t => {
  const networksetupOutput = loadFixture('darwin', 'networksetup-listallhardwareports.txt')

  const mockExecSync = (cmd) => {
    if (cmd === 'networksetup -listallhardwareports') return Buffer.from(networksetupOutput)
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })

    const iface = spoof.findInterface('nonexistent')
    t.equal(iface, undefined, 'returns undefined for non-existent device')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// getLinuxPortType Tests (via interface discovery)
// =============================================================================

test('getLinuxPortType - correctly identifies device types', async t => {
  // Create custom fixture with various device types
  const customIpLinkOutput = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether aa:aa:aa:aa:aa:aa brd ff:ff:ff:ff:ff:ff
3: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether bb:bb:bb:bb:bb:bb brd ff:ff:ff:ff:ff:ff
4: wlp2s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether cc:cc:cc:cc:cc:cc brd ff:ff:ff:ff:ff:ff
5: em1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether dd:dd:dd:dd:dd:dd brd ff:ff:ff:ff:ff:ff
6: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500
    link/ether ee:ee:ee:ee:ee:ee brd ff:ff:ff:ff:ff:ff
7: veth123: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether ff:ff:ff:ff:ff:ff brd ff:ff:ff:ff:ff:ff
8: virbr0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500
    link/ether 00:11:22:33:44:55 brd ff:ff:ff:ff:ff:ff
9: unknown0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 00:00:00:00:00:01 brd ff:ff:ff:ff:ff:ff
`

  const mockExecSync = (cmd) => {
    if (cmd === 'which ip') return Buffer.from('/usr/sbin/ip')
    if (cmd === 'ip link show') return Buffer.from(customIpLinkOutput)
    // For getInterfaceMACLinux calls
    if (cmd.includes('ip') && cmd.includes('link') && cmd.includes('show')) {
      // Extract device name and return appropriate output
      const match = cmd.match(/'([^']+)'$/)
      if (match) {
        return Buffer.from(`2: ${match[1]}: <BROADCAST>\n    link/ether 00:00:00:00:00:00 brd ff:ff:ff:ff:ff:ff`)
      }
    }
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

    const interfaces = spoof.findInterfaces()

    // Check each device type
    const eth0 = interfaces.find(i => i.device === 'eth0')
    t.equal(eth0?.port, 'Ethernet', 'eth0 identified as Ethernet')

    const wlan0 = interfaces.find(i => i.device === 'wlan0')
    t.equal(wlan0?.port, 'Wi-Fi', 'wlan0 identified as Wi-Fi')

    const wlp2s0 = interfaces.find(i => i.device === 'wlp2s0')
    t.equal(wlp2s0?.port, 'Wi-Fi', 'wlp2s0 identified as Wi-Fi (predictable naming)')

    const em1 = interfaces.find(i => i.device === 'em1')
    t.equal(em1?.port, 'Ethernet', 'em1 identified as Ethernet')

    const docker0 = interfaces.find(i => i.device === 'docker0')
    t.equal(docker0?.port, 'Virtual', 'docker0 identified as Virtual')

    const veth123 = interfaces.find(i => i.device === 'veth123')
    t.equal(veth123?.port, 'Virtual', 'veth123 identified as Virtual')

    const virbr0 = interfaces.find(i => i.device === 'virbr0')
    t.equal(virbr0?.port, 'Bridge', 'virbr0 identified as Bridge')

    const unknown0 = interfaces.find(i => i.device === 'unknown0')
    t.equal(unknown0?.port, 'unknown0', 'unknown device uses device name as port')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})
