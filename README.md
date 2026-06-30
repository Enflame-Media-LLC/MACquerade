# MACquerade

[![npm][npm-image]][npm-url]
[![downloads][downloads-image]][downloads-url]

[npm-image]: https://img.shields.io/npm/v/macquerade.svg
[npm-url]: https://npmjs.org/package/macquerade
[downloads-image]: https://img.shields.io/npm/dm/macquerade.svg
[downloads-url]: https://npmjs.org/package/macquerade

### Easily spoof your MAC address on macOS, Linux & Windows

A modern, TypeScript Node.js CLI for changing MAC addresses. Maintained by
**[TheJACKedViking](https://github.com/TheJACKedViking)** — credit and inspiration to
**[Feross Aboukhadijeh](https://feross.org)**, author of the original
[`SpoofMAC`](https://github.com/feross/SpoofMAC) (Python) and
[`spoof`](https://github.com/feross/spoof) (Node.js) projects.

![anonymous](img/img.png)

## Why?

Changing your MAC address on macOS is harder than it should be — the Wi-Fi card needs
to be disassociated from any connected network before the change takes effect. `MACquerade`
handles all of that for you in a single command. It also works on Linux and Windows.

---

## Quick Start (macOS one-liner)

The fastest way to randomize your MAC on macOS. This installs Homebrew + Node.js if
needed, clones and builds `MACquerade`, then randomizes the MAC of an interface you pick:

```bash
curl -fsSL https://raw.githubusercontent.com/TheJACKedViking/spoof/main/scripts/mac-randomize.sh | bash
```

> The script is interactive — it will prompt you to choose a network interface and may
> ask for your `sudo` password to apply the change. Read
> [`scripts/mac-randomize.sh`](scripts/mac-randomize.sh) before running, as with any
> piped installer.

---

## Detailed Install

For everyday use (any platform), install via npm or yarn:

### 1. Install Node.js 24+

MACquerade requires **Node.js >= 24**. Install from [nodejs.org](https://nodejs.org/) or
via your preferred version manager (nvm, fnm, volta, Homebrew, etc.).

### 2. Install MACquerade globally

```bash
npm install -g macquerade
# or
yarn global add macquerade
```

You should now have a `macquerade` command on your `PATH`:

```bash
macquerade --help
macquerade version
```

### 3. (Optional) Run without installing

```bash
npx macquerade list
sudo npx macquerade randomize en0
```

### 4. (Developers) Install from source

```bash
git clone https://github.com/TheJACKedViking/spoof.git
cd spoof
yarn install
yarn build
node dist/cli.js --help
```

---

## Platform Notes

- **macOS** — uses `networksetup` and the `airport` binary. Requires `sudo` for changes.
- **Linux** — uses `ip` (iproute2) by default and falls back to `ifconfig`. Pass
  `--prefer-ifconfig` to force the legacy tool. Requires `sudo` for changes.
- **Windows** — uses `ipconfig` and the Windows Registry (via `winreg`). Must be run
  from an **Administrator** shell. Changes to MAC may require disabling/re-enabling
  the adapter (handled automatically where possible).

---

## Full Command List

You can always view up-to-date usage with `macquerade --help`.

### `macquerade list` (alias: `ls`)

List all available network interfaces.

```bash
macquerade list
- "Ethernet" on device "en0" with MAC address 70:56:51:BE:B3:00
- "Wi-Fi"    on device "en1" with MAC address 70:56:51:BE:B3:01 currently set to 70:56:51:BE:B3:02
- "Bluetooth PAN" on device "en2"
```

Filter to wireless interfaces only:

```bash
macquerade list --wifi
```

### `macquerade set <mac> <devices...>` *(requires root/admin)*

Set a specific MAC address on one or more devices:

```bash
sudo macquerade set 00:11:22:33:44:55 en0
```

### `macquerade randomize <devices...>` *(requires root/admin)*

Set a random MAC address. Accepts either the device name (`en0`) or the hardware port
name (`wi-fi`).

```bash
sudo macquerade randomize en0
sudo macquerade randomize wi-fi
```

Set the locally-administered bit on the randomized address:

```bash
sudo macquerade randomize en0 --local
```

Randomize using a specific vendor's OUI prefix:

```bash
sudo macquerade randomize en0 --vendor=apple
sudo macquerade randomize en0 --vendor=samsung
sudo macquerade randomize en0 --vendor=intel
```

### `macquerade reset <devices...>` *(requires root/admin)*

Restore the device's burned-in / hardware MAC address (when readable):

```bash
sudo macquerade reset wi-fi
```

> On macOS, restarting the computer also resets the MAC — macOS does not persist
> changes across reboots.

### `macquerade normalize <mac>`

Normalize a MAC address into the canonical colon-separated, uppercase form:

```bash
macquerade normalize 0003.9312.3456
# 00:03:93:12:34:56
```

### `macquerade lookup <mac>`

Look up the vendor for a MAC address or OUI prefix:

```bash
macquerade lookup 00:03:93:12:34:56
# Apple, Inc.
```

### `macquerade vendors [<query>]`

Search the bundled OUI vendor database (fuzzy match), or show database stats with no
query:

```bash
macquerade vendors apple
# 00:03:93 - Apple, Inc.
# 00:05:02 - Apple, Inc.
# ...

macquerade vendors
# OUI Database: 1691 prefixes from 98 vendors
```

### `macquerade version`

Print the installed package version.

### `macquerade help`

Show the help screen.

---

## Global Flags

| Flag | Description |
|------|-------------|
| `--wifi` | Only show wireless interfaces (with `list`) |
| `--local` | Set the locally-administered bit on randomized MACs |
| `--vendor=<name>` | Randomize using a specific vendor's OUI prefix |
| `--prefer-ifconfig` | On Linux, force `ifconfig` instead of `ip` |
| `--format=json` | Emit structured JSON (for scripts / automation) |
| `--dry-run`, `-n` | Show what would happen without making changes |
| `--verbose`, `-v` | Detailed diagnostic logging |
| `--quiet`, `-q` | Suppress non-essential output |
| `--timeout=<ms>` | Per-operation timeout in milliseconds (default 30000) |
| `--version` | Print package version |

**Exit codes**

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error |
| `2` | Dry-run would fail (e.g. device not found) |

---

## Updating the OUI database

The bundled vendor database (`src/data/oui.json`) can be refreshed from the IEEE
registry:

```bash
yarn update-oui
```

---

## Persisting MAC changes across reboots

If you want randomized MACs that persist between restarts on macOS, the original
[Python SpoofMAC](https://github.com/feross/SpoofMAC) project has a launchd recipe —
see its
[run-automatically-at-startup](https://github.com/feross/SpoofMAC#optional-run-automatically-at-startup)
guide.

---

## Development

```bash
yarn install
yarn build              # tsup + tsc --emitDeclarationOnly
yarn test               # build + lint + vitest
yarn test:only          # vitest only
yarn test:watch         # watch mode
yarn coverage           # vitest run --coverage
yarn lint               # oxlint
yarn lint:fix           # oxlint --fix
yarn typecheck          # tsc --noEmit
yarn validate           # build + lint + tests
yarn validate:strict    # typecheck + build + lint + tests
yarn mutation           # Stryker mutation testing
```

### Mutation Testing

This project uses [Stryker](https://stryker-mutator.io/) to verify test effectiveness:

```bash
yarn mutation
```

Reports are written to `reports/mutation/mutation.html`.

---

## Credits

- **Maintainer / developer:** [TheJACKedViking](https://github.com/TheJACKedViking)
- **Inspired by / credit to:** [Feross Aboukhadijeh](https://feross.org) — original
  author of [`SpoofMAC`](https://github.com/feross/SpoofMAC) (Python) and the original
  Node [`spoof`](https://github.com/feross/spoof) package this fork builds on.

## License

MIT.
