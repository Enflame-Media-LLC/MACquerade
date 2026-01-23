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
