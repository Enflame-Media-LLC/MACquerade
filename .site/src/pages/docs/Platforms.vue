<script setup lang="ts">
import DocsLayout from '@/components/DocsLayout.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
import { usePageMeta } from '@/composables/usePageMeta'

usePageMeta({
  title: 'Platforms',
  description: 'Platform-specific notes for MACquerade on macOS, Linux, and Windows.',
})

const platforms = [
  { name: 'macOS', note: 'Uses networksetup and the airport binary. Requires sudo for changes. Restarting also resets the MAC — macOS does not persist changes across reboots.' },
  { name: 'Linux', note: 'Uses ip (iproute2) by default and falls back to ifconfig. Pass --prefer-ifconfig to force the legacy tool. Requires sudo for changes.' },
  { name: 'Windows', note: 'Uses ipconfig and the Windows Registry (via winreg). Must be run from an Administrator shell. Changes may require disabling/re-enabling the adapter (handled automatically where possible).' },
]
</script>

<template>
  <DocsLayout>
    <h1 class="text-3xl font-bold">Platform Notes</h1>
    <div class="mt-8 flex flex-col gap-6">
      <div v-for="p in platforms" :key="p.name" class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 class="mb-2 text-xl font-semibold text-[var(--accent)]">{{ p.name }}</h2>
        <p class="text-sm text-[var(--muted)]">{{ p.note }}</p>
      </div>
    </div>
    <h2 class="mt-12 text-2xl font-bold">Updating the OUI database</h2>
    <p class="mt-3 text-sm text-[var(--muted)]">Refresh the bundled vendor database from the IEEE registry:</p>
    <div class="mt-4">
      <TerminalWindow title="shell" command="yarn update-oui" copy-text="yarn update-oui" />
    </div>
  </DocsLayout>
</template>
