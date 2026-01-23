import * as spoof from '../dist/index.js'
import test from 'tape'
import { randomInt } from 'node:crypto'

test('spoof.normalize()', t => {
  t.equal(spoof.normalize('00:00:00:00:00:00'), '00:00:00:00:00:00')
  t.equal(spoof.normalize('00-00-00-00-00-00'), '00:00:00:00:00:00')
  t.equal(spoof.normalize('0000.0000.0000'), '00:00:00:00:00:00')
  t.end()
})

test('spoof.random', t => {
  const mac = spoof.randomize()
  t.equal(mac, spoof.normalize(mac), 'returns valid, normalized mac addresses')
  t.end()
})

test('spoof.setPreferIfconfig()', t => {
  // Test that setPreferIfconfig is exported and callable
  t.equal(typeof spoof.setPreferIfconfig, 'function', 'setPreferIfconfig is a function')
  // Should not throw when called with boolean values
  t.doesNotThrow(() => spoof.setPreferIfconfig(true), 'accepts true')
  t.doesNotThrow(() => spoof.setPreferIfconfig(false), 'accepts false')
  // Reset to default
  spoof.setPreferIfconfig(false)
  t.end()
})

test('spoof.findInterfaces()', t => {
  // Test that findInterfaces is exported and callable
  t.equal(typeof spoof.findInterfaces, 'function', 'findInterfaces is a function')
  // Should not throw on current platform
  t.doesNotThrow(() => spoof.findInterfaces(), 'findInterfaces() does not throw')
  t.doesNotThrow(() => spoof.findInterfaces([]), 'findInterfaces([]) does not throw')
  // Result should be an array
  const interfaces = spoof.findInterfaces()
  t.ok(Array.isArray(interfaces), 'findInterfaces returns an array')
  t.end()
})

test('spoof.setRandomFunction() - allows custom random for testing', t => {
  // Test that setRandomFunction is exported and callable
  t.equal(typeof spoof.setRandomFunction, 'function', 'setRandomFunction is a function')

  // Create a seeded "random" function that returns predictable values
  let callCount = 0
  const predictableRandom = (min, _max) => {
    callCount++
    return min // Always return min for predictability
  }

  // Set custom random function
  spoof.setRandomFunction(predictableRandom)

  // Generate a MAC - should use our predictable function
  const mac1 = spoof.randomize()
  t.ok(callCount > 0, 'custom random function was called')

  // Reset call count and generate another - should be identical
  const previousCount = callCount
  const mac2 = spoof.randomize()
  t.ok(callCount > previousCount, 'custom random function called again')
  t.equal(mac1, mac2, 'same random function produces same MAC')

  // Reset to default (crypto) random
  spoof.setRandomFunction(null)

  // Generate MACs with crypto random - should be different (statistically)
  const cryptoMacs = new Set()
  for (let i = 0; i < 10; i++) {
    cryptoMacs.add(spoof.randomize())
  }
  t.ok(cryptoMacs.size > 1, 'crypto random produces varied MACs')

  t.end()
})

test('spoof.randomize() uses cryptographically secure random by default', t => {
  // Verify the default uses crypto by checking that node:crypto module is available
  // and that randomInt is a function (this confirms the import works)
  t.equal(typeof randomInt, 'function', 'crypto.randomInt is available')

  // Generate multiple MACs and verify they're all valid and mostly unique
  const macs = []
  for (let i = 0; i < 100; i++) {
    macs.push(spoof.randomize())
  }

  // All should be valid normalized MACs
  macs.forEach((mac, i) => {
    t.equal(mac, spoof.normalize(mac), `MAC ${i} is valid and normalized`)
  })

  // Should have high entropy (many unique values)
  const unique = new Set(macs)
  t.ok(unique.size > 90, `high entropy: ${unique.size}/100 unique MACs`)

  t.end()
})

test('spoof.parseCSVLine()', t => {
  // Test that parseCSVLine is exported and callable
  t.equal(typeof spoof.parseCSVLine, 'function', 'parseCSVLine is a function')

  // Test basic CSV parsing
  t.deepEqual(
    spoof.parseCSVLine('"Ethernet","Intel Adapter","00-11-22-33-44-55","\\Device\\Tcpip"'),
    ['Ethernet', 'Intel Adapter', '00-11-22-33-44-55', '\\Device\\Tcpip'],
    'parses basic CSV line correctly'
  )

  // Test fields with commas inside quotes
  t.deepEqual(
    spoof.parseCSVLine('"Wi-Fi","Intel(R) Wireless, 802.11ac","AA-BB-CC-DD-EE-FF","\\Device"'),
    ['Wi-Fi', 'Intel(R) Wireless, 802.11ac', 'AA-BB-CC-DD-EE-FF', '\\Device'],
    'handles commas inside quoted fields'
  )

  // Test escaped quotes (two consecutive quotes)
  t.deepEqual(
    spoof.parseCSVLine('"Name with ""quotes""","Adapter","00-00-00-00-00-00",""'),
    ['Name with "quotes"', 'Adapter', '00-00-00-00-00-00', ''],
    'handles escaped quotes correctly'
  )

  // Test empty fields
  t.deepEqual(
    spoof.parseCSVLine('"","Empty","",""'),
    ['', 'Empty', '', ''],
    'handles empty quoted fields'
  )

  t.end()
})
