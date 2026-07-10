<script setup lang="ts">
import CopyButton from './CopyButton.vue'

defineProps<{ title: string; command?: string; copyText?: string }>()
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl shadow-black/40"
  >
    <div
      class="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--card-2)] px-4 py-2.5"
    >
      <span class="flex gap-1.5">
        <span class="size-3 rounded-full bg-[#ff5f57]" />
        <span class="size-3 rounded-full bg-[#febc2e]" />
        <span class="size-3 rounded-full bg-[#28c840]" />
      </span>
      <span class="ml-2 font-mono text-xs text-[var(--muted)]">{{ title }}</span>
      <CopyButton v-if="copyText" :text="copyText" class="ml-auto" />
    </div>
    <div class="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
      <div v-if="command" class="mb-2 whitespace-pre">
        <span class="text-[var(--term)]">$</span>
        <span class="text-[var(--fg)]"> {{ command }}</span>
      </div>
      <div class="whitespace-pre text-[var(--muted)]">
        <slot />
      </div>
    </div>
  </div>
</template>
