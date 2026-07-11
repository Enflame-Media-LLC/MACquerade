import { describe, it, expect, beforeEach } from 'vitest'
import { useTheme } from '@/composables/useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to dark and sets the .dark class', () => {
    const { isDark } = useTheme()
    expect(isDark.value).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggle switches between dark and light and persists', () => {
    const { theme, toggle } = useTheme()
    theme.value = 'dark'
    toggle()
    expect(theme.value).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('mq-theme')).toBe('light')
    toggle()
    expect(theme.value).toBe('dark')
    expect(localStorage.getItem('mq-theme')).toBe('dark')
  })
})
