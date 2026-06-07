/**
 * Tests for findInterfaces() and platform-specific interface discovery functions.
 * Uses vi.doMock to mock child_process.execSync and return fixture data.
 *
 * Note: This test file mocks child_process to test platform-specific behavior
 * without actually executing system commands. This is safe as we only mock
 * the execSync function to return test fixture data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const windowsSystem32 = ['C:', 'Windows', 'System32'].join(String.fromCharCode(92))

// Helper to load fixture files
function loadFixture(platform: string, filename: string): string {
  return fs.readFileSync(
    path.join(testDir, 'fixtures', platform, filename),
    'utf8'
  )
}

// Helper to create child_process mock
function createChildProcessMock(mockExecSync: (cmd: string) => Buffer) {
  const mockExecFileSync = vi.fn((cmd: string, args?: string[]) => {
    const fullCmd = args ? [cmd, ...args].join(' ') : cmd
    return mockExecSync(fullCmd)
  })
  const mockExecFile = vi.fn((cmd: string, args?: string[], options?: unknown, callback?: (error: Error | null, stdout: Buffer, stderr: Buffer) => void) => {
    const cb = typeof options === 'function' ? options : callback
    try {
      const fullCmd = args ? [cmd, ...args].join(' ') : cmd
      cb?.(null, mockExecSync(fullCmd), Buffer.from(''))
    } catch (err) {
      cb?.(err as Error, Buffer.from(''), Buffer.from(''))
    }
    return {}
  })
  const mock = {
    execSync: mockExecSync,
    execFileSync: mockExecFileSync,
    exec: vi.fn(),
    execFile: mockExecFile,
    spawn: vi.fn(),
    spawnSync: vi.fn(),
    fork: vi.fn()
  }
  return { default: mock, ...mock }
}

// =============================================================================
// macOS (Darwin) Tests
// =============================================================================

describe('findInterfacesDarwin', () => {
  let originalPlatform: string

  beforeEach(() => {
    originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('parses networksetup output correctly', async () => {
    const networksetupOutput = loadFixture('darwin', 'networksetup-listallhardwareports.txt')
    const ifconfigEn0 = loadFixture('darwin', 'ifconfig-en0.txt')
    const ifconfigEn1 = loadFixture('darwin', 'ifconfig-en1.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'networksetup -listallhardwareports') {
        return Buffer.from(networksetupOutput)
      }
      if (cmd.includes('ifconfig') && cmd.includes('en0')) {
        return Buffer.from(ifconfigEn0)
      }
      if (cmd.includes('ifconfig') && cmd.includes('en1')) {
        return Buffer.from(ifconfigEn1)
      }
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')
    const interfaces = spoof.findInterfaces()

    expect(Array.isArray(interfaces)).toBe(true)
    expect(interfaces.length).toBe(5)

    // Check first interface (Ethernet)
    const ethernet = interfaces.find(i => i.device === 'en0')
    expect(ethernet).toBeDefined()
    expect(ethernet?.port).toBe('Ethernet')
    expect(ethernet?.address).toBe('00:11:22:33:44:55')

    // Check Wi-Fi interface
    const wifi = interfaces.find(i => i.device === 'en1')
    expect(wifi).toBeDefined()
    expect(wifi?.port).toBe('Wi-Fi')
    expect(wifi?.address).toBe('AA:BB:CC:DD:EE:FF')

    // Check interface with N/A address (Thunderbolt Bridge)
    const bridge = interfaces.find(i => i.device === 'bridge0')
    expect(bridge).toBeDefined()
    expect(bridge?.address).toBeNull()
  })

  it('filters by target', async () => {
    const networksetupOutput = loadFixture('darwin', 'networksetup-listallhardwareports.txt')
    const ifconfigEn1 = loadFixture('darwin', 'ifconfig-en1.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'networksetup -listallhardwareports') {
        return Buffer.from(networksetupOutput)
      }
      if (cmd.includes('ifconfig') && cmd.includes('en1')) {
        return Buffer.from(ifconfigEn1)
      }
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')

    // Filter by device name
    const byDevice = spoof.findInterfaces(['en1'])
    expect(byDevice.length).toBe(1)
    expect(byDevice[0].device).toBe('en1')

    // Filter by port name
    const byPort = spoof.findInterfaces(['wi-fi'])
    expect(byPort.length).toBe(1)
    expect(byPort[0].port).toBe('Wi-Fi')
  })
})

// =============================================================================
// Linux Tests (ip command - modern)
// =============================================================================

describe('findInterfacesLinuxIp', () => {
  let originalPlatform: string

  beforeEach(() => {
    originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('parses ip link show output correctly', async () => {
    const ipLinkOutput = loadFixture('linux', 'ip-link-show.txt')
    const ipLinkEth0 = loadFixture('linux', 'ip-link-show-eth0.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'which ip') {
        return Buffer.from('/usr/sbin/ip')
      }
      if (cmd === 'ip link show') {
        return Buffer.from(ipLinkOutput)
      }
      if (cmd.includes('ip') && cmd.includes('link') && cmd.includes('show') && cmd.includes('eth0')) {
        return Buffer.from(ipLinkEth0)
      }
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')
    const interfaces = spoof.findInterfaces()

    expect(Array.isArray(interfaces)).toBe(true)
    expect(interfaces.length).toBeGreaterThanOrEqual(5)

    // Check Ethernet interface
    const eth0 = interfaces.find(i => i.device === 'eth0')
    expect(eth0).toBeDefined()
    expect(eth0?.address).toBe('52:54:00:12:34:56')
    expect(eth0?.port).toBe('Ethernet')

    // Check Wi-Fi interface
    const wlan0 = interfaces.find(i => i.device === 'wlan0')
    expect(wlan0).toBeDefined()
    expect(wlan0?.port).toBe('Wi-Fi')
    expect(wlan0?.address).toBe('AA:BB:CC:DD:EE:FF')

    // Check bridge interface
    const br0 = interfaces.find(i => i.device === 'br0')
    expect(br0).toBeDefined()
    expect(br0?.port).toBe('Bridge')

    // Check docker interface
    const docker0 = interfaces.find(i => i.device === 'docker0')
    expect(docker0).toBeDefined()
    expect(docker0?.port).toBe('Virtual')

    // Check predictable network interface names
    const enp0s3 = interfaces.find(i => i.device === 'enp0s3')
    expect(enp0s3).toBeDefined()
    expect(enp0s3?.port).toBe('Ethernet')
  })

  it('filters by target', async () => {
    const ipLinkOutput = loadFixture('linux', 'ip-link-show.txt')
    const ipLinkEth0 = loadFixture('linux', 'ip-link-show-eth0.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'which ip') return Buffer.from('/usr/sbin/ip')
      if (cmd === 'ip link show') return Buffer.from(ipLinkOutput)
      if (cmd.includes('eth0')) return Buffer.from(ipLinkEth0)
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')

    // Filter by device name
    const byDevice = spoof.findInterfaces(['wlan0'])
    expect(byDevice.length).toBe(1)
    expect(byDevice[0].device).toBe('wlan0')

    // Filter by port type (case insensitive)
    const byPort = spoof.findInterfaces(['wi-fi'])
    expect(byPort.length).toBe(1)
    expect(byPort[0].device).toBe('wlan0')
  })
})

// =============================================================================
// Linux Tests (ifconfig - legacy)
// =============================================================================

describe('findInterfacesLinuxIfconfig', () => {
  let originalPlatform: string

  beforeEach(() => {
    originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('parses legacy ifconfig output', async () => {
    const ifconfigOutput = loadFixture('linux', 'ifconfig.txt')
    const ifconfigEth0 = loadFixture('linux', 'ifconfig-eth0.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      // Simulate ip command not available
      if (cmd === 'which ip') {
        const err = new Error('Command failed') as Error & { status?: number }
        err.status = 1
        throw err
      }
      if (cmd === 'ifconfig') {
        return Buffer.from(ifconfigOutput)
      }
      if (cmd.includes('ifconfig') && cmd.includes('eth0')) {
        return Buffer.from(ifconfigEth0)
      }
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')
    const interfaces = spoof.findInterfaces()

    expect(Array.isArray(interfaces)).toBe(true)
    expect(interfaces.length).toBeGreaterThanOrEqual(2)

    const eth0 = interfaces.find(i => i.device === 'eth0')
    expect(eth0).toBeDefined()
    expect(eth0?.address).toBe('52:54:00:12:34:56')
  })

  it('returns an empty list when legacy ifconfig is missing', async () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'which ip') {
        const err = new Error('Command failed') as Error & { status?: number }
        err.status = 1
        throw err
      }
      if (cmd === 'ifconfig') {
        const err = new Error('ifconfig not found') as Error & { status?: number }
        err.status = 127
        throw err
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    expect(spoof.findInterfaces()).toEqual([])
  })

  it('propagates legacy ifconfig operational failures', async () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'which ip') {
        const err = new Error('Command failed') as Error & { status?: number }
        err.status = 1
        throw err
      }
      if (cmd === 'ifconfig') {
        throw new Error('ifconfig timed out')
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    expect(() => spoof.findInterfaces()).toThrow('ifconfig timed out')
  })

  it('propagates async legacy ifconfig operational failures', async () => {
    const exec = vi.fn((cmd: string, _options: unknown, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
      if (cmd === 'which ip') {
        const err = new Error('Command failed') as Error & { status?: number }
        err.status = 1
        callback(err, '', '')
        return
      }
      if (cmd === 'ifconfig') {
        callback(new Error('ifconfig timed out'), '', '')
        return
      }
      callback(null, '', '')
    })

    const mock = {
      exec,
      execSync: vi.fn(),
      execFile: vi.fn(),
      execFileSync: vi.fn(),
      spawn: vi.fn(),
      spawnSync: vi.fn(),
      fork: vi.fn()
    }

    vi.resetModules()
    vi.doMock('child_process', () => ({ default: mock, ...mock }))

    const spoof = await import('../src/index.ts')

    await expect(spoof.findInterfacesAsync()).rejects.toThrow('ifconfig timed out')
  })

  it('returns an empty list when async legacy ifconfig is missing with numeric code', async () => {
    const exec = vi.fn((cmd: string, _options: unknown, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
      if (cmd === 'which ip') {
        const err = new Error('Command failed') as Error & { status?: number }
        err.status = 1
        callback(err, '', '')
        return
      }
      if (cmd === 'ifconfig') {
        const err = new Error('ifconfig not found') as Error & { code?: number }
        err.code = 127
        callback(err, '', '')
        return
      }
      callback(null, '', '')
    })

    const mock = {
      exec,
      execSync: vi.fn(),
      execFile: vi.fn(),
      execFileSync: vi.fn(),
      spawn: vi.fn(),
      spawnSync: vi.fn(),
      fork: vi.fn()
    }

    vi.resetModules()
    vi.doMock('child_process', () => ({ default: mock, ...mock }))

    const spoof = await import('../src/index.ts')

    await expect(spoof.findInterfacesAsync()).resolves.toEqual([])
  })
})

// =============================================================================
// Windows Tests
// =============================================================================

describe('findInterfacesWin32', () => {
  let originalPlatform: string

  beforeEach(() => {
    originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', writable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('parses ipconfig /all output', async () => {
    const ipconfigOutput = loadFixture('windows', 'ipconfig-all.txt')
    const getmacOutput = loadFixture('windows', 'getmac.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === [windowsSystem32, 'ipconfig.exe'].join(String.fromCharCode(92)) + ' /all') {
        return Buffer.from(ipconfigOutput)
      }
      if (cmd.endsWith('\\System32\\getmac.exe /v /fo csv')) {
        return Buffer.from(getmacOutput)
      }
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')
    const interfaces = spoof.findInterfaces()

    expect(Array.isArray(interfaces)).toBe(true)
    expect(interfaces.length).toBeGreaterThanOrEqual(2)

    // Check Ethernet
    const ethernet = interfaces.find(i => i.device === 'Ethernet')
    expect(ethernet).toBeDefined()
    expect(ethernet?.address).toBe('00:11:22:33:44:55')

    // Check Wi-Fi
    const wifi = interfaces.find(i => i.device === 'Wi-Fi')
    expect(wifi).toBeDefined()
    expect(wifi?.address).toBe('AA:BB:CC:DD:EE:FF')

    expect(mockExecSync).not.toHaveBeenCalledWith('ipconfig /all')
    expect(mockExecSync).not.toHaveBeenCalledWith('getmac /v /fo csv')
    expect(childProcessMock.execFileSync).toHaveBeenCalledWith(
      [windowsSystem32, 'ipconfig.exe'].join(String.fromCharCode(92)),
      ['/all'],
      expect.objectContaining({
        stdio: 'pipe',
        env: expect.objectContaining({
          Path: ['C:', 'Windows', 'System32'].join(String.fromCharCode(92)) + ';' + ['C:', 'Windows'].join(String.fromCharCode(92)),
          ComSpec: ['C:', 'Windows', 'System32', 'cmd.exe'].join(String.fromCharCode(92))
        })
      })
    )
    expect(childProcessMock.execFileSync).toHaveBeenCalledWith(
      [windowsSystem32, 'getmac.exe'].join(String.fromCharCode(92)),
      ['/v', '/fo', 'csv'],
      expect.objectContaining({
        stdio: 'pipe',
        timeout: 30000,
        env: expect.objectContaining({
          Path: ['C:', 'Windows', 'System32'].join(String.fromCharCode(92)) + ';' + ['C:', 'Windows'].join(String.fromCharCode(92)),
          ComSpec: ['C:', 'Windows', 'System32', 'cmd.exe'].join(String.fromCharCode(92))
        })
      })
    )
  })

  it('filters by target', async () => {
    const ipconfigOutput = loadFixture('windows', 'ipconfig-all.txt')
    const getmacOutput = loadFixture('windows', 'getmac.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === [windowsSystem32, 'ipconfig.exe'].join(String.fromCharCode(92)) + ' /all') return Buffer.from(ipconfigOutput)
      if (cmd.endsWith('\\System32\\getmac.exe /v /fo csv')) return Buffer.from(getmacOutput)
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')

    // Filter by device name
    const byDevice = spoof.findInterfaces(['wi-fi'])
    expect(byDevice.length).toBe(1)
    expect(byDevice[0].device).toBe('Wi-Fi')

    expect(mockExecSync).not.toHaveBeenCalledWith('ipconfig /all')
    expect(mockExecSync).not.toHaveBeenCalledWith('getmac /v /fo csv')
    expect(childProcessMock.execFileSync).toHaveBeenCalledWith(
      [windowsSystem32, 'ipconfig.exe'].join(String.fromCharCode(92)),
      ['/all'],
      expect.objectContaining({
        stdio: 'pipe',
        env: expect.objectContaining({
          Path: ['C:', 'Windows', 'System32'].join(String.fromCharCode(92)) + ';' + ['C:', 'Windows'].join(String.fromCharCode(92)),
          ComSpec: ['C:', 'Windows', 'System32', 'cmd.exe'].join(String.fromCharCode(92))
        })
      })
    )
    expect(childProcessMock.execFileSync).toHaveBeenCalledWith(
      [windowsSystem32, 'getmac.exe'].join(String.fromCharCode(92)),
      ['/v', '/fo', 'csv'],
      expect.objectContaining({
        stdio: 'pipe',
        timeout: 30000,
        env: expect.objectContaining({
          Path: ['C:', 'Windows', 'System32'].join(String.fromCharCode(92)) + ';' + ['C:', 'Windows'].join(String.fromCharCode(92)),
          ComSpec: ['C:', 'Windows', 'System32', 'cmd.exe'].join(String.fromCharCode(92))
        })
      })
    )
  })
})

// =============================================================================
// findInterface (singular) Tests
// =============================================================================

describe('findInterface', () => {
  let originalPlatform: string

  beforeEach(() => {
    originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns first matching interface', async () => {
    const networksetupOutput = loadFixture('darwin', 'networksetup-listallhardwareports.txt')
    const ifconfigEn0 = loadFixture('darwin', 'ifconfig-en0.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'networksetup -listallhardwareports') return Buffer.from(networksetupOutput)
      if (cmd.includes('ifconfig')) return Buffer.from(ifconfigEn0)
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')

    const iface = spoof.findInterface('en0')
    expect(iface).toBeDefined()
    expect(iface?.device).toBe('en0')
    expect(iface?.port).toBe('Ethernet')
  })

  it('returns undefined for non-existent device', async () => {
    const networksetupOutput = loadFixture('darwin', 'networksetup-listallhardwareports.txt')

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'networksetup -listallhardwareports') return Buffer.from(networksetupOutput)
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')

    const iface = spoof.findInterface('nonexistent')
    expect(iface).toBeUndefined()
  })
})

// =============================================================================
// getLinuxPortType Tests (via interface discovery)
// =============================================================================

describe('getLinuxPortType', () => {
  let originalPlatform: string

  beforeEach(() => {
    originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('correctly identifies device types', async () => {
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

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'which ip') return Buffer.from('/usr/sbin/ip')
      if (cmd === 'ip link show') return Buffer.from(customIpLinkOutput)
      // For getInterfaceMACLinux calls (execFileSync joins as "ip link show <device>")
      if (cmd.includes('ip') && cmd.includes('link') && cmd.includes('show')) {
        const match = cmd.match(/show\s+(\S+)$/)
        if (match) {
          return Buffer.from(`2: ${match[1]}: <BROADCAST>\n    link/ether 00:00:00:00:00:00 brd ff:ff:ff:ff:ff:ff`)
        }
      }
      return Buffer.from('')
    })

    vi.resetModules()
    const childProcessMock = createChildProcessMock(mockExecSync)
    vi.doMock('child_process', () => childProcessMock)

    const spoof = await import('../src/index.ts')
    const interfaces = spoof.findInterfaces()

    // Check each device type
    const eth0 = interfaces.find(i => i.device === 'eth0')
    expect(eth0?.port).toBe('Ethernet')

    const wlan0 = interfaces.find(i => i.device === 'wlan0')
    expect(wlan0?.port).toBe('Wi-Fi')

    const wlp2s0 = interfaces.find(i => i.device === 'wlp2s0')
    expect(wlp2s0?.port).toBe('Wi-Fi')

    const em1 = interfaces.find(i => i.device === 'em1')
    expect(em1?.port).toBe('Ethernet')

    const docker0 = interfaces.find(i => i.device === 'docker0')
    expect(docker0?.port).toBe('Virtual')

    const veth123 = interfaces.find(i => i.device === 'veth123')
    expect(veth123?.port).toBe('Virtual')

    const virbr0 = interfaces.find(i => i.device === 'virbr0')
    expect(virbr0?.port).toBe('Bridge')

    const unknown0 = interfaces.find(i => i.device === 'unknown0')
    expect(unknown0?.port).toBe('unknown0')
  })
})
