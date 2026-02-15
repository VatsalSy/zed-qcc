# Repository Guidelines

## Project Structure & Module Organization
- `src/lib.rs` is the Rust entry point; add supporting modules under `src/` and re-export through `lib.rs`.
- `languages/basilisk/*.scm` houses tree-sitter queries for highlighting, folding, injections, and text objects—update them whenever syntax support evolves.
- `extension.toml` declares the packaged extension; adjust metadata and language-server entries alongside functional changes.
- `scripts/` provides workflow tooling (`launch-clangd.sh`, `refresh-compile-commands.sh`, `qcc-build.sh`). Treat generated `build/` artefacts as disposable and keep them out of git.
- An optional `basilisk/` checkout mirrors upstream Basilisk sources; reference it read-only for fixtures or include paths.

## Build, Test, and Development Commands
- `cargo fmt` formats Rust code; run it before every commit.
- `cargo clippy --all-targets --all-features` catches lints and enforces idiomatic style.
- `cargo test` executes available Rust tests. Add new cases under `tests/` when extending analysis or helpers.
- `scripts/launch-clangd.sh` regenerates `build/compile_commands.json` and starts clangd with qcc-aware flags—use it inside Zed to verify language-server behavior.
- `scripts/qcc-build.sh examples/foo.c foo` compiles Basilisk C sources with qcc, honouring environment overrides like `BASILISK` and `QCC_OPENMP_FLAG`.

## Coding Style & Naming Conventions
- Rust follows edition 2021 defaults: snake_case modules, PascalCase types, 4-space indentation, and enforced formatting via `cargo fmt`.
- Shell helpers start with `#!/usr/bin/env bash`, use `set -euo pipefail`, and keep 2-space indents plus hyphenated filenames.
- Keep configuration files ASCII and document only non-obvious logic with succinct comments.

## Testing Guidelines
- Extend `cargo test` or add integration checks whenever parsing, completion, or diagnostics change.
- After editing build flags, rerun `scripts/refresh-compile-commands.sh $PWD ${BASILISK:-$HOME/basilisk/src} $(command -v qcc)` so clangd consumes up-to-date commands.
- Smoke test by compiling representative `.c` files with `scripts/qcc-build.sh` and opening them in Zed to confirm highlighting and navigation.

## Commit & Pull Request Guidelines
- Commit subjects stay imperative and under ~50 characters (e.g., `Add clangd launch wrapper`); explain the rationale in the body when non-trivial.
- Pull requests link related issues, list verification steps (`cargo fmt`, `cargo clippy`, `cargo test`, clangd refresh), and include screenshots or logs for user-facing changes.
- Avoid committing secrets or machine-specific paths; rely on env vars such as `BASILISK`, `QCC_PATH`, `CLANGD_PATH`, and `ZED_WORKTREE`.

## Security & Configuration Tips
- Keep credentials and personal notes in ignored locations like `do-not-commit/`; never vendor them into the repo.
- When adding tooling, mirror existing scripts by validating dependencies early and documenting required environment variables.
