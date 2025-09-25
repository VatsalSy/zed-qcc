# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Zed editor extension for **Basilisk C** language support. Basilisk C is an extension of C99 used for computational fluid dynamics simulations. The extension provides LSP capabilities through integration with `qcc` (the Basilisk C compiler) and `clangd`, keeping clangd synchronized with qcc's preprocessing pipeline.

## Key Architecture Components

### Core Language Server Strategy
- **Primary LSP**: Uses `clangd` as the language server
- **Preprocessing Bridge**: Uses `qcc -E` to generate preprocessed output that clangd can understand
- **Compilation Database**: Generates `build/compile_commands.json` dynamically using qcc commands
- **Query Driver**: Configures clangd with `--query-driver` pointing to qcc for proper macro/include handling

### Environment Detection
The extension automatically discovers:
- **qcc compiler**: Searches PATH, `QCC_PATH`, `$BASILISK/src/qcc`, `$HOME/basilisk/src/qcc`, and project-local `basilisk/src/qcc`
- **Basilisk root**: Uses `$BASILISK` env var, project-local `basilisk/src/`, or `$HOME/basilisk/src/`
- **clangd binary**: Uses system clangd or can be configured via `CLANGD_PATH`

## Development Commands

### Build and Test
```bash
# Format Rust code (run before every commit)
cargo fmt

# Lint and style check
cargo clippy --all-targets --all-features

# Run Rust tests
cargo test

# Test the language server setup
./scripts/launch-clangd.sh

# Test qcc compilation
./scripts/qcc-build.sh examples/test.c test_output
```

### Script Usage
The extension includes shell scripts that can be run independently:
- **`scripts/launch-clangd.sh`**: Regenerates compile_commands.json and launches clangd with proper qcc integration
- **`scripts/refresh-compile-commands.sh`**: Updates compilation database for project C files
- **`scripts/qcc-build.sh`**: Builds Basilisk C files using qcc with proper flags

## File Structure

### Core Extension Files
- **`src/lib.rs`**: Main Rust extension implementation with environment detection and clangd configuration
- **`extension.toml`**: Zed extension metadata and language server configuration
- **`Cargo.toml`**: Rust crate configuration

### Language Configuration
- **`languages/basilisk/config.toml`**: Language definition (file extensions, comments, brackets)
- **`languages/basilisk/*.scm`**: Tree-sitter queries for syntax highlighting, folding, text objects

### Build System
- **`scripts/`**: Shell scripts for clangd integration and qcc compilation
- **`build/`**: Generated directory for compile_commands.json (not in git)

## Basilisk C Language Features

### Special Constructs to Handle
- **Events**: `event init (t = 0) { ... }`, `event acceleration (i++) { ... }`
- **Foreach loops**: `foreach()`, `foreach_face(x)`, `foreach_dimension()`
- **Field access**: `u.x[]`, `u.y[1,0]`, `f[]`
- **Dimensional attributes**: `double WIDTH = 120. [1];`
- **Special includes**: `#include "navier-stokes/centered.h"`

### Build Variants
- **Serial**: `qcc -Wall -O2 -disable-dimensions FILE.c -o FILE -lm`
- **OpenMP**: Add `-fopenmp` flag
- **MPI Linux**: `CC99='mpicc -std=c99 -D_GNU_SOURCE=1' qcc -Wall -O2 -D_MPI=1 -disable-dimensions FILE.c -o FILE -lm`
- **MPI macOS**: `CC99='mpicc -std=c99' qcc -Wall -O2 -D_MPI=1 -disable-dimensions FILE.c -o FILE -lm`

## Implementation Notes

### Rust Extension Logic
The main extension (`src/lib.rs`) implements:
1. **Environment Detection**: Automatically finds qcc and Basilisk installation
2. **Compile Commands Generation**: Walks project tree and generates compilation database entries
3. **clangd Configuration**: Launches clangd with proper flags and query-driver setup
4. **Workspace Configuration**: Provides fallback flags for clangd

### Tree-sitter Integration
Currently uses standard `tree-sitter-c` grammar with custom highlighting queries:
- Highlights Basilisk-specific functions (`event`, `foreach`, etc.)
- Custom field access patterns (`u.x`, `u.y`, `u.z`)
- Special include path highlighting

### Error Handling Strategy
- Graceful fallback when qcc is not found (uses standard clangd)
- Validates qcc installation before attempting compilation database generation
- Excludes build directories and git from file walking to avoid noise

## Testing Approach

### Test with Real Basilisk Files
Use examples from `basilisk/src/examples/` such as:
- `karman.c` - Basic fluid dynamics simulation
- Files with event declarations and foreach loops
- Files using MPI/OpenMP parallelization

### Validation Checklist
- [ ] Extension loads without errors
- [ ] Detects `.c` files as Basilisk C appropriately
- [ ] Provides code completion for standard C constructs
- [ ] Resolves includes from Basilisk installation
- [ ] Can compile programs using the qcc build script
- [ ] Generates valid compile_commands.json entries

## Environment Variables

The extension respects these environment variables:
- **`BASILISK`**: Path to Basilisk installation root
- **`QCC_PATH`**: Explicit path to qcc compiler
- **`CLANGD_PATH`**: Path to clangd binary
- **`CC99`**: C99 compiler for MPI builds (e.g., `mpicc -std=c99`)
- **`QCC_OPENMP_FLAG`**: OpenMP flag (e.g., `-fopenmp`)
- **`QCC_MPI_DEFINE`**: MPI defines (e.g., `-D_MPI=1`)

## Coding Standards

### Rust Code
- Follow Rust 2021 edition conventions
- Use `snake_case` for functions/variables, `PascalCase` for types
- Run `cargo fmt` before commits
- Handle errors gracefully with `Result<T>` types
- Use `anyhow` for error context

### Shell Scripts
- Start with `#!/usr/bin/env bash` and `set -euo pipefail`
- Use 2-space indentation
- Quote variables properly to handle paths with spaces
- Provide early validation of required tools

## Common Pitfalls

### Path Handling
- Always quote file paths in shell commands due to potential spaces
- Use absolute paths when passing between Rust and shell scripts
- Handle missing Basilisk installation gracefully

### Cross-Platform Considerations
- Different MPI compilation flags on Linux vs macOS
- Path separators and environment variable handling
- Shell script compatibility (avoid bash-specific features where possible)

### Performance
- Avoid regenerating compile_commands.json unnecessarily
- Exclude irrelevant directories (build/, target/, .git/) from file walking
- Use caching where appropriate for repeated operations
