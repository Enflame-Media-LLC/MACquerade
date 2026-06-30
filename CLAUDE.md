# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MACquerade is a Node.js CLI tool for changing MAC (Media Access Control) addresses on macOS, Linux, and Windows.
This is the **TheJACKedViking** fork — a TypeScript rewrite originally inspired by the
Python `SpoofMAC` / Node `spoof` utilities by Feross Aboukhadijeh.

- Runtime: Node.js >= 24
- Language: TypeScript 6 (ESM — ECMAScript Modules, `"type": "module"`)
- Package manager: Yarn 4 (`packageManager: yarn@4.14.1`)
- Bin: `dist/cli.js` (installed as the `macquerade` command; `spoof` is retained as a compatibility alias)

## Commands

### Development

```bash
yarn install           # Install dependencies
yarn build             # Build JS (tsup) + type declarations (tsc --emitDeclarationOnly)
yarn start             # Run the built CLI (node dist/cli.js)
yarn test              # Build + lint (oxlint) + test (vitest)
yarn test:only         # Run tests without building first
yarn test:watch        # Run tests in watch mode
yarn test:coverage     # Build + run tests with coverage
yarn coverage          # Alias for build + vitest run --coverage
yarn lint              # Run oxlint only
yarn lint:fix          # Auto-fix lint issues
yarn typecheck         # Type check only (tsc --noEmit)
yarn validate          # Build + lint + tests
yarn validate:strict   # Typecheck + build + lint + tests (runs in prepublishOnly/preversion)
yarn mutation          # Run Stryker mutation testing
yarn update-oui        # Regenerate src/data/oui.json from IEEE (Institute of Electrical and Electronics Engineers) data
yarn clean             # Remove node_modules, dist, .yarn/cache
yarn reinstall         # clean + install
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
node dist/cli.js vendors apple              # Search OUI (Organizationally Unique Identifier) vendor database
```

## Architecture

TypeScript source lives in `src/`, built output goes to `dist/`.

- **`src/index.ts`** - Library exposing the core API:
  - Async API (primary): `findInterfacesAsync()`, `findInterfaceAsync()`, `setInterfaceMACAsync()`, `getInterfaceMACAsync()`
  - Sync API (deprecated, backward compat): `findInterfaces()`, `findInterface()`, `setInterfaceMAC()`
  - Utilities: `normalize(mac)`, `randomize(localAdmin)`, `setPreferIfconfig()`, `setRandomFunction()`
  - Re-exports OUI functions and all types

- **`src/cli.ts`** - CLI entry point. Parses args with minimist, supports `list` (alias `ls`), `set`, `randomize`, `reset`, `normalize`, `lookup`, `vendors`, `version`, `help` commands. Supports `--wifi`, `--local`, `--vendor=<name>`, `--prefer-ifconfig`, `--format=json`, `--dry-run`/`-n`, `--verbose`/`-v`, `--quiet`/`-q`, `--timeout=<ms>`, `--version`. Exit codes: `0` success, `1` error, `2` dry-run would fail.

- **`src/oui.ts`** - OUI (Organizationally Unique Identifier) vendor database module:
  - `lookup(mac)` - Look up vendor by MAC address or OUI prefix
  - `searchVendors(query)` - Fuzzy search vendors by name (Levenshtein distance)
  - `randomizeAsVendor(vendorQuery)` - Generate random MAC with a specific vendor's OUI prefix
  - `getVendorNames()`, `getPrefixesForVendor()`, `getDatabaseStats()`
  - Data loaded from `src/data/oui.json` (copied to `dist/data/` during build)

- **`src/types.ts`** - Shared type definitions: `NetworkInterface`, `AsyncOptions`, `RandomFunction`, `Platform`

- **`scripts/mac-randomize.sh`** - Standalone cross-platform install script that clones, builds, and runs MACquerade to randomize MAC addresses. It installs or updates Homebrew/Node.js on macOS and Linux, and Chocolatey/Node.js on Windows Bash environments when needed. This is the script invoked by the README's Quick Start one-liner (`curl -fsSL .../scripts/mac-randomize.sh | bash`).

- **`scripts/update-oui.ts`** - Regenerates `src/data/oui.json` from IEEE's OUI registry (run via `yarn update-oui`).

### Build Process

Uses `tsup` to bundle TypeScript to ESM JavaScript (targeting Node 24), then `tsc --emitDeclarationOnly` for `.d.ts` files. The `tsup.config.ts` also copies `src/data/oui.json` to `dist/data/` on success.

### Platform Detection

The code uses `process.platform` to branch between:

- `darwin` (macOS): Uses `networksetup` and `airport` binary
- `linux`: Uses `ip` (iproute2) by default, falls back to `ifconfig` (or `--prefer-ifconfig` flag)
- `win32` (Windows): Uses `ipconfig` and Windows Registry via `winreg`

### Code Style

Uses [Oxlint](https://oxc.rs/docs/guide/usage/linter) for fast linting and TypeScript for type checking. No semicolons, 2-space indentation, single quotes. ESM module format (`"type": "module"` in package.json).

<!-- gitnexus:start -->
## GitNexus — Code Intelligence

This project is indexed by GitNexus as **spoof** (588 symbols, 1048 relationships, 49 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/spoof/context` | Codebase overview, check index freshness |
| `gitnexus://repo/spoof/clusters` | All functional areas |
| `gitnexus://repo/spoof/processes` | All execution flows |
| `gitnexus://repo/spoof/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
