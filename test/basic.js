import * as spoof from '../index.js'
import test from 'tape'

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
