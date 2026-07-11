<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{ icon: Component; title: string; description: string }>()
</script>

<template>
  <div
    class="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition hover:border-[var(--accent)]/60 hover:shadow-lg hover:shadow-[var(--accent-2)]/10"
  >
    <div
      class="mb-4 inline-flex rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-2.5 text-[var(--accent)]"
    >
      <component :is="icon" class="size-5" />
    </div>
    <h3 class="mb-1.5 font-semibold text-[var(--fg)]">{{ title }}</h3>
    <p class="text-sm leading-relaxed text-[var(--muted)]">{{ description }}</p>
  </div>
</template>
