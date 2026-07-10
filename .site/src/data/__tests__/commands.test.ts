import { describe, it, expect } from 'vitest'
import { commands, flags, exitCodes, docsNav } from '@/data/commands'

describe('commands data', () => {
  it('includes the core commands', () => {
    const names = commands.map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining(['list', 'set', 'randomize', 'reset', 'normalize', 'lookup', 'vendors']),
    )
  })

  it('every command has at least one example', () => {
    for (const c of commands) expect(c.examples.length).toBeGreaterThan(0)
  })

  it('exposes flags, exit codes, and nav', () => {
    expect(flags.length).toBeGreaterThan(5)
    expect(exitCodes.length).toBe(3)
    expect(docsNav.map((n) => n.to)).toContain('/docs/commands')
  })
})
