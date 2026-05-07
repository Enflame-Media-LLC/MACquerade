# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the five code-review findings around Windows adapter selection, shell-script eval safety, missing CLI operands, Linux current-MAC lookup, and validation coverage.

**Architecture:** Keep behavior changes in the existing modules. Add targeted regression tests first, then implement small helpers in `src/cli.ts`, reuse the existing Linux-specific current-MAC helpers in `src/index.ts`, harden Windows registry matching by tying the key to the requested adapter, and replace the script's `eval` parsing with a temp JSON file plus Node-selected scalar output.

**Tech Stack:** TypeScript, Node.js 24+, Vitest, Bash, existing `winreg` and child-process wrappers.

---

### Task 1: Add Regression Tests

**Files:**
- Modify: `test/cli.test.ts`
- Modify: `test/findInterfaces.test.ts`
- Modify: `test/setInterfaceMAC.test.ts`
- Create: `test/mac-randomize-script.test.ts`

- [ ] **Step 1: Add CLI operand tests**

Add tests asserting these commands exit non-zero and return JSON error objects:

```typescript
runCLI(['set', '00:11:22:33:44:55', '--format=json'])
runCLI(['randomize', '--format=json'])
runCLI(['reset', '--format=json'])
runCLI(['normalize', '--format=json'])
```

- [ ] **Step 2: Add Linux current-MAC test**

In `test/findInterfaces.test.ts`, mock Linux with `ip` available and `ifconfig` unavailable, then assert `getInterfaceMACAsync('eth0')` returns the `ip link show eth0` MAC.

- [ ] **Step 3: Add Windows registry matching test**

In `test/setInterfaceMAC.test.ts`, mock `winreg` keys/values so only the second adapter matches the requested device, then assert `NetworkAddress` is set on the matching key only.

- [ ] **Step 4: Add shell-script eval regression test**

In `test/mac-randomize-script.test.ts`, read `scripts/mac-randomize.sh` and assert it no longer contains `eval "$(` in the interface parsing block.

- [ ] **Step 5: Run focused tests and verify red**

Run:

```bash
yarn test:only test/cli.test.ts test/findInterfaces.test.ts test/setInterfaceMAC.test.ts test/mac-randomize-script.test.ts
```

Expected before implementation: new tests fail for the reviewed behaviors.

### Task 2: Fix CLI Operand Validation

**Files:**
- Modify: `src/cli.ts`
- Test: `test/cli.test.ts`

- [ ] **Step 1: Add argument helpers**

Add helpers near command dispatch:

```typescript
function requireArg(value: string | undefined, message: string): string {
  if (!value) throw new Error(message)
  return value
}

function requireDevices(devices: string[], commandName: string): void {
  if (devices.length === 0) {
    throw new Error(`Please provide at least one device for ${commandName}`)
  }
}
```

- [ ] **Step 2: Use helpers in `set`, `randomize`, `reset`, and `normalize`**

Validate `mac` before `set()` and `normalizeCmd()`, and validate device arrays before mutation loops.

- [ ] **Step 3: Run CLI tests**

Run:

```bash
yarn test:only test/cli.test.ts
```

Expected: CLI tests pass.

### Task 3: Fix Linux Current-MAC Lookup

**Files:**
- Modify: `src/index.ts`
- Test: `test/findInterfaces.test.ts`

- [ ] **Step 1: Route Linux through Linux-specific helper**

Change `getInterfaceMAC()` and `getInterfaceMACAsync()` so Linux uses `getInterfaceMACLinux()` / `getInterfaceMACLinuxAsync()` instead of direct `ifconfig`.

- [ ] **Step 2: Run interface tests**

Run:

```bash
yarn test:only test/findInterfaces.test.ts
```

Expected: interface tests pass.

### Task 4: Fix Windows Registry Adapter Matching

**Files:**
- Modify: `src/index.ts`
- Test: `test/setInterfaceMAC.test.ts`

- [ ] **Step 1: Match registry key values to requested device**

In `tryWindowsKeyAsync()`, require values such as `NetConnectionID`, `DriverDesc`, `AdapterModel`, `Name`, or `NetCfgInstanceId` to match the requested device/description before writing `NetworkAddress`.

- [ ] **Step 2: Throw when no adapter key matches**

After key iteration in `setInterfaceMACWin32Async()`, throw a clear error if no registry key was updated.

- [ ] **Step 3: Run MAC-setting tests**

Run:

```bash
yarn test:only test/setInterfaceMAC.test.ts
```

Expected: MAC-setting tests pass.

### Task 5: Remove Shell `eval` Parsing

**Files:**
- Modify: `scripts/mac-randomize.sh`
- Test: `test/mac-randomize-script.test.ts`

- [ ] **Step 1: Write interface JSON to a temp file**

Use `mktemp`, write `$interfaces_json` into it, and clean it up in the existing cleanup function.

- [ ] **Step 2: Populate arrays without `eval`**

Use a Node helper that prints `port<TAB>device<TAB>addr` rows, then parse rows with `while IFS=$'\t' read -r port device addr`.

- [ ] **Step 3: Run shell-script test**

Run:

```bash
yarn test:only test/mac-randomize-script.test.ts
```

Expected: shell-script test passes.

### Task 6: Review and Verify

**Files:**
- Review changed files only

- [ ] **Step 1: Review implementation against the five findings**

Check that every finding has a test and implementation change.

- [ ] **Step 2: Run full validation**

Run:

```bash
yarn validate:strict
```

Expected: build, typecheck, lint, and tests complete successfully.

- [ ] **Step 3: Run dependency audit**

Run:

```bash
yarn npm audit --all
```

Expected: no audit suggestions.

---

## Plan Review

- Spec coverage: all five reviewed items are mapped to one or more tasks.
- Placeholder scan: no TBD/placeholder steps remain.
- Type consistency: planned helper signatures match `minimist`'s current `string[]` command data and existing async API types.
- Correction from review: the shell script task avoids adding `jq`, because the project does not currently depend on it and the script already requires Node.
