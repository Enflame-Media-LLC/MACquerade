<script setup lang="ts">
import DocsLayout from '@/components/DocsLayout.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
import { usePageMeta } from '@/composables/usePageMeta'

usePageMeta({
  title: 'Install',
  description: 'Install MACquerade via npm, yarn, npx, or from source. Requires Node.js 24+.',
})

const steps = [
  { title: 'Global install (npm)', cmd: 'npm install -g macquerade' },
  { title: 'Global install (yarn)', cmd: 'yarn global add macquerade' },
  { title: 'Run without installing', cmd: 'npx macquerade list' },
  { title: 'From source', cmd: 'git clone https://github.com/TheJACKedViking/spoof.git' },
]
</script>

<template>
  <DocsLayout>
    <h1 class="text-3xl font-bold">Install</h1>
    <p class="mt-3 text-[var(--muted)]">MACquerade requires <strong class="text-[var(--fg)]">Node.js 24+</strong>.</p>
    <div class="mt-8 flex flex-col gap-4">
      <div v-for="s in steps" :key="s.title">
        <h2 class="mb-2 font-semibold">{{ s.title }}</h2>
        <TerminalWindow title="shell" :command="s.cmd" :copy-text="s.cmd" />
      </div>
    </div>
  </DocsLayout>
</template>
