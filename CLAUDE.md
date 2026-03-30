# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spoof is a Node.js CLI tool for changing MAC addresses on macOS, Linux, and Windows. It's a port of the Python SpoofMAC utility by Feross Aboukhadijeh.

Requires Node.js 24+ and TypeScript 6.

## Commands

### Development
```bash
yarn install           # Install dependencies
yarn build             # Build JS (tsup) + type declarations (tsc --emitDeclarationOnly)
yarn test              # Build + lint (oxlint) + test (vitest)
yarn test:only         # Run tests without building first
yarn test:watch        # Run tests in watch mode
yarn test:coverage     # Build + run tests with coverage
yarn lint              # Run oxlint only
yarn lint:fix          # Auto-fix lint issues
yarn typecheck         # Run TypeScript type checking (tsc --noEmit)
yarn validate          # Build + lint + tests
yarn validate:strict   # Typecheck + build + lint + tests
yarn mutation          # Run Stryker mutation testing
yarn update-oui       # Regenerate src/data/oui.json from IEEE data
```

### Running a Single Test
```bash
npx vitest run test/oui.test.ts
```

### Manual Testing
```bash
yarn build                                  # Must build first
node dist/cli.js list                       # List network interfaces
node dist/cli.js --help                     # Show help
sudo node dist/cli.js randomize en0         # Test MAC spoofing (requires root)
node dist/cli.js lookup 00:03:93:12:34:56   # Look up vendor for MAC
node dist/cli.js vendors apple              # Search OUI vendor database
```

## Architecture

TypeScript source lives in `src/`, built output goes to `dist/`.

- **`src/index.ts`** - Library exposing the core API:
  - Async API (primary): `findInterfacesAsync()`, `findInterfaceAsync()`, `setInterfaceMACAsync()`, `getInterfaceMACAsync()`
  - Sync API (deprecated, backward compat): `findInterfaces()`, `findInterface()`, `setInterfaceMAC()`
  - Utilities: `normalize(mac)`, `randomize(localAdmin)`, `setPreferIfconfig()`, `setRandomFunction()`
  - Re-exports OUI functions and all types

- **`src/cli.ts`** - CLI entry point. Parses args with minimist, supports `list`, `set`, `randomize`, `reset`, `normalize`, `lookup`, `vendors` commands. Supports `--format=json`, `--dry-run`, `--verbose`, `--quiet`, `--vendor`, `--timeout` flags.

- **`src/oui.ts`** - OUI (Organizationally Unique Identifier) vendor database module:
  - `lookup(mac)` - Look up vendor by MAC address or OUI prefix
  - `searchVendors(query)` - Fuzzy search vendors by name (Levenshtein distance)
  - `randomizeAsVendor(vendorQuery)` - Generate random MAC with a specific vendor's OUI prefix
  - `getVendorNames()`, `getPrefixesForVendor()`, `getDatabaseStats()`
  - Data loaded from `src/data/oui.json` (copied to `dist/data/` during build)

- **`src/types.ts`** - Shared type definitions: `NetworkInterface`, `AsyncOptions`, `RandomFunction`, `Platform`

- **`scripts/mac-randomize.sh`** - Standalone macOS install script that clones, builds, and runs spoof to randomize a MAC address (installs Homebrew/Node.js if needed)

### Build Process

Uses `tsup` to bundle TypeScript to ESM JavaScript (targeting Node 24), then `tsc --emitDeclarationOnly` for `.d.ts` files. The `tsup.config.ts` also copies `src/data/oui.json` to `dist/data/` on success.

### Platform Detection

The code uses `process.platform` to branch between:
- `darwin` (macOS): Uses `networksetup` and `airport` binary
- `linux`: Uses `ip` (iproute2) by default, falls back to `ifconfig` (or `--prefer-ifconfig` flag)
- `win32` (Windows): Uses `ipconfig` and Windows Registry via `winreg`

### Code Style

Uses [Oxlint](https://oxc.rs/docs/guide/usage/linter) for fast linting and TypeScript for type checking. No semicolons, 2-space indentation, single quotes. ESM module format (`"type": "module"` in package.json).
