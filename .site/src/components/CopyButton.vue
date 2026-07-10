<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'

const props = defineProps<{ text: string; label?: string }>()
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  try {
    await navigator.clipboard.writeText(props.text)
    copied.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <button
    type="button"
    :data-copied="copied ? 'true' : 'false'"
    :aria-label="label ?? 'Copy to clipboard'"
    class="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card-2)] px-2 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--fg)] hover:border-[var(--accent)]"
    @click="copy"
  >
    <component :is="copied ? Check : Copy" class="size-3.5" :class="copied ? 'text-[var(--term)]' : ''" />
    <span>{{ copied ? 'Copied' : 'Copy' }}</span>
  </button>
</template>
