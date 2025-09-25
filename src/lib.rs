use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::Serialize;
use walkdir::{DirEntry, WalkDir};
use zed_extension_api as zed;

struct BasiliskExtension {
    clangd_path: Option<String>,
    qcc_path: Option<PathBuf>,
    basilisk_root: Option<PathBuf>,
}

impl BasiliskExtension {
    fn new() -> Self {
        Self {
            clangd_path: None,
            qcc_path: None,
            basilisk_root: None,
        }
    }

    fn normalize_basilisk_root(path: PathBuf) -> Option<PathBuf> {
        if path.join("Makefile.defs").is_file() {
            return Some(path);
        }

        let src_candidate = path.join("src");
        if src_candidate.join("Makefile.defs").is_file() {
            return Some(src_candidate);
        }

        None
    }

    fn detect_environment(&mut self, worktree: &zed::Worktree) -> Result<()> {
        if self.clangd_path.is_none() {
            if let Some(path) = worktree.which("clangd") {
                self.clangd_path = Some(path);
            }
        }

        if self.qcc_path.is_none() {
            self.qcc_path = Self::find_qcc(worktree);
        }

        if self.basilisk_root.is_none() {
            self.basilisk_root = Self::detect_basilisk_root(worktree);
        }

        Ok(())
    }

    fn find_qcc(worktree: &zed::Worktree) -> Option<PathBuf> {
        if let Some(path) = worktree.which("qcc") {
            return Some(PathBuf::from(path));
        }

        if let Ok(path) = std::env::var("QCC_PATH") {
            if !path.is_empty() {
                let candidate = PathBuf::from(path);
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }

        if let Ok(root) = std::env::var("BASILISK") {
            if let Some(include_dir) = Self::normalize_basilisk_root(PathBuf::from(root)) {
                let candidate = include_dir.join("qcc");
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }

        if let Ok(home) = std::env::var("HOME") {
            let home_path = PathBuf::from(home);
            for candidate in [home_path.join("basilisk"), home_path.join("basilisk/src")] {
                if let Some(include_dir) = Self::normalize_basilisk_root(candidate) {
                    let qcc = include_dir.join("qcc");
                    if qcc.exists() {
                        return Some(qcc);
                    }
                }
            }
        }

        let repo_root = PathBuf::from(worktree.root_path());
        for candidate in [repo_root.join("basilisk"), repo_root.join("basilisk/src")] {
            if let Some(include_dir) = Self::normalize_basilisk_root(candidate) {
                let qcc = include_dir.join("qcc");
                if qcc.exists() {
                    return Some(qcc);
                }
            }
        }

        None
    }

    fn detect_basilisk_root(worktree: &zed::Worktree) -> Option<PathBuf> {
        if let Ok(path) = std::env::var("BASILISK") {
            if let Some(include_dir) = Self::normalize_basilisk_root(PathBuf::from(path)) {
                return Some(include_dir);
            }
        }

        let repo_root = PathBuf::from(worktree.root_path());
        for candidate in [repo_root.join("basilisk"), repo_root.join("basilisk/src")] {
            if let Some(include_dir) = Self::normalize_basilisk_root(candidate) {
                return Some(include_dir);
            }
        }

        if let Ok(home) = std::env::var("HOME") {
            let home_path = PathBuf::from(home);
            for candidate in [home_path.join("basilisk"), home_path.join("basilisk/src")] {
                if let Some(include_dir) = Self::normalize_basilisk_root(candidate) {
                    return Some(include_dir);
                }
            }
        }

        None
    }

    fn refresh_compile_commands(&self, worktree: &zed::Worktree) -> Result<()> {
        let root_path = PathBuf::from(worktree.root_path());
        let build_dir = root_path.join("build");
        std::fs::create_dir_all(&build_dir).with_context(|| {
            format!(
                "unable to create build directory at {}",
                build_dir.display()
            )
        })?;

        let compile_db_path = build_dir.join("compile_commands.json");

        let qcc_binary = self
            .qcc_path
            .as_ref()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|| "qcc".to_string());

        let include_flag = self
            .basilisk_root
            .as_ref()
            .map(|path| format!("-I{}", path.display()));

        #[derive(Serialize)]
        struct CompileCommand {
            directory: String,
            file: String,
            command: String,
        }

        let mut entries = Vec::new();
        for entry in WalkDir::new(&root_path)
            .into_iter()
            .filter_entry(Self::is_included_directory)
        {
            let entry = entry.with_context(|| "unable to walk workspace")?;
            if !entry.file_type().is_file() {
                continue;
            }
            if entry.path().extension().and_then(|ext| ext.to_str()) != Some("c") {
                continue;
            }

            let file_path = entry.into_path();
            let Some(parent) = file_path.parent() else {
                continue;
            };

            let output_path = parent.join(file_path.file_stem().unwrap_or_default());

            let mut command = format!(
                "{qcc} -Wall -O2 -disable-dimensions {file} -o {output} -lm",
                qcc = qcc_binary,
                file = Self::quote_path(&file_path),
                output = Self::quote_path(&output_path),
            );

            if let Some(flag) = &include_flag {
                command.push(' ');
                command.push_str(flag);
            }

            entries.push(CompileCommand {
                directory: parent.display().to_string(),
                file: file_path.display().to_string(),
                command,
            });
        }

        if entries.is_empty() {
            if !compile_db_path.exists() {
                std::fs::write(&compile_db_path, "[]")
                    .with_context(|| format!("failed to seed {}", compile_db_path.display()))?;
            }
        } else {
            let payload = serde_json::to_string_pretty(&entries)
                .with_context(|| "unable to serialize compile_commands.json")?;
            std::fs::write(&compile_db_path, payload)
                .with_context(|| format!("failed to write {}", compile_db_path.display()))?;
        }

        Ok(())
    }

    fn is_included_directory(entry: &DirEntry) -> bool {
        let name = entry.file_name().to_string_lossy();
        matches!(name.as_ref(), "." | "..")
            || !matches!(name.as_ref(), "target" | "build" | ".git" | "node_modules")
    }

    fn quote_path(path: &Path) -> String {
        format!("\"{}\"", path.display())
    }
}

impl zed::Extension for BasiliskExtension {
    fn new() -> Self {
        BasiliskExtension::new()
    }

    fn language_server_command(
        &mut self,
        _id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        self.detect_environment(worktree)
            .map_err(|err| err.to_string())?;
        self.refresh_compile_commands(worktree)
            .map_err(|err| err.to_string())?;

        let clangd = self
            .clangd_path
            .clone()
            .unwrap_or_else(|| "clangd".to_string());

        let mut args = vec![
            "--background-index".to_string(),
            "--clang-tidy".to_string(),
            "--header-insertion=never".to_string(),
            format!("--compile-commands-dir={}/build", worktree.root_path()),
        ];

        if let Some(qcc) = &self.qcc_path {
            args.push(format!("--query-driver={}", qcc.display()));
        }

        let mut env_entries = Vec::new();
        if let Some(root) = &self.basilisk_root {
            env_entries.push(("BASILISK_ROOT".to_string(), root.display().to_string()));
        }

        Ok(zed::Command {
            command: clangd,
            args,
            env: env_entries,
        })
    }

    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<Option<serde_json::Value>> {
        let mut fallback_flags = vec![
            "-std=c99".to_string(),
            "-Wall".to_string(),
            "-Wextra".to_string(),
        ];
        if let Some(root) = &self.basilisk_root {
            fallback_flags.push(format!("-I{}", root.display()));
        }

        let config = serde_json::json!({
            "clangd": {
                "fallbackFlags": fallback_flags,
            }
        });

        Ok(Some(config))
    }
}

zed::register_extension!(BasiliskExtension);
