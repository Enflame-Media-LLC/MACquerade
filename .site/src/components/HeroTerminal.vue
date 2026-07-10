<script setup lang="ts">
import { onMounted } from 'vue'
import { useTypewriter } from '@/composables/useTypewriter'
import { useMacMorph } from '@/composables/useMacMorph'
import TerminalWindow from './TerminalWindow.vue'

const { output, done, start } = useTypewriter({ text: 'sudo macquerade randomize en0', speed: 55 })
const { mac, morph } = useMacMorph({ steps: 14, interval: 70 })

onMounted(() => {
  start()
  const stop = setInterval(() => {
    if (done.value) {
      clearInterval(stop)
      morph()
    }
  }, 100)
})
</script>

<template>
  <TerminalWindow title="zsh — macquerade">
    <div class="whitespace-pre">
      <span class="text-[var(--term)]">$</span>
      <span class="text-[var(--fg)]"> {{ output }}</span><span class="animate-pulse">▋</span>
    </div>
    <div v-if="done" class="mt-2 text-[var(--muted)]">
      Randomizing "Wi-Fi" on device "en0"…
    </div>
    <div v-if="done" class="mt-1 whitespace-pre">
      <span class="text-[var(--fg)]">New MAC: </span>
      <span class="text-[var(--accent)]">{{ mac }}</span>
    </div>
  </TerminalWindow>
</template>
