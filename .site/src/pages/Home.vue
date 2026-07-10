<script setup lang="ts">
import {
  Laptop,
  Zap,
  Database,
  ShieldCheck,
  Braces,
  FileCode,
  Apple,
  Terminal,
  MonitorSmartphone,
} from 'lucide-vue-next'
import HeroTerminal from '@/components/HeroTerminal.vue'
import FeatureCard from '@/components/FeatureCard.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
import CopyButton from '@/components/CopyButton.vue'
import MaskLogo from '@/components/MaskLogo.vue'

const INSTALL = 'npm install -g macquerade'
const ONELINER =
  'curl -fsSL https://raw.githubusercontent.com/TheJACKedViking/spoof/main/scripts/mac-randomize.sh | bash'

const features = [
  { icon: Laptop, title: 'Cross-platform', description: 'One CLI for macOS, Linux, and Windows — with the platform quirks handled for you.' },
  { icon: Zap, title: 'One-command install', description: 'Install globally with npm or run instantly with npx. No config, no ceremony.' },
  { icon: Database, title: 'Vendor spoofing', description: 'Bundled OUI database — 1691 prefixes from 98 vendors — to masquerade as any vendor.' },
  { icon: ShieldCheck, title: 'Dry-run safety', description: 'Preview every change with --dry-run before touching a single interface.' },
  { icon: Braces, title: 'JSON output', description: 'Machine-readable --format=json for scripts and automation pipelines.' },
  { icon: FileCode, title: 'TypeScript & ESM', description: 'A modern, fully typed rewrite shipping native ECMAScript modules.' },
]

const showcase = [
  { title: 'zsh — list', command: 'macquerade list', body: '- "Wi-Fi" on device "en1" with MAC address 70:56:51:BE:B3:01' },
  { title: 'zsh — vendor', command: 'sudo macquerade randomize en0 --vendor=apple', body: 'New MAC: 00:03:93:A1:B2:C3  (Apple, Inc.)' },
  { title: 'zsh — lookup', command: 'macquerade lookup 00:03:93:12:34:56', body: 'Apple, Inc.' },
  { title: 'zsh — vendors', command: 'macquerade vendors', body: 'OUI Database: 1691 prefixes from 98 vendors' },
]

const platforms = [
  { icon: Apple, name: 'macOS', note: 'Uses networksetup and the airport binary. Requires sudo for changes.' },
  { icon: Terminal, name: 'Linux', note: 'Uses ip (iproute2), falls back to ifconfig. Pass --prefer-ifconfig to force it.' },
  { icon: MonitorSmartphone, name: 'Windows', note: 'Uses ipconfig and the Windows Registry. Run from an Administrator shell.' },
]
</script>

<template>
  <main>
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div
        class="pointer-events-none absolute inset-0 opacity-60"
        style="background: radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--accent-2) 30%, transparent), transparent 70%);"
      />
      <div class="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div>
          <div class="mb-6 flex items-center gap-3">
            <MaskLogo class="h-10 w-16" />
            <span class="rounded-full border border-[var(--border)] bg-[var(--card-2)] px-3 py-1 text-xs text-[var(--muted)]">
              macOS · Linux · Windows
            </span>
          </div>
          <h1 class="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span class="text-[var(--fg)]">MAC</span><span class="text-[var(--accent)]">querade</span>
          </h1>
          <p class="mt-4 max-w-md text-lg text-[var(--muted)]">
            Every device deserves a disguise. Spoof your MAC address in a single command.
          </p>
          <div class="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div class="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 font-mono text-sm">
              <span class="text-[var(--term)]">$</span>
              <span class="text-[var(--fg)]">{{ INSTALL }}</span>
              <CopyButton :text="INSTALL" class="ml-2" />
            </div>
            <RouterLink
              to="/docs"
              class="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Read the docs
            </RouterLink>
          </div>
        </div>
        <ClientOnly>
          <HeroTerminal />
        </ClientOnly>
      </div>
    </section>

    <!-- Features -->
    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 class="mb-10 text-center text-2xl font-bold sm:text-3xl">Built for disappearing acts</h2>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          v-for="f in features"
          :key="f.title"
          :icon="f.icon"
          :title="f.title"
          :description="f.description"
        />
      </div>
    </section>

    <!-- Command showcase -->
    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 class="mb-10 text-center text-2xl font-bold sm:text-3xl">See it in action</h2>
      <div class="grid gap-6 md:grid-cols-2">
        <TerminalWindow
          v-for="s in showcase"
          :key="s.title"
          :title="s.title"
          :command="s.command"
          :copy-text="s.command"
        >{{ s.body }}</TerminalWindow>
      </div>
    </section>

    <!-- Platform strip -->
    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div class="grid gap-6 sm:grid-cols-3">
        <div
          v-for="p in platforms"
          :key="p.name"
          class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
        >
          <component :is="p.icon" class="mb-3 size-6 text-[var(--accent)]" />
          <h3 class="mb-1.5 font-semibold">{{ p.name }}</h3>
          <p class="text-sm text-[var(--muted)]">{{ p.note }}</p>
        </div>
      </div>
    </section>

    <!-- Quick start one-liner -->
    <section class="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div class="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <h2 class="text-2xl font-bold">macOS one-liner</h2>
        <p class="mt-2 text-sm text-[var(--muted)]">
          Installs Homebrew + Node.js if needed, then builds and randomizes an interface you pick.
        </p>
        <div class="mt-5">
          <TerminalWindow title="quick start" :copy-text="ONELINER">{{ ONELINER }}</TerminalWindow>
        </div>
        <p class="mt-4 text-xs text-[var(--muted)]">
          The script is interactive and may ask for your sudo password. Read it before running, as with any piped installer.
        </p>
      </div>
    </section>
  </main>
</template>
