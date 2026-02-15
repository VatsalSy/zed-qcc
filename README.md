# zed-qcc

Basilisk C support for Zed, powered by `qcc-lsp`.

This extension runs the Node-based `qcc-lsp` language server directly (not a clangd wrapper), while keeping Basilisk language registration and tree-sitter query support in this repository.

## Architecture

- Bundled server snapshot: `lsp/*.js`
- Extension runtime: `src/lib.rs`
- Language metadata and queries: `languages/basilisk/`
- Server settings key in Zed: `lsp.qcc-lsp`

The extension bootstraps these runtime npm dependencies in the extension work directory:

- `vscode-languageserver@9.0.1`
- `vscode-languageserver-textdocument@1.0.12`
- `vscode-uri@3.1.0`

## Updating Bundled Server Snapshot

Use:

```bash
scripts/sync-qcc-lsp-server.sh
```

Optional source override:

```bash
scripts/sync-qcc-lsp-server.sh /path/to/qcc-lsp
```

Snapshot provenance is recorded in:

- `lsp/UPSTREAM.txt`

## Zed Configuration

### Server settings

Configure server behavior under `lsp.qcc-lsp.settings`.
These settings are forwarded as workspace config under the server section `basilisk`.

Example:

```json
{
  "lsp": {
    "qcc-lsp": {
      "settings": {
        "qccPath": "qcc",
        "basiliskPath": "/path/to/basilisk/src",
        "enableDiagnostics": true,
        "diagnosticsOnSave": true,
        "diagnosticsOnType": false,
        "maxNumberOfProblems": 100,
        "qcc": {
          "includePaths": ["src-local"]
        },
        "clangd": {
          "enabled": true,
          "mode": "proxy",
          "path": "clangd",
          "args": [],
          "compileCommandsDir": "",
          "fallbackFlags": [],
          "diagnosticsMode": "filtered"
        }
      }
    }
  }
}
```

### Optional binary override

If you want to run a custom server binary/command instead of bundled `lsp/server.js`:

```json
{
  "lsp": {
    "qcc-lsp": {
      "binary": {
        "path": "/absolute/path/to/node-or-server-command",
        "arguments": ["/absolute/path/to/server.js", "--stdio"],
        "env": {
          "BASILISK": "/path/to/basilisk/src"
        }
      }
    }
  }
}
```

## Language Association

The extension associates `.c` and `.h` with `Basilisk C` in extension metadata.

## Troubleshooting

- `qcc` not found:
  - Set `lsp.qcc-lsp.settings.qccPath` to an explicit binary path.
- Basilisk headers unresolved:
  - Set `lsp.qcc-lsp.settings.basiliskPath` and/or `qcc.includePaths`.
- clangd fallback behavior:
  - Use `lsp.qcc-lsp.settings.clangd.mode` (`proxy`, `augment`, `disabled`).
- Project-local overrides:
  - `.comphy-basilisk` remains supported by `qcc-lsp` itself.

## Scope

This revamp intentionally focuses on LSP integration and language support only.
Compile/run helper commands are intentionally out of scope in this extension.
