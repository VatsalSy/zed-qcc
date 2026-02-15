---
name: basilisk-qcc-release
description: Release automation for the basilisk-qcc extension. Use when you need to cut a versioned release tag and publish GitHub release notes for this repository, with strict preflight checks for master branch, clean worktree, upstream sync, and extension version/tag alignment.
---

# basilisk-qcc-release

## Workflow

1. Decide the intended release tag as `vX.Y.Z`.
2. If version files are not yet `X.Y.Z`, run bump mode first.
3. Commit and push the bumped version files.
4. Run release mode to enforce clean/synced state and publish the tag + release notes.

## Command

```bash
.agents/skills/basilisk-qcc-release/scripts/release-zed-extension.sh --tag vX.Y.Z
```

Dry-run mode:

```bash
.agents/skills/basilisk-qcc-release/scripts/release-zed-extension.sh --tag vX.Y.Z --dry-run
```

Version bump mode:

```bash
.agents/skills/basilisk-qcc-release/scripts/release-zed-extension.sh --tag vX.Y.Z --bump-version
```

## Preflight Checks Enforced By Script

- Current branch is `master`.
- Working tree is clean (`git status --porcelain` empty).
- Upstream is exactly `origin/master`.
- Local `master` is fully synced with `origin/master` (no ahead/behind).
- `extension.toml`, `Cargo.toml`, and `Cargo.lock` versions are identical.
- The provided tag `vX.Y.Z` matches those versions exactly.
- Tag does not already exist locally or on `origin`.
- `gh` CLI is authenticated before creating the GitHub release.

## Notes

- Use this skill for the `basilisk-qcc` extension repository only.
- The script intentionally fails fast; do not auto-fix by changing branch history.
- `--bump-version` updates all three version files and exits; release is a second explicit step.
