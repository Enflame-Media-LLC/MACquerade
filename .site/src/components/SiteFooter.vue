<script setup lang="ts">
const GITHUB = 'https://github.com/TheJACKedViking/spoof'
const YEAR = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-[var(--border)] bg-[var(--card)]">
    <div class="mx-auto max-w-6xl px-4 py-10 text-sm text-[var(--muted)] sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Maintained by
          <a href="https://github.com/TheJACKedViking" class="text-[var(--accent)]">TheJACKedViking</a>.
          Inspired by
          <a href="https://feross.org" class="text-[var(--accent)]">Feross Aboukhadijeh</a>
          (SpoofMAC / spoof).
        </p>
        <p>MIT License &middot; &copy; {{ YEAR }}</p>
      </div>
      <div class="mt-4 flex gap-6">
        <a :href="GITHUB" class="hover:text-[var(--fg)]">GitHub</a>
        <a href="https://npmjs.org/package/macquerade" class="hover:text-[var(--fg)]">npm</a>
      </div>
    </div>
  </footer>
</template>
