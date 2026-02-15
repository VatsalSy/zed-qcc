# Comprehensive Plan for Basilisk C (qcc) Zed Extension

## Overview
This document outlines a comprehensive plan to create a Zed editor extension for Basilisk C language support, providing LSP capabilities through integration with qcc (the Basilisk C compiler) and clangd while keeping clangd in sync with qcc's preprocessing pipeline.

## Background

### Basilisk C Language
- Basilisk C is an extension of C99 used for computational fluid dynamics
- Compiler: qcc (located at `basilisk/src/qcc`)
- Key features:
  - Event-driven programming model
  - Field constructs (scalar, vector, tensor)
  - Special foreach loops for grid iteration
  - Dimensional attributes notation
- Canonical build flags:
  - Serial/OpenMP: `qcc -Wall -O2 -fopenmp -disable-dimensions FILE.c -o FILE -lm`
  - MPI (Linux): `CC99='mpicc -std=c99 -D_GNU_SOURCE=1' qcc -Wall -O2 -D_MPI=1 -disable-dimensions FILE.c -o FILE -lm`
  - MPI (macOS): `CC99='mpicc -std=c99' qcc -Wall -O2 -D_MPI=1 -disable-dimensions FILE.c -o FILE -lm`

### Current State
- No existing tree-sitter-basilisk grammar
- No existing Zed extension for Basilisk
- qcc is installed and working on the system
- Basilisk source code available at `basilisk/src/`
- Sample programs provided in `basilisk/src/examples/*.c`

## Implementation Plan

### 1. Project Structure

```
zed-qcc/
├── Cargo.toml
├── extension.toml
├── src/
│   └── lib.rs
├── languages/
│   └── basilisk/
│       ├── config.toml
│       ├── highlights.scm
│       ├── textobjects.scm
│       ├── outline.scm
│       ├── brackets.scm
│       ├── injections.scm
│       └── folds.scm
└── scripts/
    ├── setup-basilisk-lsp.sh
    ├── launch-clangd.sh
    ├── refresh-compile-commands.sh
    └── qcc-build.sh
```

### 2. Tree-sitter Grammar Strategy

#### Extended Grammar
Create a new tree-sitter-basilisk grammar by forking tree-sitter-c and adding:

**Basilisk-specific constructs to add:**
```c
// Event declarations
event init (t = 0) { ... }
event acceleration (i++) { ... }
event adapt (i++) { ... }

// Special foreach loops
foreach()
foreach_face(x)
foreach_dimension()

// Field access syntax
u.x[]
u.y[1,0]
f[]

// Dimensional attributes
double WIDTH = 120. [1];
TOLERANCE = 1e-4 [*];

// Special includes
#include "navier-stokes/centered.h"
```

### 3. qcc Preprocessing & clangd Synchronization

#### Goals
- Ensure clangd analyzes the same translation units qcc compiles.
- Capture qcc's generated includes, macro expansions, and flags on a per-file basis.

#### Strategy
1. Author `scripts/launch-clangd.sh` that:
   - Resolves `${BASILISK}` (defaulting to `${HOME}/basilisk/src` when unset).
   - Delegates to `scripts/refresh-compile-commands.sh` to build or refresh a project-local `build/compile_commands.json` by invoking `qcc -E -Wall -O2 -disable-dimensions` on the current file and recording the exact command line (including `-I"${BASILISK}"`, any `${QCC_OPENMP_FLAG}`, and `${QCC_MPI_DEFINE}`).
   - Respects `CC99` overrides so MPI/OpenMP toolchains propagate into the compilation database.
   - Accepts the active file path and output binary name so the refresh script can update single entries without reprocessing the entire tree.
2. Run clangd with `--compile-commands-dir build --query-driver=$(command -v qcc)` so it consumes the generated database and trusts qcc as a valid driver.
3. Regenerate the entry on save via a lightweight watcher (e.g., Zed task or extension hook) that calls `refresh-compile-commands.sh` to keep clangd current.
4. For quick prototypes, supply a wrapper script that proxies clangd requests through qcc's preprocessor (`qcc -E` piped into clangd's `--query-driver`), but migrate to the compile-commands approach before shipping.
5. Seed the compilation database by indexing representative files from `${BASILISK}/examples/*.c` so symbol resolution covers idiomatic patterns out of the box.

`refresh-compile-commands.sh` should accept the source path and output stem, emit a single JSON entry (merging with any existing ones), and reuse cached qcc output when the file hash is unchanged to keep updates fast.

### 4. Extension Configuration Files

#### extension.toml
```toml
id = "zed-qcc"
name = "zed-qcc"
version = "0.1.0"
schema_version = 1
authors = ["Your Name <email@example.com>"]
description = "Basilisk C language support with qcc compiler integration"
repository = "https://github.com/yourusername/zed-qcc"

[language_servers.basilisk-lsp]
name = "Basilisk Language Server"
language = "Basilisk C"
command = "${EXTENSION_ROOT}/scripts/launch-clangd.sh"
env = { BASILISK = "${BASILISK:-$HOME/basilisk}" }

[grammars.basilisk]
# If using extended grammar
repository = "https://github.com/yourusername/tree-sitter-basilisk"
commit = "latest-commit-hash"
# Or if using standard C grammar
# repository = "https://github.com/tree-sitter/tree-sitter-c"
# commit = "v0.20.7"
```

#### Cargo.toml
```toml
[package]
name = "zed-qcc"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
zed_extension_api = "0.0.6"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### 5. Language Configuration

#### languages/basilisk/config.toml
```toml
name = "Basilisk C"
grammar = "basilisk"
path_suffixes = ["c", "h"]
line_comments = ["// "]
block_comment = ["/* ", " */"]
autoclose_before = ";,}])"
brackets = [
    { start = "{", end = "}", close = true, newline = true },
    { start = "[", end = "]", close = true, newline = false },
    { start = "(", end = ")", close = true, newline = false },
]
word_characters = ["_"]
```

### 6. Rust Implementation

#### src/lib.rs
```rust
use std::fs;
use std::path::PathBuf;
use zed_extension_api::{self as zed, LanguageServerId, Result};

struct BasiliskExtension {
    cached_binary_path: Option<String>,
}

impl BasiliskExtension {
    fn setup_clangd_config(&self, worktree: &zed::Worktree) -> Result<()> {
        // Create .clangd configuration file in project root
        let basilisk_path = "$BASILISK";
        let config_content = format!(
            r#"
CompileFlags:
  Compiler: $BASILISK/qcc
  Add:
    - "-I{}"
    - "-I{}/ast"
    - "-D_GNU_SOURCE"
    - "-DBASILISK"
  Remove:
    - "-W*"

Diagnostics:
  UnusedIncludes: None
  MissingIncludes: None
"#,
            basilisk_path, basilisk_path
        );

        // Write config to workspace
        // Implementation details...
        Ok(())
    }

    fn find_or_install_clangd(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<String> {
        // First check if clangd is available in PATH
        if let Some(path) = worktree.which("clangd") {
            return Ok(path);
        }

        // If not, download and install clangd
        // Similar to GLSL extension implementation
        // ...

        Ok(clangd_path)
    }
}

impl zed::Extension for BasiliskExtension {
    fn new() -> Self {
        Self {
            cached_binary_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        // Setup clangd configuration for Basilisk
        self.setup_clangd_config(worktree)?;

        let clangd_path = self.find_or_install_clangd(language_server_id, worktree)?;

        Ok(zed::Command {
            command: clangd_path,
            args: vec![
                "--background-index".to_string(),
                "--clang-tidy".to_string(),
                "--completion-style=detailed".to_string(),
                "--header-insertion=never".to_string(),
                "--log=error".to_string(),
            ],
            env: vec![
                ("BASILISK_PATH".to_string(),
                 "$BASILISK".to_string()),
            ].into_iter().collect(),
        })
    }

    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        // Configure clangd settings specific to Basilisk
        Ok(Some(serde_json::json!({
            "clangd": {
                "fallbackFlags": [
                    "-I${HOME}/basilisk/src",
                    "-std=c99",
                    "-D_GNU_SOURCE"
                ]
            }
        })))
    }
}

zed::register_extension!(BasiliskExtension);
```

### 7. Tree-sitter Queries

#### highlights.scm
```scheme
; Basilisk-specific highlighting
; Events
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @function.special
    (#match? @function.special "^event$")))

; Field access
(postfix_expression
  operator: "." @operator
  field: (field_identifier) @field)

; Dimensional attributes
(attributed_declarator
  declarator: (_)
  attributes: (attribute_specifier) @attribute)

; Special macros
(call_expression
  function: (identifier) @function.builtin
  (#match? @function.builtin "^(foreach|foreach_face|foreach_dimension)$"))

; Include Basilisk modules
(preproc_include
  path: (string_literal) @string.special
  (#match? @string.special "navier-stokes|two-phase|tension"))
```

#### textobjects.scm
```scheme
; Events as functions
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @function.name
    (#match? @function.name "^event$"))
  body: (compound_statement) @function.inside) @function.around

; Foreach blocks
(expression_statement
  (call_expression
    function: (identifier) @_func
    (#match? @_func "^foreach")
    arguments: (argument_list))
  (compound_statement) @loop.inside) @loop.around
```

#### outline.scm
```scheme
; Events in outline
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name
    (#match? @name "^event$")
    parameters: (parameter_list) @context)
  (#set! kind "event"))

; Regular functions
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name)
  (#set! kind "function"))

; Struct definitions
(struct_specifier
  name: (type_identifier) @name
  (#set! kind "struct"))
```

### 8. Build Tasks Integration

Create a `tasks.json` that shells out through qcc with portable paths and flags:
```json
{
  "label": "Build with qcc",
  "command": "${EXTENSION_ROOT}/scripts/qcc-build.sh",
  "args": [
    "$ZED_FILE",
    "${ZED_FILENAME/\\.c$/}"
  ],
  "env": {
    "BASILISK": "${BASILISK:-$HOME/basilisk}",
    "CC99": "${CC99:-mpicc -std=c99}",
    "QCC_OPENMP_FLAG": "${QCC_OPENMP_FLAG:-}",
    "QCC_MPI_DEFINE": "${QCC_MPI_DEFINE:--D_MPI=0}"
  }
}
```

`qcc-build.sh` should expand the arguments into the canonical command line:
```
qcc -Wall -O2 ${QCC_OPENMP_FLAG} ${QCC_MPI_DEFINE} -disable-dimensions \
    "$INPUT" -o "$OUTPUT" -lm -I"${BASILISK}"
```

Ensure the script strips empty env placeholders so qcc never receives blank arguments.

When OpenMP is required, set `QCC_OPENMP_FLAG=-fopenmp`. For MPI builds, set `CC99='mpicc -std=c99 -D_GNU_SOURCE=1'` on Linux or `CC99='mpicc -std=c99'` on macOS, and export `QCC_MPI_DEFINE=-D_MPI=1` before invoking the task.

### 9. Testing Strategy

#### Test Files
1. Create test Basilisk C files covering:
   - Event declarations
   - Foreach loops
   - Field operations
   - Include statements
   - Dimensional attributes
2. Mirror representative cases from `basilisk/src/examples/*.c` to validate real-world idioms (MPI, OpenMP, adaptive meshes).

#### Test Cases
```c
// test_basic.c
#include "grid/quadtree.h"
#include "navier-stokes/centered.h"

scalar f[];
vector u[];

event init (t = 0) {
  foreach() {
    f[] = x*x + y*y;
    u.x[] = -y;
    u.y[] = x;
  }
}

event adapt (i++) {
  adapt_wavelet ({f,u}, (double[]){0.01,0.01,0.01}, 9, 4);
}
```

Validate each test by invoking:
- Serial build: `qcc -Wall -O2 -disable-dimensions test_basic.c -o test_basic -lm`
- OpenMP build: `qcc -Wall -O2 -disable-dimensions -fopenmp test_basic.c -o test_basic_omp -lm`
- MPI build (Linux): `CC99='mpicc -std=c99 -D_GNU_SOURCE=1' qcc -Wall -O2 -D_MPI=1 -disable-dimensions test_mpi.c -o test_mpi -lm`
- MPI build (macOS): `CC99='mpicc -std=c99' qcc -Wall -O2 -D_MPI=1 -disable-dimensions test_mpi.c -o test_mpi -lm`

### 10. Development Steps

1. **Phase 1: Basic Setup**
   - Create directory structure
   - Set up Cargo project
   - Implement basic extension with C grammar
   - Scaffold `launch-clangd.sh`, `refresh-compile-commands.sh`, and `qcc-build.sh`

2. **Phase 2: LSP Integration**
   - Implement clangd integration backed by the `launch-clangd.sh` wrapper
   - Auto-generate `build/compile_commands.json` via qcc preprocessing (respecting `${BASILISK}`, `${CC99}`, MPI/OpenMP toggles)
   - Wire `qcc-build.sh` into Zed tasks for one-click builds
   - Test basic completion and diagnostics on sample Basilisk files

3. **Phase 3: Enhanced Features**
   - Add custom highlighting for Basilisk constructs
   - Implement text objects for events and foreach
   - Add outline support for events

4. **Phase 4: Tree-sitter Grammar (Optional)**
   - Fork tree-sitter-c
   - Add Basilisk-specific rules
   - Test and refine grammar

5. **Phase 5: Polish**
   - Add build tasks
   - Create snippets for common patterns
   - Write documentation

### 11. Challenges and Solutions

#### Challenge 1: Basilisk Macros
**Problem**: Basilisk uses many preprocessor macros that clangd won't understand
**Solution**: Regenerate `build/compile_commands.json` via the qcc wrapper so clangd consumes qcc's preprocessed translation units, keeping macros and injected headers aligned automatically

#### Challenge 2: Event System
**Problem**: Events look like functions but have special semantics
**Solution**: Use tree-sitter queries to identify and specially handle event declarations

#### Challenge 3: Field Access Syntax
**Problem**: `u.x[]` is not standard C syntax
**Solution**: Either extend grammar or use clangd's error recovery with custom diagnostics filtering

#### Challenge 4: Include Path Management
**Problem**: Basilisk headers are not in standard locations
**Solution**: Resolve `${BASILISK}` in scripts, inject `-I${BASILISK}` into generated compile commands, and surface the env variable inside Zed tasks and the language-server wrapper

### 12. Future Enhancements

1. **Visualization Integration**
   - Add commands to generate plots with bview
   - Integrate with Basilisk's visualization tools

2. **Documentation Support**
   - Link to Basilisk documentation
   - Show hover documentation for Basilisk functions

3. **Project Templates**
   - Provide templates for common Basilisk simulations
   - Include example configurations

4. **Debugging Support**
   - Configure debugger for Basilisk programs
   - Add breakpoint support in events

5. **Performance Analysis**
   - Integrate with Basilisk's profiling tools
   - Show performance metrics in editor

## Resources

- [Basilisk Documentation](http://basilisk.fr/)
- [Basilisk Examples Directory](http://basilisk.fr/src/examples/)
- [Zed Extension API](https://github.com/zed-industries/zed/tree/main/crates/extension_api)
- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [clangd Configuration](https://clangd.llvm.org/config)

## Conclusion

This plan provides a comprehensive approach to adding Basilisk C support to Zed. The implementation can start with basic LSP support using clangd and gradually add more sophisticated features like custom grammar and Basilisk-specific tooling integration.
