<script setup lang="ts">
import DocsLayout from '@/components/DocsLayout.vue'
import { flags, exitCodes } from '@/data/commands'
import { usePageMeta } from '@/composables/usePageMeta'

usePageMeta({
  title: 'Flags & Exit Codes',
  description: 'Global flags and exit codes for the MACquerade CLI.',
})
</script>

<template>
  <DocsLayout>
    <h1 class="text-3xl font-bold">Global Flags</h1>
    <div class="mt-6 overflow-x-auto rounded-xl border border-[var(--border)]">
      <table class="w-full text-left text-sm">
        <thead class="bg-[var(--card-2)] text-[var(--muted)]">
          <tr><th class="px-4 py-3 font-medium">Flag</th><th class="px-4 py-3 font-medium">Description</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in flags" :key="f.flag" class="border-t border-[var(--border)]">
            <td class="whitespace-nowrap px-4 py-3 font-mono text-[var(--accent)]">{{ f.flag }}</td>
            <td class="px-4 py-3 text-[var(--muted)]">{{ f.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2 class="mt-12 text-2xl font-bold">Exit Codes</h2>
    <div class="mt-6 overflow-x-auto rounded-xl border border-[var(--border)]">
      <table class="w-full text-left text-sm">
        <thead class="bg-[var(--card-2)] text-[var(--muted)]">
          <tr><th class="px-4 py-3 font-medium">Code</th><th class="px-4 py-3 font-medium">Meaning</th></tr>
        </thead>
        <tbody>
          <tr v-for="e in exitCodes" :key="e.code" class="border-t border-[var(--border)]">
            <td class="px-4 py-3 font-mono text-[var(--accent)]">{{ e.code }}</td>
            <td class="px-4 py-3 text-[var(--muted)]">{{ e.meaning }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </DocsLayout>
</template>
