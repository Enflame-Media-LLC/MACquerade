<script setup lang="ts">
import { ref } from 'vue'
import { Menu, Moon, Sun } from '@lucide/vue'
import GithubIcon from './GithubIcon.vue'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { useTheme } from '@/composables/useTheme'
import MaskLogo from './MaskLogo.vue'

const { isDark, toggle } = useTheme()
const open = ref(false)

const links = [
  { label: 'Home', to: '/' },
  { label: 'Docs', to: '/docs' },
]
const GITHUB = 'https://github.com/TheJACKedViking/spoof'
const NPM = 'https://npmjs.org/package/macquerade'
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md"
  >
    <nav class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
      <RouterLink to="/" class="flex items-center gap-2 font-semibold tracking-tight">
        <MaskLogo class="h-6 w-9" />
        <span>MACquerade</span>
      </RouterLink>

      <div class="ml-auto hidden items-center gap-6 md:flex">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="text-sm text-[var(--muted)] transition hover:text-[var(--fg)]"
        >
          {{ l.label }}
        </RouterLink>
        <a :href="NPM" class="text-sm text-[var(--muted)] transition hover:text-[var(--fg)]">npm</a>
        <a :href="GITHUB" aria-label="GitHub" class="text-[var(--muted)] transition hover:text-[var(--fg)]">
          <GithubIcon class="size-5" />
        </a>
        <button
          type="button"
          aria-label="Toggle theme"
          class="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:text-[var(--accent)]"
          @click="toggle"
        >
          <component :is="isDark ? Sun : Moon" class="size-4" />
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2 md:hidden">
        <button
          type="button"
          aria-label="Toggle theme"
          class="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)]"
          @click="toggle"
        >
          <component :is="isDark ? Sun : Moon" class="size-4" />
        </button>
        <DialogRoot v-model:open="open">
          <DialogTrigger aria-label="Open menu" class="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)]">
            <Menu class="size-5" />
          </DialogTrigger>
          <DialogPortal>
            <DialogOverlay
              class="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:duration-200 data-[state=closed]:duration-150"
            />
            <DialogContent
              class="fixed right-0 top-0 z-50 h-full w-64 border-l border-[var(--border)] bg-[var(--card)] p-6 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:duration-200 data-[state=closed]:duration-150"
            >
              <DialogTitle class="sr-only">Navigation menu</DialogTitle>
              <DialogDescription class="sr-only">Site navigation links</DialogDescription>
              <div class="flex flex-col gap-4">
                <RouterLink
                  v-for="l in links"
                  :key="l.to"
                  :to="l.to"
                  class="text-[var(--fg)]"
                  @click="open = false"
                >
                  {{ l.label }}
                </RouterLink>
                <a :href="NPM" class="text-[var(--fg)]">npm</a>
                <a :href="GITHUB" class="text-[var(--fg)]">GitHub</a>
                <DialogClose class="mt-4 text-left text-sm text-[var(--muted)]">Close</DialogClose>
              </div>
            </DialogContent>
          </DialogPortal>
        </DialogRoot>
      </div>
    </nav>
  </header>
</template>
