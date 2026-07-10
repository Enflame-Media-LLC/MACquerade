# MACquerade Worktree Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the MACquerade primary checkout and its linked Codacy worktree to the approved paths while preserving Git state and updating every live development-tool registration.

**Architecture:** Perform the migration in reversible phases: establish a verified baseline, prepare the tracked ignore rule, unregister the corrupt old GitNexus index, move the linked worktree with Git, rename the primary checkout, repair Git metadata, update local and user-level configuration, rebuild GitNexus with one pinned version, and run full verification. Keep historical `spoof` compatibility references while replacing only live project identity and absolute-path references.

**Tech Stack:** Git worktrees, Node.js 24, Yarn 4.14.1, Serena, GitNexus 1.6.9, Codex, Claude, JSON, YAML, TOML

## Global Constraints

- Primary target path: `/volume1/Projects/macquerade`.
- Linked target path: `/volume1/Projects/macquerade/.worktrees/codacy-fix-issues`.
- The primary checkout must remain on `main`; preserve its starting ancestry
  without merge, rebase, reset, or force operations. Only the documented
  migration commits may advance its HEAD.
- Linked branch and HEAD must remain `codacy/fix-issues` at `497f6908481317abf3d6c6e1eaa95c7b665012df`.
- Preserve the `spoof` compatibility binary, historical attribution, and historical GitHub mapping key.
- Do not merge, rebase, reset, remove a worktree, or change source-code symbols.
- Preserve unrelated configuration values and credentials byte-for-byte.
- Use GitNexus 1.6.9 for both cleanup and re-indexing; restart older MCP processes before MCP verification.
- Use `apply_patch` for text-file edits.
- Run `yarn validate:strict` before and after relocation in both worktrees.

---

### Task 1: Capture Baseline and Rollback Evidence

**Files:**
- Read: `/volume1/Projects/spoof/.git/`
- Read: `/volume1/Projects/spoof-codacy/.git`
- Create: `/tmp/macquerade-worktree-migration/` backup directory
- Back up: `/volume1/homes/TheJACKedViking/.serena/serena_config.yml`
- Back up: `/volume1/homes/TheJACKedViking/.codex/config.toml`
- Back up: `/volume1/homes/TheJACKedViking/.claude.json`
- Back up: `/volume1/homes/TheJACKedViking/.gitnexus/registry.json`

**Interfaces:**
- Consumes: the two existing clean worktrees and current user-level tool configuration.
- Produces: recorded branch/HEAD/path evidence and restorable configuration backups.

- [ ] **Step 1: Verify the target paths do not already exist**

Run:

```bash
test ! -e /volume1/Projects/macquerade
test ! -e /volume1/Projects/spoof/.worktrees/codacy-fix-issues
```

Expected: both commands exit 0 with no output. Stop before any write if either target exists.

- [ ] **Step 2: Record worktree metadata**

Run from `/volume1/Projects/spoof`:

```bash
git worktree list --porcelain
git status --short --branch
git rev-parse HEAD
```

Run from `/volume1/Projects/spoof-codacy`:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse --git-dir --git-common-dir
```

Expected: the primary is clean on `main`; the linked checkout is clean on `codacy/fix-issues` at `497f6908481317abf3d6c6e1eaa95c7b665012df`; exactly two worktrees are listed.

- [ ] **Step 3: Run the primary baseline validation**

Run from `/volume1/Projects/spoof`:

```bash
yarn validate:strict
```

Expected: typecheck, build, lint, and Vitest all exit 0. Stop and report if the baseline fails.

- [ ] **Step 4: Run the linked-worktree baseline validation**

Run from `/volume1/Projects/spoof-codacy`:

```bash
yarn validate:strict
```

Expected: typecheck, build, lint, and Vitest all exit 0. Stop and report if the baseline fails.

- [ ] **Step 5: Back up user-level configuration**

Run:

```bash
mkdir -p /tmp/macquerade-worktree-migration
cp --preserve=mode,timestamps /volume1/homes/TheJACKedViking/.serena/serena_config.yml /tmp/macquerade-worktree-migration/serena_config.yml
cp --preserve=mode,timestamps /volume1/homes/TheJACKedViking/.codex/config.toml /tmp/macquerade-worktree-migration/codex-config.toml
cp --preserve=mode,timestamps /volume1/homes/TheJACKedViking/.claude.json /tmp/macquerade-worktree-migration/claude.json
cp --preserve=mode,timestamps /volume1/homes/TheJACKedViking/.gitnexus/registry.json /tmp/macquerade-worktree-migration/gitnexus-registry.json
```

Expected: four non-empty backup files exist under `/tmp/macquerade-worktree-migration/`.

### Task 2: Prepare the Repository for Nested Worktrees

**Files:**
- Modify: `/volume1/Projects/spoof/.gitignore`

**Interfaces:**
- Consumes: the clean primary worktree verified in Task 1.
- Produces: a tracked `.worktrees/` ignore rule that prevents nested worktrees from appearing as repository content.

- [ ] **Step 1: Verify `.worktrees/` is not currently ignored**

Run from `/volume1/Projects/spoof`:

```bash
git check-ignore -q .worktrees
```

Expected before the edit: exit 1.

- [ ] **Step 2: Add the exact ignore rule**

Apply this patch:

```diff
*** Begin Patch
*** Update File: .gitignore
@@
+.worktrees/
*** End Patch
```

Place the rule with other project-local development artifacts and do not reorder unrelated entries.

- [ ] **Step 3: Verify the rule**

Run from `/volume1/Projects/spoof`:

```bash
git check-ignore -v .worktrees/probe
git diff --check
git diff -- .gitignore
```

Expected: `git check-ignore` identifies the new `.worktrees/` rule; `git diff --check` exits 0; the diff contains only one added ignore entry.

- [ ] **Step 4: Run the pre-commit scope check**

Run GitNexus `detect_changes` with scope `all`. Because the existing index is known to be database-incompatible, also run:

```bash
git diff --name-status
```

Expected: only `.gitignore` is changed. Record the GitNexus version error if the MCP still cannot open the old index.

- [ ] **Step 5: Commit the ignore rule**

```bash
git add .gitignore
git commit -m "chore: ignore local worktrees"
```

Expected: one commit containing only `.gitignore`.

### Task 3: Remove the Corrupt Old GitNexus Registration

**Files:**
- Remove through CLI: `/volume1/Projects/spoof/.gitnexus/`
- Update through CLI: `/volume1/homes/TheJACKedViking/.gitnexus/registry.json`

**Interfaces:**
- Consumes: the backed-up GitNexus registry and the existing `spoof` entry.
- Produces: no registered GitNexus repository at the old path, ready for clean registration after relocation.

- [ ] **Step 1: Confirm the installed version**

Run from `/volume1/Projects/spoof`:

```bash
npx gitnexus@1.6.9 --version
```

Expected: `1.6.9`.

- [ ] **Step 2: Clean the old index through GitNexus**

Run from `/volume1/Projects/spoof`:

```bash
npx gitnexus@1.6.9 clean --force
```

Expected: the local index is removed and `spoof` is unregistered without an interactive prompt.

- [ ] **Step 3: Verify old registration removal**

Run:

```bash
npx gitnexus@1.6.9 list
test ! -e /volume1/Projects/spoof/.gitnexus/meta.json
```

Expected: no GitNexus entry points to `/volume1/Projects/spoof`, and the old metadata file does not exist.

### Task 4: Relocate and Repair Both Worktrees

**Files:**
- Move: `/volume1/Projects/spoof-codacy` to `/volume1/Projects/spoof/.worktrees/codacy-fix-issues`
- Move: `/volume1/Projects/spoof` to `/volume1/Projects/macquerade`
- Repair: `/volume1/Projects/macquerade/.git/worktrees/` administrative metadata

**Interfaces:**
- Consumes: two clean worktrees, the `.worktrees/` ignore rule, and recorded HEAD values.
- Produces: the approved filesystem layout with valid shared Git administration.

- [ ] **Step 1: Create the worktree container**

Run from `/volume1/Projects/spoof`:

```bash
mkdir -p .worktrees
git check-ignore -q .worktrees/probe
```

Expected: `.worktrees/` exists and the ignore check exits 0.

- [ ] **Step 2: Move the linked worktree with Git**

Run from `/volume1/Projects/spoof`:

```bash
git worktree move /volume1/Projects/spoof-codacy /volume1/Projects/spoof/.worktrees/codacy-fix-issues
```

Expected: the old linked path is absent; the target exists; `git worktree list --porcelain` reports the nested path.

- [ ] **Step 3: Rename the primary checkout**

Run from `/volume1/Projects`:

```bash
mv /volume1/Projects/spoof /volume1/Projects/macquerade
```

Expected: `/volume1/Projects/macquerade` exists and `/volume1/Projects/spoof` does not.

- [ ] **Step 4: Repair Git administrative links**

Run from `/volume1/Projects/macquerade`:

```bash
git worktree repair /volume1/Projects/macquerade/.worktrees/codacy-fix-issues
git worktree list --porcelain
```

Expected: exactly the new primary and linked paths are listed with their original branches and HEADs.

- [ ] **Step 5: Verify both repositories resolve the new common directory**

Run from each target path:

```bash
git rev-parse --show-toplevel
git rev-parse --git-dir --git-common-dir
git status --short --branch
```

Expected: all resolved paths are under `/volume1/Projects/macquerade`; both worktrees are clean; branch and HEAD values match Task 1.

Rollback if Steps 3–5 fail:

```bash
mv /volume1/Projects/macquerade /volume1/Projects/spoof
git -C /volume1/Projects/spoof worktree repair /volume1/Projects/spoof/.worktrees/codacy-fix-issues
git -C /volume1/Projects/spoof worktree move /volume1/Projects/spoof/.worktrees/codacy-fix-issues /volume1/Projects/spoof-codacy
```

### Task 5: Update Repository-Local Tool Configuration

**Files:**
- Modify: `/volume1/Projects/macquerade/.serena/project.yml`
- Modify: `/volume1/Projects/macquerade/.mcp.json`
- Remove if stale: `/volume1/Projects/macquerade/.serena/cache/`

**Interfaces:**
- Consumes: the relocated primary checkout.
- Produces: repository-local Serena and MCP configuration identifying `MACquerade` at its new root.

- [ ] **Step 1: Update Serena's project identity**

Apply this patch from `/volume1/Projects/macquerade`:

```diff
*** Begin Patch
*** Update File: .serena/project.yml
@@
-project_name: "spoof"
+project_name: "MACquerade"
*** End Patch
```

- [ ] **Step 2: Update the project-local Serena MCP path**

Apply this patch:

```diff
*** Begin Patch
*** Update File: .mcp.json
@@
-        "/volume1/Projects/spoof"
+        "/volume1/Projects/macquerade"
*** End Patch
```

- [ ] **Step 3: Remove only regenerable Serena symbol caches if they contain the old path**

Run:

```bash
rg -a -l -F '/volume1/Projects/spoof' .serena/cache
```

If matches are returned, remove only `.serena/cache/`; preserve `.serena/memories/` and `.serena/project.yml`.

- [ ] **Step 4: Validate repository-local configuration**

Run:

```bash
rg -n 'project_name: "MACquerade"' .serena/project.yml
jq -e '.mcpServers.serena.args | index("/volume1/Projects/macquerade")' .mcp.json
rg -n -F '/volume1/Projects/spoof' .serena/project.yml .mcp.json
```

Expected: the first two commands succeed; the final search returns no matches.

### Task 6: Update User-Level Development Tool Registrations

**Files:**
- Modify: `/volume1/homes/TheJACKedViking/.serena/serena_config.yml`
- Modify: `/volume1/homes/TheJACKedViking/.codex/config.toml`
- Modify: `/volume1/homes/TheJACKedViking/.claude.json`

**Interfaces:**
- Consumes: the backups from Task 1 and relocated repository path.
- Produces: Serena, Codex, and Claude registrations pointing at `/volume1/Projects/macquerade`.

- [ ] **Step 1: Update the Serena registry path**

Apply this exact replacement:

```diff
- /volume1/Projects/spoof
+ /volume1/Projects/macquerade
```

Change only the matching entry in the project list.

- [ ] **Step 2: Update the Codex trusted-project table key**

Apply this exact replacement while leaving every property in the table unchanged:

```diff
-[projects."/volume1/Projects/spoof"]
+[projects."/volume1/Projects/macquerade"]
```

- [ ] **Step 3: Update Claude repository-path values**

In `.claude.json`, update only these two scalar values:

```text
githubRepoPaths.thejackedviking/spoof[0]
githubRepoPaths.thejackedviking/macquerade[0]
```

Set both values to `/volume1/Projects/macquerade`. Keep both keys and preserve all unrelated JSON fields.

- [ ] **Step 4: Parse and verify all three configurations**

Run:

```bash
jq empty /volume1/homes/TheJACKedViking/.claude.json
rg -n -F '/volume1/Projects/macquerade' /volume1/homes/TheJACKedViking/.serena/serena_config.yml /volume1/homes/TheJACKedViking/.codex/config.toml
jq -e '.githubRepoPaths["thejackedviking/spoof"][0] == "/volume1/Projects/macquerade" and .githubRepoPaths["thejackedviking/macquerade"][0] == "/volume1/Projects/macquerade"' /volume1/homes/TheJACKedViking/.claude.json
```

Expected: JSON parsing succeeds and all path assertions pass.

- [ ] **Step 5: Roll back immediately if validation fails**

Restore the affected file from `/tmp/macquerade-worktree-migration/`, re-run its parser or path assertion, and stop before GitNexus registration.

### Task 7: Rebuild and Re-register GitNexus as `macquerade`

**Files:**
- Create through CLI: `/volume1/Projects/macquerade/.gitnexus/`
- Update through CLI: `/volume1/homes/TheJACKedViking/.gitnexus/registry.json`
- Modify if generated section is stale: `/volume1/Projects/macquerade/AGENTS.md`
- Modify if generated section is stale: `/volume1/Projects/macquerade/CLAUDE.md`

**Interfaces:**
- Consumes: the relocated Git repository and GitNexus 1.6.9.
- Produces: a healthy index named `macquerade` plus aligned repository guidance.

- [ ] **Step 1: Build a clean index with the pinned CLI**

Run from `/volume1/Projects/macquerade`:

```bash
npx gitnexus@1.6.9 analyze --force
```

Expected: analysis exits 0 and creates `.gitnexus/meta.json` without `incrementalInProgress`.

- [ ] **Step 2: Verify CLI registration and freshness**

Run:

```bash
npx gitnexus@1.6.9 status
npx gitnexus@1.6.9 list
```

Expected: one entry named `macquerade` points to `/volume1/Projects/macquerade`, and it is current with the primary HEAD.

- [ ] **Step 3: Verify generated guidance identifiers**

Run:

```bash
rg -n 'indexed by GitNexus as \*\*macquerade\*\*|gitnexus://repo/macquerade/' AGENTS.md CLAUDE.md
rg -n 'indexed by GitNexus as \*\*spoof\*\*|gitnexus://repo/spoof/' AGENTS.md CLAUDE.md
```

Expected: both guidance files contain `macquerade` identifiers and resource URIs; the old identifier search returns no matches. If generation did not update these sections, patch both files identically and preserve all non-GitNexus guidance.

- [ ] **Step 4: Review tracked changes and keep AGENTS/CLAUDE aligned**

Run:

```bash
git diff --check
git diff --name-status
git diff -- AGENTS.md CLAUDE.md
```

Expected: only the GitNexus sections in `AGENTS.md` and `CLAUDE.md` differ; their project name and resource paths agree.

- [ ] **Step 5: Run the required pre-commit change detection**

Restart the GitNexus MCP process if it predates the 1.6.9 rebuild, then run GitNexus `detect_changes` with scope `all` and repository `macquerade`.

Expected: documentation-only changes with no affected source symbols or execution flows. If this session cannot restart the MCP process, record the required restart and use the successful CLI status plus direct Git diff for the commit gate.

- [ ] **Step 6: Commit tracked guidance changes**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "chore: update tooling for MACquerade path"
```

Expected: the commit contains only aligned GitNexus guidance changes. Repository-local ignored files and user-level configuration remain uncommitted by design.

### Task 8: Final Path, Tooling, and Project Verification

**Files:**
- Read: all relocated Git and tooling configuration
- Test: primary and linked project checkouts

**Interfaces:**
- Consumes: the completed relocation and updated registrations.
- Produces: evidence that Git, Serena, GitNexus, Codex, Claude, and project validation all use the new layout.

- [ ] **Step 1: Verify old and new filesystem paths**

Run:

```bash
test ! -e /volume1/Projects/spoof
test ! -e /volume1/Projects/spoof-codacy
test -d /volume1/Projects/macquerade
test -d /volume1/Projects/macquerade/.worktrees/codacy-fix-issues
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify Git integrity and worktree identity**

Run from `/volume1/Projects/macquerade`:

```bash
git worktree list --porcelain
git fsck --full
git status --short --branch
```

Run from `/volume1/Projects/macquerade/.worktrees/codacy-fix-issues`:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse --git-dir --git-common-dir
```

Expected: `git fsck` exits 0; exactly two valid worktrees are listed; the linked HEAD remains `497f6908481317abf3d6c6e1eaa95c7b665012df`; both statuses are clean.

- [ ] **Step 3: Verify no live configuration retains the old path**

Run targeted searches against:

```text
/volume1/Projects/macquerade/.serena/project.yml
/volume1/Projects/macquerade/.mcp.json
/volume1/Projects/macquerade/.gitnexus/meta.json
/volume1/homes/TheJACKedViking/.serena/serena_config.yml
/volume1/homes/TheJACKedViking/.codex/config.toml
/volume1/homes/TheJACKedViking/.claude.json
/volume1/homes/TheJACKedViking/.gitnexus/registry.json
```

Expected: `/volume1/Projects/spoof` has no matches in these live configuration files. Historical logs, the approved design/plan, attribution, and the compatibility alias are excluded.

- [ ] **Step 4: Verify Serena identity**

Run:

```bash
rg -n 'project_name: "MACquerade"' /volume1/Projects/macquerade/.serena/project.yml
rg -n -F '/volume1/Projects/macquerade' /volume1/homes/TheJACKedViking/.serena/serena_config.yml
```

Expected: exactly one local project identity and one active global registration match. Activate `MACquerade` with Serena and read its instruction manual when Serena tools are available; if they remain unavailable, report this as the only external verification step.

- [ ] **Step 5: Verify GitNexus through CLI and MCP**

Run from `/volume1/Projects/macquerade`:

```bash
npx gitnexus@1.6.9 status
npx gitnexus@1.6.9 list
```

Then read `gitnexus://repo/macquerade/context` through the MCP.

Expected: CLI and MCP agree on name, path, HEAD, and freshness without a database-version error. Restart the MCP host once if it still has the older database library loaded.

- [ ] **Step 6: Run final primary validation**

Run from `/volume1/Projects/macquerade`:

```bash
yarn validate:strict
```

Expected: all commands and tests exit 0.

- [ ] **Step 7: Run final linked-worktree validation**

Run from `/volume1/Projects/macquerade/.worktrees/codacy-fix-issues`:

```bash
yarn validate:strict
```

Expected: all commands and tests exit 0.

- [ ] **Step 8: Report the migration evidence**

Report the two final paths, branches, HEADs, GitNexus registration, Serena identity, configuration files updated, commits created, both validation results, and any MCP/Serena host restart still required. Do not claim external-tool verification if the corresponding tool remains unavailable.
