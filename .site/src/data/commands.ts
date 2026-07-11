export interface CommandDoc {
  name: string
  signature: string
  description: string
  examples: string[]
}

export interface FlagDoc {
  flag: string
  description: string
}

export interface ExitCode {
  code: string
  meaning: string
}

export interface DocsNavItem {
  label: string
  to: string
}

export const commands: CommandDoc[] = [
  {
    name: 'list',
    signature: 'macquerade list (alias: ls)',
    description: 'List all available network interfaces. Add --wifi to show wireless only.',
    examples: ['macquerade list', 'macquerade list --wifi'],
  },
  {
    name: 'set',
    signature: 'macquerade set <mac> <devices...>',
    description: 'Set a specific MAC address on one or more devices. Requires root/admin.',
    examples: ['sudo macquerade set 00:11:22:33:44:55 en0'],
  },
  {
    name: 'randomize',
    signature: 'macquerade randomize <devices...>',
    description:
      'Set a random MAC address. Accepts the device name (en0) or hardware port (wi-fi). Requires root/admin.',
    examples: [
      'sudo macquerade randomize en0',
      'sudo macquerade randomize wi-fi',
      'sudo macquerade randomize en0 --local',
      'sudo macquerade randomize en0 --vendor=apple',
    ],
  },
  {
    name: 'reset',
    signature: 'macquerade reset <devices...>',
    description: "Restore the device's burned-in hardware MAC address. Requires root/admin.",
    examples: ['sudo macquerade reset wi-fi'],
  },
  {
    name: 'normalize',
    signature: 'macquerade normalize <mac>',
    description: 'Normalize a MAC address into canonical colon-separated uppercase form.',
    examples: ['macquerade normalize 0003.9312.3456'],
  },
  {
    name: 'lookup',
    signature: 'macquerade lookup <mac>',
    description: 'Look up the vendor for a MAC address or OUI prefix.',
    examples: ['macquerade lookup 00:03:93:12:34:56'],
  },
  {
    name: 'vendors',
    signature: 'macquerade vendors [<query>]',
    description: 'Search the bundled OUI vendor database (fuzzy), or show database stats.',
    examples: ['macquerade vendors apple', 'macquerade vendors'],
  },
]

export const flags: FlagDoc[] = [
  { flag: '--wifi', description: 'Only show wireless interfaces (with list)' },
  { flag: '--local', description: 'Set the locally-administered bit on randomized MACs' },
  { flag: '--vendor=<name>', description: "Randomize using a specific vendor's OUI prefix" },
  { flag: '--prefer-ifconfig', description: 'On Linux, force ifconfig instead of ip' },
  { flag: '--format=json', description: 'Emit structured JSON (for scripts / automation)' },
  { flag: '--dry-run, -n', description: 'Show what would happen without making changes' },
  { flag: '--verbose, -v', description: 'Detailed diagnostic logging' },
  { flag: '--quiet, -q', description: 'Suppress non-essential output' },
  { flag: '--timeout=<ms>', description: 'Per-operation timeout in milliseconds (default 30000)' },
  { flag: '--version', description: 'Print package version' },
]

export const exitCodes: ExitCode[] = [
  { code: '0', meaning: 'Success' },
  { code: '1', meaning: 'Error' },
  { code: '2', meaning: 'Dry-run would fail (e.g. device not found)' },
]

export const docsNav: DocsNavItem[] = [
  { label: 'Overview', to: '/docs' },
  { label: 'Commands', to: '/docs/commands' },
  { label: 'Flags & Exit Codes', to: '/docs/flags' },
  { label: 'Install', to: '/docs/install' },
  { label: 'Platforms', to: '/docs/platforms' },
]
