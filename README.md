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

## How To Use qcc-lsp In Zed

### 1. Install this repository as a Zed dev extension

Open Zed command palette and install dev extension from this repository path:

```text
/Users/vatsal/1-github/1-LSPs/zed-qcc
```

### 2. Ensure bundled server files are available in Zed work dir

For dev installs, copy bundled server JS files into Zed extension work directory:

```bash
mkdir -p "/Users/vatsal/Library/Application Support/Zed/extensions/work/basilisk/lsp"
rsync -a --delete lsp/ "/Users/vatsal/Library/Application Support/Zed/extensions/work/basilisk/lsp/"
```

### 3. Configure Zed settings (`~/.config/zed/settings.json`)

Use Node + bundled server entrypoint:

```json
{
  "lsp": {
    "qcc-lsp": {
      "binary": {
        "path": "/Users/vatsal/.nvm/versions/node/v22.16.0/bin/node",
        "arguments": [
          "/Users/vatsal/Library/Application Support/Zed/extensions/work/basilisk/lsp/server.js",
          "--stdio"
        ]
      },
      "settings": {
        "qccPath": "qcc",
        "basiliskPath": "/Users/vatsal/CMP-codes/basilisk",
        "clangd": {
          "mode": "proxy"
        }
      }
    }
  }
}
```

Server options under `lsp.qcc-lsp.settings` are forwarded to the language server as the `basilisk` section.

### 4. Open Basilisk files

- Open `.c` or `.h` file.
- Confirm language is `Basilisk C` in the status bar.
- If needed, select language manually once; `.c/.h` association is included in this extension.

## Language Association

The extension associates `.c` and `.h` with `Basilisk C` in extension metadata.

## Troubleshooting

- `qcc` not found:
  - Set `lsp.qcc-lsp.settings.qccPath` to an explicit binary path.
- Basilisk headers unresolved:
  - Set `lsp.qcc-lsp.settings.basiliskPath` and/or `qcc.includePaths`.
- `bundled qcc-lsp entrypoint not found`:
  - Re-sync `lsp/` into `/Users/vatsal/Library/Application Support/Zed/extensions/work/basilisk/lsp/`.
- `Connection input stream is not set`:
  - Ensure server launch includes `--stdio`.
- `Unknown command: --stdio`:
  - Do not point `binary.path` to CLI `qcc-lsp`; use Node + `server.js` as shown above.
- clangd fallback behavior:
  - Use `lsp.qcc-lsp.settings.clangd.mode` (`proxy`, `augment`, `disabled`).
- Project-local overrides:
  - `.comphy-basilisk` remains supported by `qcc-lsp` itself.

## Scope

This revamp intentionally focuses on LSP integration and language support only.
Compile/run helper commands are intentionally out of scope in this extension.
