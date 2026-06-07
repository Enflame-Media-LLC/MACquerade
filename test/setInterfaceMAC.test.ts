/**
 * Tests for setInterfaceMAC() and related MAC-setting functionality.
 * Uses vi.doMock to mock child_process.execSync to verify correct commands are called.
 *
 * Note: This test file mocks child_process to test platform-specific behavior
 * without actually executing system commands or requiring root privileges.
 * The mocking is used ONLY for testing purposes to simulate command outputs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Helper to create child_process mock
function createChildProcessMock(mockExecSync: (cmd: string) => Buffer) {
  const mockExecFileSync = (cmd: string, args?: string[]) => {
    const fullCmd = args ? [cmd, ...args].join(' ') : cmd
    return mockExecSync(fullCmd)
  }
  const mock = {
    execSync: mockExecSync,
    execFileSync: mockExecFileSync,
    exec: vi.fn(),
    execFile: vi.fn(),
    spawn: vi.fn(),
    spawnSync: vi.fn(),
    fork: vi.fn()
  }
  return { default: mock, ...mock }
}

function createAsyncChildProcessMock(
  mockExecSync: (cmd: string) => Buffer,
  mockExec: (cmd: string) => string,
  mockExecFile: (cmd: string, args: string[]) => string
) {
  const syncMock = createChildProcessMock(mockExecSync)
  const exec = vi.fn((cmd: string, _options: unknown, callback?: (err: Error | null, stdout?: string, stderr?: string) => void) => {
    const cb = typeof _options === 'function'
      ? _options as (err: Error | null, stdout?: string, stderr?: string) => void
      : callback
    try {
      cb?.(null, { stdout: mockExec(cmd), stderr: '' } as unknown as string, '')
    } catch (err) {
      cb?.(err as Error, '', '')
    }
  })
  const execFile = vi.fn((cmd: string, args: string[], _options: unknown, callback?: (err: Error | null, stdout?: string, stderr?: string) => void) => {
    const cb = typeof _options === 'function'
      ? _options as (err: Error | null, stdout?: string, stderr?: string) => void
      : callback
    try {
      cb?.(null, { stdout: mockExecFile(cmd, args), stderr: '' } as unknown as string, '')
    } catch (err) {
      cb?.(err as Error, '', '')
    }
  })
  return {
    ...syncMock,
    default: {
      ...syncMock.default,
      exec,
      execFile
    },
    exec,
    execFile
  }
}

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('setInterfaceMAC error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('throws on invalid MAC format', async () => {
    const mockExecSync = vi.fn(() => Buffer.from(''))

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    // Test various invalid MAC formats that the regex strictly rejects
    const invalidMACs = [
      'invalid',                  // No hex digits
      'GG:GG:GG:GG:GG:GG',       // All invalid characters
      '',                         // Empty
      '00.00.00.00.00.00',       // Wrong separator (not Cisco, not standard)
      'ZZZZ.ZZZZ.ZZZZ',          // Invalid Cisco-style
    ]

    for (const mac of invalidMACs) {
      expect(() => spoof.setInterfaceMAC('en0', mac)).toThrow('not a valid MAC address')
    }
  })

  it('accepts various valid MAC formats', async () => {
    const commandsCalled: string[] = []

    const mockExecSync = vi.fn((cmd: string) => {
      commandsCalled.push(cmd)
      return Buffer.from('')
    })

    const originalPlatform = process.platform

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })

    try {
      const spoof = await import('../src/index.ts')

      // Valid MAC formats that should be accepted by MAC_VALIDATION_RE
      const validMACs = [
        '00:11:22:33:44:55',     // Colons
        '00-11-22-33-44-55',     // Dashes
      ]

      for (const mac of validMACs) {
        commandsCalled.length = 0
        try {
          spoof.setInterfaceMAC('en0', mac)
          // If it doesn't throw on MAC validation, it passed
        } catch (err) {
          const error = err as Error
          if (error.message.includes('not a valid MAC address')) {
            expect.fail(`should accept valid MAC: ${mac}`)
          }
          // Error from command execution is ok, we're testing MAC validation
        }
      }
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
    }
  })
})

// =============================================================================
// macOS (Darwin) Tests
// =============================================================================

describe('setInterfaceMAC darwin', () => {
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

  it('calls correct ifconfig command', async () => {
    const commandsCalled: string[] = []

    const mockExecSync = vi.fn((cmd: string) => {
      commandsCalled.push(cmd)
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')
    spoof.setInterfaceMAC('en0', '00:11:22:33:44:55')

    // Should call ifconfig with ether option
    const ifconfigCmd = commandsCalled.find(c => c.includes('ifconfig') && c.includes('ether'))
    expect(ifconfigCmd).toBeDefined()
    expect(ifconfigCmd).toContain('en0')
    // Check for the individual parts of the MAC address
    expect(ifconfigCmd).toContain('00')
    expect(ifconfigCmd).toContain('11')
    expect(ifconfigCmd).toContain('22')
  })

  it('wifi - power cycles airport', async () => {
    const commandsCalled: string[] = []

    const mockExecSync = vi.fn((cmd: string) => {
      commandsCalled.push(cmd)
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')
    spoof.setInterfaceMAC('en1', '00:11:22:33:44:55', 'Wi-Fi')

    // Should call networksetup to power cycle wifi
    const offCmds = commandsCalled.filter(c => c.includes('setairportpower') && c.includes('off'))
    const onCmds = commandsCalled.filter(c => c.includes('setairportpower') && c.includes('on'))

    expect(offCmds.length).toBe(2)
    expect(onCmds.length).toBe(2)

    // Should also call ifconfig
    const ifconfigCmd = commandsCalled.find(c => c.includes('ifconfig') && c.includes('ether'))
    expect(ifconfigCmd).toBeDefined()
  })

  it('handles command failure', async () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd.includes('ifconfig') && cmd.includes('ether')) {
        const err = new Error('Operation not permitted') as Error & { status?: number }
        err.status = 1
        throw err
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    expect(() => spoof.setInterfaceMAC('en0', '00:11:22:33:44:55')).toThrow('Unable to change MAC address')
  })

  it('uses a sanitized PATH when invoking privileged system tools', async () => {
    const execFileSync = vi.fn(() => Buffer.from(''))
    const mock = {
      execSync: vi.fn(),
      execFileSync,
      exec: vi.fn(),
      execFile: vi.fn(),
      spawn: vi.fn(),
      spawnSync: vi.fn(),
      fork: vi.fn()
    }

    vi.resetModules()
    vi.doMock('child_process', () => ({ default: mock, ...mock }))

    const spoof = await import('../src/index.ts')
    spoof.setInterfaceMAC('en0', '00:11:22:33:44:55')

    expect(execFileSync).toHaveBeenCalledWith(
      'ifconfig',
      ['en0', 'ether', '00:11:22:33:44:55'],
      expect.any(Object)
    )

    const options = execFileSync.mock.calls[0]?.[2] as { env: { PATH?: string, Path?: string } }
    expect([
      '/run/current-system/sw/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      ['C:', 'Windows', 'System32'].join(String.fromCharCode(92)) + ';' + ['C:', 'Windows'].join(String.fromCharCode(92)) + ';' + ['C:', 'Windows', 'System32', 'Wbem'].join(String.fromCharCode(92))
    ]).toContain(options.env.PATH)
    expect(options.env.Path).toBe(options.env.PATH)
  })
})

// =============================================================================
// Linux Tests (ip command)
// =============================================================================

describe('setInterfaceMAC linux', () => {
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

  it('uses ip command when available', async () => {
    const commandsCalled: string[] = []

    const mockExecSync = vi.fn((cmd: string) => {
      commandsCalled.push(cmd)
      if (cmd === 'which ip') {
        return Buffer.from('/usr/sbin/ip')
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')
    spoof.setInterfaceMAC('eth0', '00:11:22:33:44:55')

    // Should use ip command sequence: down, address, up
    const downCmd = commandsCalled.find(c => c.includes('ip') && c.includes('down'))
    const addressCmd = commandsCalled.find(c => c.includes('ip') && c.includes('address'))
    const upCmd = commandsCalled.find(c => c.includes('ip') && c.includes('up'))

    expect(downCmd).toBeDefined()
    expect(addressCmd).toBeDefined()
    expect(upCmd).toBeDefined()

    // Verify order: down should come before address, address before up
    const downIdx = commandsCalled.indexOf(downCmd!)
    const addrIdx = commandsCalled.indexOf(addressCmd!)
    const upIdx = commandsCalled.indexOf(upCmd!)

    expect(downIdx).toBeLessThan(addrIdx)
    expect(addrIdx).toBeLessThan(upIdx)
  })

  it('handles ip command failure', async () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'which ip') {
        return Buffer.from('/usr/sbin/ip')
      }
      if (cmd.includes('ip') && cmd.includes('down')) {
        const err = new Error('RTNETLINK answers: Operation not permitted') as Error & { status?: number }
        err.status = 2
        throw err
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    expect(() => spoof.setInterfaceMAC('eth0', '00:11:22:33:44:55')).toThrow('Unable to change MAC address')
  })

  it('uses ifconfig when ip not available', async () => {
    const commandsCalled: string[] = []

    const mockExecSync = vi.fn((cmd: string) => {
      commandsCalled.push(cmd)
      if (cmd === 'which ip') {
        throw new Error('ip not found')
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')
    spoof.setInterfaceMAC('eth0', '00:11:22:33:44:55')

    // Should use ifconfig command
    const downCmd = commandsCalled.find(c => c.includes('ifconfig') && c.includes('down'))
    const upCmd = commandsCalled.find(c => c.includes('ifconfig') && c.includes('up'))

    expect(downCmd).toBeDefined()
    expect(downCmd).toContain('hw')
    expect(downCmd).toContain('ether')
    expect(upCmd).toBeDefined()
  })

  it('respects preferIfconfig setting', async () => {
    const commandsCalled: string[] = []

    const mockExecSync = vi.fn((cmd: string) => {
      commandsCalled.push(cmd)
      if (cmd === 'which ip') {
        return Buffer.from('/usr/sbin/ip')
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    // Enable preferIfconfig
    spoof.setPreferIfconfig(true)

    commandsCalled.length = 0
    spoof.setInterfaceMAC('eth0', '00:11:22:33:44:55')

    // Should use ifconfig even though ip is available
    const ifconfigCmds = commandsCalled.filter(c => c.includes('ifconfig'))
    const ipLinkCmds = commandsCalled.filter(c => c.includes("'ip'") || c.startsWith('ip '))
      .filter(c => c.includes('link'))

    expect(ifconfigCmds.length).toBeGreaterThan(0)
    expect(ipLinkCmds.length).toBe(0)

    // Reset
    spoof.setPreferIfconfig(false)
  })
})

// =============================================================================
// getInterfaceMAC Tests
// =============================================================================

describe('getInterfaceMAC darwin', () => {
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

  it('parses ifconfig output', async () => {
    const ifconfigOutput = `en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
\tether 00:11:22:33:44:55
\tinet 192.168.1.100 netmask 0xffffff00 broadcast 192.168.1.255`

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'networksetup -listallhardwareports') {
        return Buffer.from(`Hardware Port: Ethernet
Device: en0
Ethernet Address: AA:BB:CC:DD:EE:FF`)
      }
      if (cmd.includes('ifconfig') && cmd.includes('en0')) {
        return Buffer.from(ifconfigOutput)
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    const interfaces = spoof.findInterfaces()
    const en0 = interfaces.find(i => i.device === 'en0')

    expect(en0).toBeDefined()
    expect(en0?.currentAddress).toBe('00:11:22:33:44:55')
    expect(en0?.address).toBe('AA:BB:CC:DD:EE:FF')
  })
})

describe('getInterfaceMAC linux', () => {
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

  it('uses ip command when available', async () => {
    const ipLinkOutput = `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 00:11:22:33:44:55 brd ff:ff:ff:ff:ff:ff`

    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'which ip') return Buffer.from('/usr/sbin/ip')
      if (cmd === 'ip link show') {
        return Buffer.from(`2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff`)
      }
      if (cmd.includes('ip') && cmd.includes('link') && cmd.includes('show') && cmd.includes('eth0')) {
        return Buffer.from(ipLinkOutput)
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    const interfaces = spoof.findInterfaces()
    const eth0 = interfaces.find(i => i.device === 'eth0')

    expect(eth0).toBeDefined()
    expect(eth0?.currentAddress).toBe('00:11:22:33:44:55')
  })

  it('falls back to ifconfig', async () => {
    const ifconfigOutput = `eth0      Link encap:Ethernet  HWaddr 00:11:22:33:44:55
          inet addr:192.168.1.100`

    const mockExecSync = vi.fn((cmd: string) => {
      // ip command not available
      if (cmd === 'which ip') {
        throw new Error('not found')
      }
      if (cmd === 'ifconfig') {
        return Buffer.from(`eth0      Link encap:Ethernet  HWaddr aa:bb:cc:dd:ee:ff
          inet addr:192.168.1.100`)
      }
      if (cmd.includes('ifconfig') && cmd.includes('eth0')) {
        return Buffer.from(ifconfigOutput)
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    const interfaces = spoof.findInterfaces()
    const eth0 = interfaces.find(i => i.device === 'eth0')

    expect(eth0).toBeDefined()
    expect(eth0?.currentAddress).toBe('00:11:22:33:44:55')
  })

  it('async API uses ip command when ifconfig is unavailable', async () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'which ip') return Buffer.from('/usr/sbin/ip')
      return Buffer.from('')
    })
    const mockExec = vi.fn((cmd: string) => {
      if (cmd === 'which ip') return '/usr/sbin/ip'
      return ''
    })
    const mockExecFile = vi.fn((cmd: string, args: string[]) => {
      const fullCmd = [cmd, ...args].join(' ')
      if (fullCmd === 'ip link show eth0') {
        return `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 00:11:22:33:44:55 brd ff:ff:ff:ff:ff:ff`
      }
      if (cmd === 'ifconfig') {
        throw new Error('ifconfig not found')
      }
      return ''
    })

    vi.resetModules()
    vi.doMock('child_process', () => createAsyncChildProcessMock(mockExecSync, mockExec, mockExecFile))

    const spoof = await import('../src/index.ts')

    const mac = await spoof.getInterfaceMACAsync('eth0')
    expect(mockExecFile.mock.calls).toEqual([['ip', ['link', 'show', 'eth0']]])
    expect(mac).toBe('00:11:22:33:44:55')
  })
})

describe('getInterfaceMAC error handling', () => {
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

  it('returns null on command failure', async () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd === 'networksetup -listallhardwareports') {
        return Buffer.from(`Hardware Port: Ethernet
Device: en0
Ethernet Address: AA:BB:CC:DD:EE:FF`)
      }
      // ifconfig fails
      if (cmd.includes('ifconfig')) {
        throw new Error('Device not found')
      }
      return Buffer.from('')
    })

    vi.resetModules()
    vi.doMock('child_process', () => createChildProcessMock(mockExecSync))

    const spoof = await import('../src/index.ts')

    const interfaces = spoof.findInterfaces()
    const en0 = interfaces.find(i => i.device === 'en0')

    expect(en0).toBeDefined()
    expect(en0?.currentAddress).toBeNull()
  })
})

// =============================================================================
// Windows Registry Matching Tests
// =============================================================================

describe('setInterfaceMACAsync win32 registry matching', () => {
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

  it('sets NetworkAddress only on the registry key for the requested adapter', async () => {
    const setCalls: Array<{ key: string; name: string; value: string }> = []
    const netshCalls: string[] = []

    const registryValues: Record<string, Array<{ name: string; value: string }>> = {
      '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002BE10318}\\0001': [
        { name: 'AdapterModel', value: 'Ethernet Adapter' },
        { name: 'DriverDesc', value: 'Ethernet Adapter' }
      ],
      '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002BE10318}\\0002': [
        { name: 'AdapterModel', value: 'Wi-Fi Adapter' },
        { name: 'DriverDesc', value: 'Wi-Fi Adapter' },
        { name: 'NetConnectionID', value: 'Wi-Fi' }
      ]
    }

    class MockWinreg {
      static HKLM = 'HKLM'
      key: string

      constructor(options: { key: string }) {
        this.key = options.key
      }

      keys(callback: (err: Error | null, keys?: MockWinreg[]) => void): void {
        callback(null, [
          new MockWinreg({ key: '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002BE10318}\\0001' }),
          new MockWinreg({ key: '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002BE10318}\\0002' })
        ])
      }

      values(callback: (err: Error | null, values?: Array<{ name: string; value: string }>) => void): void {
        callback(null, registryValues[this.key] || [])
      }

      set(name: string, _type: string, value: string, callback: (err: Error | null) => void): void {
        setCalls.push({ key: this.key, name, value })
        callback(null)
      }
    }

    const mockExecSync = vi.fn(() => Buffer.from(''))
    const mockExec = vi.fn(() => '')
    const mockExecFile = vi.fn((cmd: string, args: string[]) => {
      netshCalls.push([cmd, ...args].join(' '))
      return ''
    })

    vi.resetModules()
    vi.doMock('child_process', () => createAsyncChildProcessMock(mockExecSync, mockExec, mockExecFile))
    vi.doMock('winreg', () => ({ default: MockWinreg }))

    const spoof = await import('../src/index.ts')
    await spoof.setInterfaceMACAsync('Wi-Fi', '00:11:22:33:44:55')

    expect(setCalls).toEqual([
      {
        key: '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002BE10318}\\0002',
        name: 'NetworkAddress',
        value: '001122334455'
      }
    ])
    expect(netshCalls).toEqual([
      'netsh interface set interface Wi-Fi disable',
      'netsh interface set interface Wi-Fi enable'
    ])
  })
})
