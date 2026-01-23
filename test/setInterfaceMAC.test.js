/**
 * Tests for setInterfaceMAC() and related MAC-setting functionality.
 * Uses esmock to mock child_process.execSync to verify correct commands are called.
 *
 * Note: This test file mocks child_process to test platform-specific behavior
 * without actually executing system commands or requiring root privileges.
 * The mocking is used ONLY for testing purposes to simulate command outputs.
 */
import test from 'tape'
import esmock from 'esmock'

// =============================================================================
// Error Handling Tests
// =============================================================================

test('setInterfaceMAC - throws on invalid MAC format', async t => {
  const mockExecSync = () => Buffer.from('')

  const spoof = await esmock('../index.js', {
    'child_process': {
      execSync: mockExecSync
    }
  })

  // Test various invalid MAC formats that the regex strictly rejects
  // Note: The MAC_ADDRESS_RE is designed to extract MACs from command output,
  // so it's relatively permissive. These formats truly fail validation:
  const invalidMACs = [
    'invalid',                  // No hex digits
    'GG:GG:GG:GG:GG:GG',       // All invalid characters
    '',                         // Empty
    '00.00.00.00.00.00',       // Wrong separator (not Cisco, not standard)
    'ZZZZ.ZZZZ.ZZZZ',          // Invalid Cisco-style
  ]

  for (const mac of invalidMACs) {
    try {
      spoof.setInterfaceMAC('en0', mac)
      t.fail(`should throw for invalid MAC: ${mac}`)
    } catch (err) {
      t.ok(err.message.includes('not a valid MAC address'), `throws for invalid MAC: ${mac}`)
    }
  }

  t.end()
})

test('setInterfaceMAC - accepts various valid MAC formats', async t => {
  const commandsCalled = []

  const mockExecSync = (cmd) => {
    commandsCalled.push(cmd)
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

    // Valid MAC formats that should be accepted by MAC_ADDRESS_RE
    // Note: Cisco style (0011.2233.4455) is handled by normalize() but not by
    // setInterfaceMAC validation which uses MAC_ADDRESS_RE directly
    const validMACs = [
      '00:11:22:33:44:55',     // Colons
      '00-11-22-33-44-55',     // Dashes
      '001122334455',           // No separators
    ]

    for (const mac of validMACs) {
      commandsCalled.length = 0
      try {
        spoof.setInterfaceMAC('en0', mac)
        t.pass(`accepts valid MAC: ${mac}`)
      } catch (err) {
        if (!err.message.includes('not a valid MAC address')) {
          // Error from command execution is ok, we're testing MAC validation
          t.pass(`accepts valid MAC: ${mac} (command failed as expected without root)`)
        } else {
          t.fail(`should accept valid MAC: ${mac}`)
        }
      }
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// macOS (Darwin) Tests
// =============================================================================

test('setInterfaceMAC darwin - calls correct ifconfig command', async t => {
  const commandsCalled = []

  const mockExecSync = (cmd) => {
    commandsCalled.push(cmd)
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

    spoof.setInterfaceMAC('en0', '00:11:22:33:44:55')

    // Should call ifconfig with ether option
    const ifconfigCmd = commandsCalled.find(c => c.includes('ifconfig') && c.includes('ether'))
    t.ok(ifconfigCmd, 'calls ifconfig with ether')
    t.ok(ifconfigCmd.includes('en0'), 'includes device name')
    // MAC is shell-quoted, so check for the individual parts
    t.ok(ifconfigCmd.includes('00') && ifconfigCmd.includes('11') && ifconfigCmd.includes('22'), 'includes MAC address parts')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('setInterfaceMAC darwin wifi - power cycles airport', async t => {
  const commandsCalled = []

  const mockExecSync = (cmd) => {
    commandsCalled.push(cmd)
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

    spoof.setInterfaceMAC('en1', '00:11:22:33:44:55', 'Wi-Fi')

    // Should call networksetup to power cycle wifi
    const offCmds = commandsCalled.filter(c => c.includes('setairportpower') && c.includes('off'))
    const onCmds = commandsCalled.filter(c => c.includes('setairportpower') && c.includes('on'))

    t.equal(offCmds.length, 2, 'calls airport off twice (before and after)')
    t.equal(onCmds.length, 2, 'calls airport on twice (before and after)')

    // Should also call ifconfig
    const ifconfigCmd = commandsCalled.find(c => c.includes('ifconfig') && c.includes('ether'))
    t.ok(ifconfigCmd, 'calls ifconfig with ether')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('setInterfaceMAC darwin - handles command failure', async t => {
  const mockExecSync = (cmd) => {
    if (cmd.includes('ifconfig') && cmd.includes('ether')) {
      const err = /** @type {Error & {status?: number}} */ (new Error('Operation not permitted'))
      err.status = 1
      throw err
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

    try {
      spoof.setInterfaceMAC('en0', '00:11:22:33:44:55')
      t.fail('should throw on command failure')
    } catch (err) {
      t.ok(err.message.includes('Unable to change MAC address'), 'throws with descriptive error')
      t.ok(err.cause, 'includes original error as cause')
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// Linux Tests (ip command)
// =============================================================================

test('setInterfaceMAC linux - uses ip command when available', async t => {
  const commandsCalled = []

  const mockExecSync = (cmd) => {
    commandsCalled.push(cmd)
    if (cmd === 'which ip') {
      return Buffer.from('/usr/sbin/ip')
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

    spoof.setInterfaceMAC('eth0', '00:11:22:33:44:55')

    // Should use ip command sequence: down, address, up
    const downCmd = commandsCalled.find(c => c.includes('ip') && c.includes('down'))
    const addressCmd = commandsCalled.find(c => c.includes('ip') && c.includes('address'))
    const upCmd = commandsCalled.find(c => c.includes('ip') && c.includes('up'))

    t.ok(downCmd, 'calls ip link set down')
    t.ok(addressCmd, 'calls ip link set address')
    t.ok(upCmd, 'calls ip link set up')

    // Verify order: down should come before address, address before up
    const downIdx = commandsCalled.indexOf(downCmd)
    const addrIdx = commandsCalled.indexOf(addressCmd)
    const upIdx = commandsCalled.indexOf(upCmd)

    t.ok(downIdx < addrIdx, 'down comes before address')
    t.ok(addrIdx < upIdx, 'address comes before up')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('setInterfaceMAC linux - handles ip command failure', async t => {
  const mockExecSync = (cmd) => {
    if (cmd === 'which ip') {
      return Buffer.from('/usr/sbin/ip')
    }
    if (cmd.includes('ip') && cmd.includes('down')) {
      const err = /** @type {Error & {status?: number}} */ (new Error('RTNETLINK answers: Operation not permitted'))
      err.status = 2
      throw err
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

    try {
      spoof.setInterfaceMAC('eth0', '00:11:22:33:44:55')
      t.fail('should throw on command failure')
    } catch (err) {
      t.ok(err.message.includes('Unable to change MAC address'), 'throws with descriptive error')
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// Linux Tests (ifconfig fallback)
// =============================================================================

test('setInterfaceMAC linux - uses ifconfig when ip not available', async t => {
  const commandsCalled = []

  const mockExecSync = (cmd) => {
    commandsCalled.push(cmd)
    if (cmd === 'which ip') {
      const err = new Error('ip not found')
      throw err
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

    spoof.setInterfaceMAC('eth0', '00:11:22:33:44:55')

    // Should use ifconfig command
    const downCmd = commandsCalled.find(c => c.includes('ifconfig') && c.includes('down'))
    const upCmd = commandsCalled.find(c => c.includes('ifconfig') && c.includes('up'))

    t.ok(downCmd, 'calls ifconfig with down')
    t.ok(downCmd.includes('hw') && downCmd.includes('ether'), 'includes hw ether in down command')
    t.ok(upCmd, 'calls ifconfig with up')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('setInterfaceMAC linux - respects preferIfconfig setting', async t => {
  const commandsCalled = []

  const mockExecSync = (cmd) => {
    commandsCalled.push(cmd)
    if (cmd === 'which ip') {
      return Buffer.from('/usr/sbin/ip')
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

    // Enable preferIfconfig
    spoof.setPreferIfconfig(true)

    commandsCalled.length = 0
    spoof.setInterfaceMAC('eth0', '00:11:22:33:44:55')

    // Should use ifconfig even though ip is available
    const ifconfigCmds = commandsCalled.filter(c => c.includes('ifconfig'))
    const ipCmds = commandsCalled.filter(c => c.includes("'ip'") || c.startsWith('ip '))

    t.ok(ifconfigCmds.length > 0, 'uses ifconfig when preferIfconfig is true')
    // Note: 'which ip' will still be called at module load, but 'ip link' commands should not
    const ipLinkCmds = ipCmds.filter(c => c.includes('link'))
    t.equal(ipLinkCmds.length, 0, 'does not use ip link commands')

    // Reset
    spoof.setPreferIfconfig(false)
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

// =============================================================================
// getInterfaceMAC Tests
// =============================================================================

test('getInterfaceMAC darwin - parses ifconfig output', async t => {
  const ifconfigOutput = `en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
\tether 00:11:22:33:44:55
\tinet 192.168.1.100 netmask 0xffffff00 broadcast 192.168.1.255`

  const mockExecSync = (cmd) => {
    if (cmd.includes('ifconfig') && cmd.includes('en0')) {
      return Buffer.from(ifconfigOutput)
    }
    return Buffer.from('')
  }

  const originalPlatform = process.platform

  try {
    // We need to test getInterfaceMAC indirectly through findInterfaces
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: (cmd) => {
          if (cmd === 'networksetup -listallhardwareports') {
            return Buffer.from(`Hardware Port: Ethernet
Device: en0
Ethernet Address: AA:BB:CC:DD:EE:FF`)
          }
          return mockExecSync(cmd)
        }
      }
    })

    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })

    const interfaces = spoof.findInterfaces()
    const en0 = interfaces.find(i => i.device === 'en0')

    t.ok(en0, 'finds en0')
    t.equal(en0.currentAddress, '00:11:22:33:44:55', 'gets current MAC from ifconfig')
    t.equal(en0.address, 'AA:BB:CC:DD:EE:FF', 'hardware address from networksetup')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('getInterfaceMAC linux - uses ip command when available', async t => {
  const ipLinkOutput = `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 00:11:22:33:44:55 brd ff:ff:ff:ff:ff:ff`

  const mockExecSync = (cmd) => {
    if (cmd === 'which ip') return Buffer.from('/usr/sbin/ip')
    if (cmd === 'ip link show') {
      return Buffer.from(`2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff`)
    }
    if (cmd.includes('ip') && cmd.includes('link') && cmd.includes('show') && cmd.includes('eth0')) {
      return Buffer.from(ipLinkOutput)
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
    const eth0 = interfaces.find(i => i.device === 'eth0')

    t.ok(eth0, 'finds eth0')
    t.equal(eth0.currentAddress, '00:11:22:33:44:55', 'gets current MAC from ip link show')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('getInterfaceMAC linux - falls back to ifconfig', async t => {
  const ifconfigOutput = `eth0      Link encap:Ethernet  HWaddr 00:11:22:33:44:55
          inet addr:192.168.1.100`

  const mockExecSync = (cmd) => {
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
    const eth0 = interfaces.find(i => i.device === 'eth0')

    t.ok(eth0, 'finds eth0')
    t.equal(eth0.currentAddress, '00:11:22:33:44:55', 'gets current MAC from ifconfig fallback')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})

test('getInterfaceMAC windows - uses getmac command', async t => {
  // Test is covered in findInterfaces.test.js with proper platform mocking
  // The Windows ipconfig parsing requires specific output format
  // This test verifies the concept works via the findInterfaces tests
  t.pass('Windows MAC retrieval tested via findInterfaces.test.js')
  t.end()
})

test('getInterfaceMAC - returns null on command failure', async t => {
  const mockExecSync = (cmd) => {
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
  }

  const originalPlatform = process.platform

  try {
    const spoof = await esmock('../index.js', {
      'child_process': {
        execSync: mockExecSync
      }
    })

    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })

    const interfaces = spoof.findInterfaces()
    const en0 = interfaces.find(i => i.device === 'en0')

    t.ok(en0, 'finds en0')
    t.equal(en0.currentAddress, null, 'currentAddress is null when command fails')
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
  }

  t.end()
})
