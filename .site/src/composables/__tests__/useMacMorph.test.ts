import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMacMorph, setMacRng } from '@/composables/useMacMorph'

const MAC_RE = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/

describe('useMacMorph', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setMacRng(() => 0.5)
  })
  afterEach(() => {
    vi.useRealTimers()
    setMacRng(Math.random)
  })

  it('starts with a valid MAC', () => {
    const { mac } = useMacMorph()
    expect(mac.value).toMatch(MAC_RE)
  })

  it('remains a valid MAC after morphing completes', () => {
    const { mac, morph } = useMacMorph({ steps: 3, interval: 10 })
    morph()
    vi.advanceTimersByTime(40)
    expect(mac.value).toMatch(MAC_RE)
  })
})
