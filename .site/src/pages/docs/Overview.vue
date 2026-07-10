<script setup lang="ts">
import DocsLayout from '@/components/DocsLayout.vue'
import { docsNav } from '@/data/commands'
import { usePageMeta } from '@/composables/usePageMeta'

usePageMeta({
  title: 'Docs',
  description: 'MACquerade documentation — commands, flags, installation, and platform notes.',
})
const cards = docsNav.filter((n) => n.to !== '/docs')
</script>

<template>
  <DocsLayout>
    <h1 class="text-3xl font-bold">Documentation</h1>
    <p class="mt-3 text-[var(--muted)]">
      MACquerade is a modern, TypeScript CLI for changing MAC addresses on macOS, Linux, and
      Windows. Start with installation, then explore the full command reference.
    </p>
    <div class="mt-8 grid gap-4 sm:grid-cols-2">
      <RouterLink
        v-for="c in cards"
        :key="c.to"
        :to="c.to"
        class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[var(--accent)]"
      >
        <span class="font-semibold text-[var(--fg)]">{{ c.label }}</span>
      </RouterLink>
    </div>
  </DocsLayout>
</template>
