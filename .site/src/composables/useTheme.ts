import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'mq-theme'

function readInitial(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    // localStorage missing (SSR) or blocked (SecurityError) — default to dark
    return 'dark'
  }
}

const theme = ref<Theme>(readInitial())

function apply(value: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', value === 'dark')
  }
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // storage blocked — the theme still applies to the DOM for this session
  }
}

watch(theme, apply, { immediate: true, flush: 'sync' })

export function useTheme(): {
  theme: Ref<Theme>
  isDark: ComputedRef<boolean>
  toggle: () => void
} {
  // Re-sync the DOM/localStorage to the current state on every call. This is a
  // no-op in normal operation (the watcher above already keeps them in sync on
  // change), but guards against external DOM mutation between calls.
  apply(theme.value)
  const isDark = computed(() => theme.value === 'dark')
  const toggle = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, isDark, toggle }
}
