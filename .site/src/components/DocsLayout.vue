<script setup lang="ts">
import { ref } from 'vue'
import { Menu } from 'lucide-vue-next'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { docsNav } from '@/data/commands'

const open = ref(false)
</script>

<template>
  <div class="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6">
    <aside class="hidden w-52 shrink-0 md:block">
      <nav class="sticky top-20 flex flex-col gap-1">
        <RouterLink
          v-for="item in docsNav"
          :key="item.to"
          :to="item.to"
          class="rounded-md px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--card-2)] hover:text-[var(--fg)]"
          active-class="bg-[var(--card-2)] text-[var(--fg)]"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <div class="min-w-0 flex-1">
      <div class="mb-6 md:hidden">
        <DialogRoot v-model:open="open">
          <DialogTrigger
            class="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]"
          >
            <Menu class="size-4" /> Docs menu
          </DialogTrigger>
          <DialogPortal>
            <DialogOverlay class="fixed inset-0 z-50 bg-black/60" />
            <DialogContent class="fixed left-0 top-0 z-50 h-full w-64 border-r border-[var(--border)] bg-[var(--card)] p-6">
              <DialogTitle class="sr-only">Docs menu</DialogTitle>
              <DialogDescription class="sr-only">Documentation navigation links</DialogDescription>
              <nav class="flex flex-col gap-2">
                <RouterLink
                  v-for="item in docsNav"
                  :key="item.to"
                  :to="item.to"
                  class="text-[var(--fg)]"
                  @click="open = false"
                >
                  {{ item.label }}
                </RouterLink>
                <DialogClose class="mt-4 text-left text-sm text-[var(--muted)]">Close</DialogClose>
              </nav>
            </DialogContent>
          </DialogPortal>
        </DialogRoot>
      </div>
      <article class="max-w-3xl">
        <slot />
      </article>
    </div>
  </div>
</template>
