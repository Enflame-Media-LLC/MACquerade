import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTypewriter } from '@/composables/useTypewriter'

describe('useTypewriter', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('types text one character at a time', () => {
    const { output, done, start } = useTypewriter({ text: 'hi', speed: 10 })
    expect(output.value).toBe('')
    expect(done.value).toBe(false)
    start()
    vi.advanceTimersByTime(10)
    expect(output.value).toBe('h')
    vi.advanceTimersByTime(10)
    expect(output.value).toBe('hi')
    expect(done.value).toBe(true)
  })

  it('reset clears output and done', () => {
    const { output, done, start, reset } = useTypewriter({ text: 'ab', speed: 5 })
    start()
    vi.advanceTimersByTime(10)
    expect(done.value).toBe(true)
    reset()
    expect(output.value).toBe('')
    expect(done.value).toBe(false)
  })
})
