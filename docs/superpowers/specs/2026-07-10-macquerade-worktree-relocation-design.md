# MACquerade Worktree Relocation Design

## Objective

Rename the primary project directory from `/volume1/Projects/spoof` to
`/volume1/Projects/macquerade`, move every linked worktree into the primary
checkout's ignored `.worktrees/` directory, and update development tooling so
the repository is consistently registered as `MACquerade` at its new path.

## Current State

The repository has two clean worktrees sharing one Git common directory:

- `/volume1/Projects/spoof` on branch `main` at `9459b56`
- `/volume1/Projects/spoof-codacy` on branch `codacy/fix-issues` at `497f690`

The linked worktree's administrative directory is currently stored under
`/volume1/Projects/spoof/.git/worktrees/spoof-codacy`.

Path or project-identity references also exist in:

- repository-local Serena, MCP, and GitNexus files;
- `AGENTS.md` and `CLAUDE.md` GitNexus instructions;
- the user-level Serena project registry;
- the user-level Codex trusted-project configuration;
- Claude repository-path mappings; and
- the user-level GitNexus registry.

The existing GitNexus index is stale and was left in an incompatible database
format by an interrupted analyzer upgrade. It must be cleanly unregistered and
rebuilt rather than repaired by manually editing index metadata.

## Target Layout

```text
/volume1/Projects/macquerade/
├── .git/
├── .worktrees/
│   └── codacy-fix-issues/
└── ...primary checkout files
```

The primary checkout remains on `main`. The linked checkout remains on
`codacy/fix-issues` with the same HEAD and working-tree contents.

## Migration Strategy

Use Git-aware operations wherever Git supports them:

1. Capture branch, HEAD, status, and worktree metadata for rollback and verify
   both worktrees are clean.
2. Run the baseline project validation before changing paths.
3. Add `.worktrees/` to the repository's `.gitignore` before nesting a linked
   checkout inside the primary checkout.
4. Unregister and remove the corrupt `spoof` GitNexus index through the
   GitNexus CLI while the old path still exists.
5. Move `/volume1/Projects/spoof-codacy` with `git worktree move` to
   `/volume1/Projects/spoof/.worktrees/codacy-fix-issues`.
6. Rename the primary directory to `/volume1/Projects/macquerade` with a
   filesystem move because Git does not provide a command for moving the main
   worktree.
7. Run `git worktree repair` from the new primary path to repair the main and
   linked worktree administrative links.
8. Update project-local and user-level tooling configuration.
9. Rebuild GitNexus from the new root using a CLI version compatible with the
   configured MCP service, registering the repository as `macquerade`.
10. Run path, Git, tool-registration, and project validation checks.

No source-code symbol is renamed or modified, so GitNexus symbol impact
analysis is not applicable to this migration.

## Configuration Changes

### Tracked repository files

- Add `.worktrees/` to `.gitignore`.
- Update GitNexus project identifiers and resource URIs in `AGENTS.md` and
  `CLAUDE.md` from `spoof` to `macquerade`.

Historical compatibility references to the original `spoof` utility and the
retained `spoof` CLI alias remain unchanged.

### Repository-local ignored configuration

- Change `.serena/project.yml` from project name `spoof` to `MACquerade`.
- Change the Serena `--project` argument in `.mcp.json` to
  `/volume1/Projects/macquerade` while preserving all unrelated MCP settings.
- Recreate `.gitnexus/` from the new root instead of hand-editing its caches or
  database files.

Serena language-server caches may be removed and regenerated if they embed the
old absolute path. Serena memories are preserved; a historical memory filename
containing `spoof` is not renamed unless its contents act as live
configuration.

### User-level configuration

- Replace `/volume1/Projects/spoof` with `/volume1/Projects/macquerade` in the
  Serena project registry.
- Replace the Codex trusted-project table key with the new path while preserving
  its current trust settings.
- Update both Claude repository mappings that currently point at the old path;
  keep any historical GitHub repository key required for compatibility.
- Remove the old GitNexus registry entry via `gitnexus clean` and let
  `gitnexus analyze` create the new `macquerade` entry.

Unrelated configuration values and credentials are not changed or copied into
new files.

## Failure Handling and Rollback

Each filesystem transition has a verification gate:

- If the linked-worktree move fails, leave the primary directory in place and
  repair or reverse only that move.
- If the primary rename succeeds but Git repair fails, move the primary
  directory back to `/volume1/Projects/spoof`, run `git worktree repair`, and
  restore the linked worktree to `/volume1/Projects/spoof-codacy`.
- Back up user-level configuration files before applying path replacements and
  restore those backups if parsing or validation fails.
- Do not delete the old GitNexus registration by editing `registry.json`
  directly. Use the CLI so registry and local index state remain synchronized.
- Do not remove any working tree or use destructive Git reset/checkout
  operations.

## Verification

The migration is complete only when all of the following checks succeed:

- `/volume1/Projects/spoof` and `/volume1/Projects/spoof-codacy` no longer
  exist, while both target paths do exist.
- `git worktree list --porcelain` reports only the new primary and linked paths.
- Both worktrees retain their original branches and HEAD commits and have no
  unexpected changes.
- `git rev-parse --git-dir --git-common-dir` resolves to valid locations from
  both worktrees.
- `.worktrees/` is ignored from the primary checkout.
- A targeted search of live configuration finds no remaining
  `/volume1/Projects/spoof` path references.
- Serena's local project name and user-level registration identify
  `MACquerade` at `/volume1/Projects/macquerade`.
- Codex and Claude path mappings point to the new root.
- `gitnexus status` and `gitnexus list` report a healthy `macquerade` index at
  the new path, and the GitNexus MCP can read
  `gitnexus://repo/macquerade/context`. If the running MCP process caches the
  old registry or an older database library, restart it and repeat this check.
- `yarn validate:strict` succeeds from the primary checkout and the linked
  worktree after relocation.

## Out of Scope

- Renaming the Git remote or GitHub repository, which already uses
  `Enflame-Media-LLC/MACquerade`.
- Removing the `spoof` compatibility binary or historical attribution.
- Merging, rebasing, or otherwise changing either worktree's branch history.
- Altering unrelated MCP servers, credentials, editor preferences, or generated
  build output.
