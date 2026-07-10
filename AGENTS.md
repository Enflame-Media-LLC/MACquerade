# Repository Guidance

This repo is `MACquerade`, a Node.js CLI/library for changing MAC (Media Access Control) addresses on macOS, Linux, and Windows. It is the TheJACKedViking TypeScript rewrite of the original `spoof` utility.

Use `CLAUDE.md` as the companion source of project guidance when it is present. Keep this file aligned with `CLAUDE.md` when tooling, commands, or review policy changes.

## Runtime and Tooling

- Runtime: Node.js `>=24` per `package.json`. CI also runs Node 22 for compatibility.
- Package manager: Yarn 4.14.1 via Corepack (`packageManager: yarn@4.14.1`).
- Module system: ESM — ECMAScript Modules (`"type": "module"`).
- Source: TypeScript in `src/`; built output and declarations go to `dist/`.
- CLI binary: `dist/cli.js`, installed as `macquerade`; `spoof` is retained as a compatibility alias.
- Build stack: `tsup` bundles ESM for Node 24, then `tsc --emitDeclarationOnly` emits declarations.
- Lint: Oxlint. Correctness rules are errors; suspicious rules are warnings; style, pedantic, nursery, and restriction categories are off.
- Tests: Vitest in Node environment. Test files match `test/**/*.test.ts` and `test/**/*.test.js`.
- Coverage: Vitest V8 coverage, reported as text and HTML. Coverage includes `src/**/*.ts` and excludes `src/types.ts`, `src/cli.ts`, and declaration files.
- Mutation testing: Stryker with Vitest runner; reports are written to `reports/mutation/mutation.html`.

## Common Commands

```bash
yarn install           # Install dependencies
yarn build             # tsup + tsc --emitDeclarationOnly
yarn start             # Run node dist/cli.js
yarn lint              # Run oxlint .
yarn lint:fix          # Run oxlint --fix .
yarn typecheck         # Run tsc --noEmit
yarn test              # Build + lint + vitest run
yarn test:only         # Run vitest without building first
yarn test:watch        # Run vitest watch mode
yarn test:coverage     # Build + vitest run --coverage
yarn coverage          # Alias for build + coverage
yarn validate          # Build + lint + tests
yarn validate:strict   # Typecheck + build + lint + tests
yarn mutation          # Run Stryker mutation testing
yarn update-oui        # Regenerate src/data/oui.json from IEEE (Institute of Electrical and Electronics Engineers) data
```

For a single test file, run:

```bash
npx vitest run test/oui.test.ts
```

## Manual CLI Checks

Build before manual CLI testing:

```bash
yarn build
node dist/cli.js --help
node dist/cli.js list
node dist/cli.js lookup 00:03:93:12:34:56
node dist/cli.js vendors apple
```

MAC-changing commands such as `sudo node dist/cli.js randomize en0` require elevated privileges and can affect the active network connection. Do not run privileged MAC spoofing commands unless the user explicitly asks for them.

## Architecture Notes

- `src/index.ts` exposes the library API: async interface discovery and MAC changes, deprecated sync compatibility functions, MAC normalization/randomization utilities, and OUI (Organizationally Unique Identifier) exports.
- `src/cli.ts` is the command-line entry point. It uses `minimist` and supports `list`/`ls`, `set`, `randomize`, `reset`, `normalize`, `lookup`, `vendors`, `version`, and `help`.
- `src/oui.ts` handles OUI vendor lookup, fuzzy vendor search, vendor-specific random MAC generation, and database stats from `src/data/oui.json`.
- `src/types.ts` contains shared types such as `NetworkInterface`, `AsyncOptions`, `RandomFunction`, and `Platform`.
- `scripts/update-oui.ts` regenerates OUI data. `scripts/mac-randomize.sh` is the standalone cross-platform installer/randomizer used by the README quick-start flow; it supports macOS/Linux via Homebrew and Windows Bash environments via Chocolatey.
- Platform behavior branches on `process.platform`: macOS uses `networksetup`/`airport`, Linux prefers `ip` with `ifconfig` fallback or `--prefer-ifconfig`, and Windows uses `ipconfig` plus registry access through `winreg`.

## Style

- Keep existing TypeScript style: no semicolons, 2-space indentation, single quotes.
- Preserve ESM imports/exports and strict TypeScript settings.
- Avoid unrelated formatting churn. Oxlint intentionally does not enforce broad style categories.
- Tests usually import public behavior or compiled CLI behavior; CLI integration tests exercise the built binary.

## Review and Verification Policy

- Before modifying a function, class, method, or exported API, run GitNexus impact analysis as described below and report the blast radius.
- For normal code changes, run the smallest useful verification first.
- Run `yarn validate:strict` when the change is broad, touches release/package behavior, or affects public API/CLI behavior.
- For PR readiness, ensure at least `yarn lint`, `yarn typecheck`, and `yarn test:only` pass locally. This mirrors the CI job steps.
- CI runs on pull requests and pushes to `master`/`main` across Node 22 and 24 on Ubuntu, macOS, and Windows.
- Release tags `v*` run `yarn validate:strict` before `yarn npm publish --provenance --access public`.
- Security/code scanning workflows include CodeQL, OSV (Open Source Vulnerabilities) Scanner, OSSAR (Open Source Static Analysis Runner), and an ESLint SARIF workflow. Treat new security scanner findings as review blockers unless explicitly triaged.
- For code review, prioritize behavioral regressions, platform-specific breakage, CLI/API contract changes, missing tests, and release/build risks before style comments.
- When changing MAC spoofing logic, review all affected platforms and include tests or manual validation notes for platform branches that cannot be exercised locally.

<!-- gitnexus:start -->
## GitNexus — Code Intelligence

This project is indexed by GitNexus as **MACquerade** (309 symbols, 694 relationships, 26 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/MACquerade/context` | Codebase overview, check index freshness |
| `gitnexus://repo/MACquerade/clusters` | All functional areas |
| `gitnexus://repo/MACquerade/processes` | All execution flows |
| `gitnexus://repo/MACquerade/process/{name}` | Step-by-step execution trace |

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
