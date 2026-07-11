import { ref, type Ref } from 'vue'

interface Options {
  text: string
  speed?: number
}

export function useTypewriter(options: Options): {
  output: Ref<string>
  done: Ref<boolean>
  start: () => void
  stop: () => void
  reset: () => void
} {
  const speed = options.speed ?? 45
  const output = ref('')
  const done = ref(false)
  let index = 0
  let timer: ReturnType<typeof setInterval> | null = null

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const start = () => {
    stop()
    timer = setInterval(() => {
      if (index >= options.text.length) {
        done.value = true
        stop()
        return
      }
      output.value += options.text[index]
      index += 1
      if (index >= options.text.length) {
        done.value = true
        stop()
      }
    }, speed)
  }

  const reset = () => {
    stop()
    index = 0
    output.value = ''
    done.value = false
  }

  return { output, done, start, stop, reset }
}
