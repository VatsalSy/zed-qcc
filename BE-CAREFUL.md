# BE CAREFUL: Detailed Evaluation of Basilisk C (qcc) Zed Extension Plan

**Document Purpose**: Critical analysis of PLAN.md for Basilisk C language support in Zed
**Evaluation Date**: 2025-01-25
**Plan Author**: Vatsal Sanjay

---

## 🎯 Executive Summary

**Overall Rating: 8.5/10** - Excellent research and comprehensive planning, but needs simplification

**Key Verdict**: The plan demonstrates deep understanding of both Basilisk C and Zed extension architecture. However, it's **overly ambitious for a first version** and should be implemented in phases to ensure success.

**Primary Recommendation**: Start with a minimal viable product (MVP) focusing on basic clangd integration, then iterate based on user feedback.

---

## 📋 Section-by-Section Analysis

### 1. Project Structure (9/10) ✅ EXCELLENT
```
✅ Correctly follows Zed extension conventions
✅ Proper separation of concerns (languages/, scripts/, src/)
✅ Comprehensive file organization
```

**Strengths:**
- Matches zed-latex extension structure exactly
- Logical organization of language configs and tree-sitter queries
- Proper Rust crate structure

**Minor Suggestions:**
- Consider adding `tests/` directory for unit tests
- Add `examples/` directory with sample Basilisk C files

### 2. Tree-sitter Grammar Strategy (6/10) ⚠️ OVERLY COMPLEX

**Current Plan:**
```c
// Basilisk-specific constructs to add:
event init (t = 0) { ... }
foreach()
u.x[]
double WIDTH = 120. [1];
```

**⚠️ CRITICAL CONCERNS:**

1. **Maintenance Burden**: Forking tree-sitter-c means maintaining grammar updates forever
2. **Complexity vs Benefit**: Most Basilisk code is standard C99
3. **Alternative Approach**: Use LSP semantic tokens for Basilisk-specific highlighting

**Better Strategy:**
```rust
// Phase 1: Use standard tree-sitter-c
[grammars.basilisk]
repository = "https://github.com/tree-sitter/tree-sitter-c"
commit = "v0.20.7"

// Phase 2 (later): Add semantic highlighting via LSP
impl Extension {
    fn provide_semantic_tokens(&self) -> Vec<SemanticToken> {
        // Highlight 'event', 'foreach', field access patterns
    }
}
```

### 3. qcc Preprocessing & clangd Synchronization (10/10) 🏆 BRILLIANT

**This is the heart of the solution and it's PERFECT:**

```bash
# Genius approach:
qcc -E -Wall -O2 -disable-dimensions FILE.c
# Generate compile_commands.json from this
clangd --compile-commands-dir build --query-driver=$(command -v qcc)
```

**Why This Works:**
- clangd sees exactly what qcc sees
- Proper macro expansion and include resolution
- Handles MPI/OpenMP variants correctly

**🚨 IMPLEMENTATION RISKS:**
1. **Shell Script Complexity**: The proposed scripts are quite complex
2. **Error Handling**: What if qcc fails? Network issues? Permission problems?
3. **Performance**: Regenerating on every save might be slow

**Safer Implementation:**
```rust
use std::process::Command;
use serde_json::json;

impl BasiliskExtension {
    fn generate_compile_commands(&self, file_path: &str) -> Result<()> {
        // Run qcc -E to get preprocessor output
        let output = Command::new(&self.qcc_path)
            .args(&["-E", "-Wall", "-O2", "-disable-dimensions"])
            .arg(file_path)
            .output()?;

        if !output.status.success() {
            eprintln!("qcc preprocessing failed: {}",
                     String::from_utf8_lossy(&output.stderr));
            return Err("qcc preprocessing failed");
        }

        // Generate compile_commands.json entry
        let entry = json!({
            "directory": self.worktree_root,
            "file": file_path,
            "command": self.build_qcc_command_line(file_path)
        });

        self.update_compile_database(entry)?;
        Ok(())
    }
}
```

### 4. Extension Configuration (8/10) ✅ GOOD with Issues

**Current Plan:**
```toml
[language_servers.basilisk-lsp]
command = "${EXTENSION_ROOT}/scripts/launch-clangd.sh"
env = { BASILISK = "${BASILISK:-$HOME/basilisk}" }
```

**🚨 CRITICAL PROBLEMS:**

1. **Hardcoded Paths**: Plan has `/Users/vatsal/CMP-codes/basilisk/src` hardcoded
2. **Shell Script Dependency**: Complex shell scripts can fail silently
3. **Cross-Platform Issues**: Different behavior on Windows/Linux/macOS

**Better Approach:**
```toml
[language_servers.basilisk-lsp]
name = "Basilisk Language Server"
language = "Basilisk C"
command = "clangd"
args = [
    "--background-index",
    "--clang-tidy",
    "--compile-commands-dir=${WORKTREE_ROOT}/build",
    "--query-driver=${BASILISK_QCC:-qcc}"
]
```

### 5. Rust Implementation (7/10) 🔧 NEEDS SIMPLIFICATION

**Current Plan Issues:**
```rust
// TOO COMPLEX for MVP:
fn setup_clangd_config(&self, worktree: &zed::Worktree) -> Result<()> {
    let basilisk_path = "/Users/vatsal/CMP-codes/basilisk/src"; // ❌ HARDCODED
    let config_content = format!(r#"
CompileFlags:
  Compiler: /Users/vatsal/CMP-codes/basilisk/src/qcc  // ❌ HARDCODED
```

**Simplified Approach:**
```rust
use std::path::PathBuf;
use zed_extension_api::{self as zed, Result};

struct BasiliskExtension {
    qcc_path: Option<PathBuf>,
    basilisk_root: Option<PathBuf>,
}

impl BasiliskExtension {
    fn detect_basilisk_environment(&mut self, worktree: &zed::Worktree) -> Result<()> {
        // Try multiple detection methods
        self.qcc_path = self.find_qcc(worktree)?;
        self.basilisk_root = self.detect_basilisk_root(worktree)?;
        Ok(())
    }

    fn find_qcc(&self, worktree: &zed::Worktree) -> Option<PathBuf> {
        // 1. Check if qcc is in PATH
        if let Some(qcc) = worktree.which("qcc") {
            return Some(PathBuf::from(qcc));
        }

        // 2. Check BASILISK environment variable
        if let Ok(basilisk) = std::env::var("BASILISK") {
            let qcc_path = PathBuf::from(basilisk).join("src/qcc");
            if qcc_path.exists() {
                return Some(qcc_path);
            }
        }

        // 3. Check common locations
        let common_paths = vec![
            PathBuf::from(std::env::var("HOME").unwrap_or_default()).join("basilisk/src/qcc"),
            PathBuf::from("/usr/local/basilisk/src/qcc"),
            PathBuf::from("/opt/basilisk/src/qcc"),
        ];

        for path in common_paths {
            if path.exists() {
                return Some(path);
            }
        }

        None
    }
}
```

### 6. Build Tasks Integration (6/10) ⚠️ OVERLY COMPLEX

**Current Plan Problems:**
- Complex shell scripts with environment variable expansion
- No error handling for missing tools
- Platform-specific logic in shell scripts

**Simpler Approach:**
```rust
impl zed::Extension for BasiliskExtension {
    fn language_server_command(&mut self, ...) -> Result<zed::Command> {
        // Generate build tasks dynamically
        let build_task = json!({
            "label": "Build with qcc",
            "command": self.qcc_path.to_string_lossy(),
            "args": [
                "-Wall", "-O2", "-disable-dimensions",
                "${file}", "-o", "${fileBasenameNoExtension}",
                "-lm"
            ],
            "group": "build",
            "presentation": {
                "echo": true,
                "reveal": "always",
                "focus": false,
                "panel": "terminal"
            }
        });

        // Write tasks.json to workspace
        self.write_build_tasks(build_task)?;
        Ok(clangd_command)
    }
}
```

---

## 🚨 Critical Risk Assessment

### HIGH RISK Issues

#### 1. **Shell Script Complexity** 🔥
Complex shell scripts are hard to debug and maintain
**Impact**: Hard to troubleshoot user issues
**Mitigation**: Do everything in Rust

#### 2. **Tree-sitter Fork Maintenance** ⚠️
Forking tree-sitter-c creates long-term maintenance burden
**Impact**: Grammar updates, bug fixes, compatibility
**Mitigation**: Start with standard tree-sitter-c

#### 3. **Compile Commands Performance** ⚠️
Regenerating compile_commands.json on every save
**Impact**: Editor lag, poor user experience
**Mitigation**: Smart caching, background processing

### MEDIUM RISK Issues

#### 1. **MPI/OpenMP Complexity**
Different build configurations for different parallelization
**Mitigation**: Detect automatically or use workspace settings

#### 2. **Cross-Platform Compatibility**
Scripts designed for Unix-like systems
**Mitigation**: Pure Rust implementation

---

## 🛠️ Recommended Implementation Phases

### Phase 1: MVP (2-3 weeks) - Basic LSP
**Goal**: Get basic IntelliSense working for Basilisk C files

```rust
// Minimal working extension
struct BasiliskExtension {
    qcc_path: Option<String>,
}

impl zed::Extension for BasiliskExtension {
    fn language_server_command(&mut self, ...) -> Result<zed::Command> {
        // Find qcc
        self.qcc_path = self.find_qcc(worktree);

        // Use standard clangd with Basilisk include paths
        Ok(zed::Command {
            command: "clangd".to_string(),
            args: vec![
                "--background-index".to_string(),
                format!("--query-driver={}", self.qcc_path.as_deref().unwrap_or("qcc")),
            ],
            env: self.get_basilisk_env_vars(),
        })
    }
}
```

**Success Criteria:**
- ✅ Basic code completion works
- ✅ Include path resolution works
- ✅ Error detection works
- ✅ Can build simple Basilisk programs

### Phase 2: Enhanced Integration (2-3 weeks)
**Goal**: Add compile_commands.json generation

```rust
impl BasiliskExtension {
    fn on_file_save(&mut self, file_path: &str) {
        if file_path.ends_with(".c") && self.is_basilisk_file(file_path) {
            self.update_compile_commands(file_path);
        }
    }

    fn update_compile_commands(&mut self, file_path: &str) {
        // Generate qcc command line
        let compile_cmd = format!(
            "{} -Wall -O2 -disable-dimensions {} -I{} -lm",
            self.qcc_path.as_ref().unwrap(),
            file_path,
            self.basilisk_include_path()
        );

        // Update compile_commands.json
        self.write_compile_database_entry(file_path, &compile_cmd);
    }
}
```

### Phase 3: Advanced Features (3-4 weeks)
**Goal**: Custom highlighting and build tasks

- Custom syntax highlighting for `event`, `foreach`, field access
- Build tasks for serial/OpenMP/MPI variants
- Better error diagnostics

### Phase 4: Polish (1-2 weeks)
**Goal**: Production ready

- Documentation
- Error handling
- Performance optimization
- User configuration options

---

## 💡 Practical Implementation Suggestions

### 1. Start with Working Examples
Test against real Basilisk files:
```bash
# Test with karman.c from examples
cp basilisk/src/examples/karman.c test_files/
# Ensure extension can:
# - Provide completions for u.x[], foreach(), event init
# - Build successfully with qcc
# - Show proper error diagnostics
```

### 2. Smart Basilisk Detection
```rust
fn is_basilisk_project(&self, worktree: &zed::Worktree) -> bool {
    // Check for characteristic include patterns
    let basilisk_includes = [
        "grid/quadtree.h",
        "navier-stokes/centered.h",
        "saint-venant.h",
        "embed.h"
    ];

    // Scan project files for basilisk includes
    for file in self.find_c_files(worktree) {
        let content = std::fs::read_to_string(file).unwrap_or_default();
        for include in &basilisk_includes {
            if content.contains(include) {
                return true;
            }
        }
    }
    false
}
```

### 3. Robust Error Handling
```rust
impl BasiliskExtension {
    fn ensure_basilisk_setup(&mut self) -> Result<(), String> {
        // Check qcc availability
        if self.qcc_path.is_none() {
            return Err("qcc not found. Please install Basilisk and ensure qcc is in PATH".to_string());
        }

        // Verify qcc works
        let output = std::process::Command::new(self.qcc_path.as_ref().unwrap())
            .arg("--version")
            .output()
            .map_err(|e| format!("Failed to run qcc: {}", e))?;

        if !output.status.success() {
            return Err("qcc found but not working properly".to_string());
        }

        Ok(())
    }
}
```

### 4. Configuration Management
```toml
# User's settings.json
{
  "basilisk": {
    "qccPath": "/custom/path/to/qcc",
    "basiliskRoot": "/custom/basilisk/installation",
    "buildVariant": "openmp", // "serial", "openmp", "mpi"
    "enableSemanticHighlighting": true
  }
}
```

---

## ✅ Success Criteria Checklist

### MVP Success Criteria
- [ ] Extension loads without errors in Zed
- [ ] Detects `.c` files as Basilisk C when appropriate
- [ ] Provides basic code completion for standard C
- [ ] Resolves includes from Basilisk installation
- [ ] Can compile simple Basilisk program with qcc
- [ ] Shows syntax highlighting (using standard C grammar)

### Full Success Criteria
- [ ] Smart Basilisk project detection
- [ ] Automatic qcc discovery from multiple locations
- [ ] compile_commands.json generation working
- [ ] Build tasks for serial/OpenMP/MPI variants
- [ ] Custom syntax highlighting for Basilisk constructs
- [ ] Error diagnostics from qcc compilation
- [ ] Works on macOS, Linux (Windows optional)
- [ ] Documentation for installation and usage

---

## 🎯 Final Recommendations

### 1. **SIMPLIFY FIRST, ENHANCE LATER**
The current plan tries to solve every problem at once. Start with basic clangd integration and build from there.

### 2. **NO SHELL SCRIPTS IN MVP**
Do everything in Rust for better error handling, debugging, and cross-platform compatibility.

### 3. **TEST WITH REAL EXAMPLES**
Use the karman.c and other examples from basilisk/src/examples/ as test cases throughout development.

### 4. **GET USER FEEDBACK EARLY**
Release a basic version to get feedback from Basilisk users before adding complex features.

### 5. **LEVERAGE EXISTING TOOLS**
Don't reinvent the wheel - use clangd's existing capabilities as much as possible.

### 6. **PLAN FOR MAINTENANCE**
Consider who will maintain this extension long-term and design accordingly.

---

## 🏆 Conclusion

The PLAN.md shows **exceptional research and understanding**. The core technical approach (qcc preprocessing + clangd) is brilliant and will work well.

**However**, the implementation is too complex for a first version. Success will come from:

1. **Starting simple** - MVP with basic clangd integration
2. **Iterating quickly** - Get user feedback early and often
3. **Focusing on core value** - Make Basilisk code completion work reliably
4. **Building incrementally** - Add advanced features only after core works

Your junior developer should be proud of this research. With some simplification and phased implementation, this will be an excellent extension for the Basilisk community!

**Next Step**: Implement the Phase 1 MVP and get it working with the karman.c example.
