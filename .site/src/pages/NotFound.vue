<script setup lang="ts">
import { usePageMeta } from '@/composables/usePageMeta'
usePageMeta({ title: 'Not Found', description: 'The page you are looking for does not exist.' })
</script>

<template>
  <main class="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
    <p class="font-mono text-6xl font-bold text-[var(--accent)]">404</p>
    <h1 class="mt-4 text-2xl font-semibold">Page not found</h1>
    <p class="mt-2 text-[var(--muted)]">That address doesn't resolve. Even a spoofed one.</p>
    <RouterLink to="/" class="mt-8 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90">Back home</RouterLink>
  </main>
</template>
