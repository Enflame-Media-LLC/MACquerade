<script setup lang="ts">
import DocsLayout from '@/components/DocsLayout.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
import { commands } from '@/data/commands'
import { usePageMeta } from '@/composables/usePageMeta'

usePageMeta({
  title: 'Commands',
  description: 'Full MACquerade command reference: list, set, randomize, reset, normalize, lookup, vendors.',
})
</script>

<template>
  <DocsLayout>
    <h1 class="text-3xl font-bold">Commands</h1>
    <p class="mt-3 text-[var(--muted)]">Run <code class="font-mono text-[var(--accent)]">macquerade --help</code> for up-to-date usage.</p>
    <div class="mt-8 flex flex-col gap-8">
      <section v-for="c in commands" :key="c.name">
        <h2 class="font-mono text-xl font-semibold text-[var(--accent)]">{{ c.signature }}</h2>
        <p class="mt-2 text-sm text-[var(--muted)]">{{ c.description }}</p>
        <div class="mt-3 flex flex-col gap-2">
          <TerminalWindow
            v-for="ex in c.examples"
            :key="ex"
            :title="c.name"
            :command="ex"
            :copy-text="ex"
          />
        </div>
      </section>
    </div>
  </DocsLayout>
</template>
