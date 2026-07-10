import { ref, type Ref } from 'vue'

let rng: () => number = Math.random

export function setMacRng(fn: () => number): void {
  rng = fn
}

function octet(): string {
  return Math.floor(rng() * 256)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()
}

function randomMac(): string {
  return Array.from({ length: 6 }, octet).join(':')
}

interface Options {
  steps?: number
  interval?: number
}

export function useMacMorph(options: Options = {}): {
  mac: Ref<string>
  morph: () => void
} {
  const steps = options.steps ?? 12
  const interval = options.interval ?? 60
  const mac = ref(randomMac())
  let timer: ReturnType<typeof setInterval> | null = null

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const morph = () => {
    stop()
    let count = 0
    timer = setInterval(() => {
      count += 1
      mac.value = randomMac()
      if (count >= steps) {
        mac.value = randomMac()
        stop()
      }
    }, interval)
  }

  return { mac, morph }
}
