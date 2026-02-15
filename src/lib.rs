use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use zed::serde_json::{json, Value};
use zed::settings::LspSettings;
use zed_extension_api::{self as zed, LanguageServerId, Result};

const SERVER_ID: &str = "qcc-lsp";
const EXTENSION_ID: &str = "zed-qcc";
const BUNDLED_SERVER_PATH: &str = "lsp/server.js";
const DEFAULT_CLANGD_MODE: &str = "proxy";

const REQUIRED_NPM_PACKAGES: [(&str, &str); 3] = [
    ("vscode-languageserver", "9.0.1"),
    ("vscode-languageserver-textdocument", "1.0.12"),
    ("vscode-uri", "3.1.0"),
];

struct ZedQccExtension {
    dependencies_ready: bool,
}

impl ZedQccExtension {
    fn new() -> Self {
        Self {
            dependencies_ready: false,
        }
    }

    fn ensure_node_dependencies(&mut self, language_server_id: &LanguageServerId) -> Result<()> {
        if self.dependencies_ready {
            return Ok(());
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        for (package, version) in REQUIRED_NPM_PACKAGES {
            let installed = zed::npm_package_installed_version(package)?;
            if installed.as_deref() == Some(version) {
                continue;
            }

            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );

            let install_error = zed::npm_install_package(package, version).err();
            let resolved_version = zed::npm_package_installed_version(package)?;
            if resolved_version.as_deref() != Some(version) {
                let found = resolved_version.unwrap_or_else(|| "not installed".to_string());
                let message = if let Some(err) = install_error {
                    format!(
                        "failed to install required npm package '{package}@{version}': {err}; found '{found}'"
                    )
                } else {
                    format!(
                        "required npm package '{package}@{version}' is unavailable after install attempt; found '{found}'"
                    )
                };
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Failed(message.clone()),
                );
                return Err(message);
            }
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::None,
        );

        self.dependencies_ready = true;
        Ok(())
    }

    fn bundled_server_path(&self, language_server_id: &LanguageServerId) -> Result<String> {
        let current_dir = sanitize_windows_path(env::current_dir().map_err(|err| err.to_string())?);

        let mut candidates = vec![current_dir.join(BUNDLED_SERVER_PATH)];
        if let Some(installed_path) = installed_extension_server_path(&current_dir) {
            candidates.push(installed_path);
        }

        for candidate in candidates.iter() {
            if fs::metadata(candidate).is_ok_and(|meta| meta.is_file()) {
                return Ok(candidate.to_string_lossy().to_string());
            }
        }

        let searched_paths = candidates
            .iter()
            .map(|path| format!("'{}'", path.display()))
            .collect::<Vec<_>>()
            .join(", ");
        let message = format!("bundled qcc-lsp entrypoint not found (searched {searched_paths})");

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::Failed(message.clone()),
        );

        Err(message)
    }

    fn resolve_user_binary_path(path: &str, worktree: &zed::Worktree) -> String {
        let path_obj = Path::new(path);
        if path_obj.is_absolute() {
            return path.to_string();
        }

        if let Some(found) = worktree.which(path) {
            return found;
        }

        let worktree_candidate = PathBuf::from(worktree.root_path()).join(path);
        worktree_candidate.to_string_lossy().to_string()
    }

    fn command_from_user_binary(
        &self,
        binary: zed::settings::CommandSettings,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let raw_path = binary
            .path
            .ok_or_else(|| "lsp.qcc-lsp.binary.path is empty".to_string())?;

        let command = Self::resolve_user_binary_path(&raw_path, worktree);
        let args = binary.arguments.unwrap_or_default();
        let env = binary
            .env
            .unwrap_or_default()
            .into_iter()
            .collect::<Vec<(String, String)>>();

        Ok(zed::Command { command, args, env })
    }

    fn get_lsp_settings(worktree: &zed::Worktree) -> zed::settings::LspSettings {
        LspSettings::for_worktree(SERVER_ID, worktree).unwrap_or_default()
    }
}

impl zed::Extension for ZedQccExtension {
    fn new() -> Self {
        ZedQccExtension::new()
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let settings = Self::get_lsp_settings(worktree);
        if let Some(binary) = settings.binary {
            return self.command_from_user_binary(binary, worktree);
        }

        self.ensure_node_dependencies(language_server_id)?;

        let node = zed::node_binary_path()?;
        let server_script = self.bundled_server_path(language_server_id)?;

        Ok(zed::Command {
            command: node,
            args: vec![server_script, "--stdio".to_string()],
            env: vec![],
        })
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<Value>> {
        let settings = Self::get_lsp_settings(worktree);
        let mode = extract_clangd_mode(settings.settings.as_ref());

        let mut init_options = settings.initialization_options.unwrap_or_else(|| json!({}));
        if !init_options.is_object() {
            init_options = json!({});
        }

        let mode_override = json!({
            "basilisk": {
                "clangd": {
                    "mode": mode,
                }
            }
        });

        merge_json(&mut init_options, mode_override);
        Ok(Some(init_options))
    }

    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<Value>> {
        let settings = Self::get_lsp_settings(worktree);
        let mode = extract_clangd_mode(settings.settings.as_ref());
        let mut user_settings = settings.settings.unwrap_or_else(|| json!({}));
        if !user_settings.is_object() {
            user_settings = json!({});
        }

        if let Value::Object(root) = &mut user_settings {
            let clangd_value = root
                .entry("clangd".to_string())
                .or_insert_with(|| json!({}));
            if !clangd_value.is_object() {
                *clangd_value = json!({});
            }
            if let Value::Object(clangd_obj) = clangd_value {
                clangd_obj.insert("mode".to_string(), Value::String(mode));
            }
        }

        Ok(Some(json!({
            "basilisk": user_settings,
        })))
    }
}

fn extract_clangd_mode(settings: Option<&Value>) -> String {
    settings
        .and_then(|value| value.get("clangd"))
        .and_then(|value| value.get("mode"))
        .and_then(Value::as_str)
        .filter(|mode| matches!(*mode, "proxy" | "augment" | "disabled"))
        .unwrap_or(DEFAULT_CLANGD_MODE)
        .to_string()
}

fn merge_json(base: &mut Value, overlay: Value) {
    match (base, overlay) {
        (Value::Object(base_obj), Value::Object(overlay_obj)) => {
            for (key, overlay_value) in overlay_obj {
                if let Some(base_value) = base_obj.get_mut(&key) {
                    merge_json(base_value, overlay_value);
                } else {
                    base_obj.insert(key, overlay_value);
                }
            }
        }
        (base_value, overlay_value) => {
            *base_value = overlay_value;
        }
    }
}

/// Sanitizes the given path to remove the leading `/` on Windows.
///
/// On macOS and Linux this is a no-op.
///
/// This is a workaround for https://github.com/bytecodealliance/wasmtime/issues/10415.
fn sanitize_windows_path(path: PathBuf) -> PathBuf {
    use zed_extension_api::{current_platform, Os};

    let (os, _arch) = current_platform();
    match os {
        Os::Mac | Os::Linux => path,
        Os::Windows => path
            .to_string_lossy()
            .to_string()
            .trim_start_matches('/')
            .into(),
    }
}

fn installed_extension_server_path(work_dir: &Path) -> Option<PathBuf> {
    if work_dir.file_name()?.to_str()? != EXTENSION_ID {
        return None;
    }

    let work_parent = work_dir.parent()?;
    if work_parent.file_name()?.to_str()? != "work" {
        return None;
    }

    let extensions_root = work_parent.parent()?;
    Some(
        extensions_root
            .join("installed")
            .join(EXTENSION_ID)
            .join(BUNDLED_SERVER_PATH),
    )
}

zed::register_extension!(ZedQccExtension);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clangd_mode_defaults_to_proxy() {
        let mode = extract_clangd_mode(None);
        assert_eq!(mode, "proxy");
    }

    #[test]
    fn clangd_mode_accepts_valid_values() {
        let settings = json!({
            "clangd": {
                "mode": "augment"
            }
        });
        let mode = extract_clangd_mode(Some(&settings));
        assert_eq!(mode, "augment");
    }

    #[test]
    fn clangd_mode_rejects_invalid_values() {
        let settings = json!({
            "clangd": {
                "mode": "random"
            }
        });
        let mode = extract_clangd_mode(Some(&settings));
        assert_eq!(mode, "proxy");
    }

    #[test]
    fn merge_json_overlays_nested_values() {
        let mut base = json!({
            "basilisk": {
                "clangd": {
                    "mode": "proxy",
                    "enabled": true
                }
            }
        });

        let overlay = json!({
            "basilisk": {
                "clangd": {
                    "mode": "augment"
                }
            }
        });

        merge_json(&mut base, overlay);

        assert_eq!(
            base,
            json!({
                "basilisk": {
                    "clangd": {
                        "mode": "augment",
                        "enabled": true
                    }
                }
            })
        );
    }
}
