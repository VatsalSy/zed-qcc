"use strict";
/**
 * qcc-lsp CLI Entrypoint
 *
 * Command-line interface for running Basilisk C diagnostics with qcc and clangd.
 * Supports `check <file>` for diagnostics and `doctor` for environment checks.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const vscode_uri_1 = require("vscode-uri");
const node_1 = require("vscode-languageserver/node");
const diagnostics_1 = require("./diagnostics");
const projectConfig_1 = require("./projectConfig");
const clangdClient_1 = require("./clangdClient");
const clangdConfig_1 = require("./clangdConfig");
const pathUtils_1 = require("./pathUtils");
const basiliskDetect_1 = require("./basiliskDetect");
function printHelp() {
    const message = `
Usage:
  qcc-lsp check <file> [options]
  qcc-lsp doctor [options]

Options:
  --json                       Output diagnostics as JSON
  --max-problems <n>            Max diagnostics to report (default: 100)
  --qcc-path <path>             Path to qcc (default: qcc)
  --basilisk-path <path>        Basilisk root path (overrides BASILISK env)
  --project-config <path>       Path to a .comphy-basilisk file
  --no-qcc                      Disable qcc diagnostics
  --qcc-include <dir>           Additional include path for qcc (repeatable)
  --clangd                      Enable clangd (default)
  --no-clangd                   Disable clangd
  --clangd-path <path>          Path to clangd (default: clangd)
  --clangd-arg <arg>            Extra clangd arg (repeatable)
  --compile-commands-dir <dir>  Directory containing compile_commands.json
  --fallback-flag <flag>        Extra clangd fallback flag (repeatable)
  --clangd-diagnostics <mode>   clangd diagnostics: all | filtered | none
  --wrap-header                 Wrap headers in a temporary translation unit
  --wrap-include <header>       Add an extra include before the header (repeatable)
  --verbose                     Verbose logging
  -h, --help                    Show this help

Notes:
  - .comphy-basilisk is loaded automatically if found in the directory tree.
  - --project-config overrides auto-discovery; missing files are treated as errors.
`;
    process.stdout.write(message.trimStart());
}
function createBaseOptions() {
    return {
        format: 'text',
        maxProblems: diagnostics_1.defaultSettings.maxNumberOfProblems,
        qccPath: diagnostics_1.defaultSettings.qccPath,
        basiliskPath: diagnostics_1.defaultSettings.basiliskPath,
        enableQcc: diagnostics_1.defaultSettings.enableDiagnostics,
        qccIncludePaths: [],
        clangdEnabled: diagnostics_1.defaultSettings.clangd.enabled,
        clangdPath: diagnostics_1.defaultSettings.clangd.path,
        clangdArgs: [],
        compileCommandsDir: diagnostics_1.defaultSettings.clangd.compileCommandsDir,
        fallbackFlags: [],
        clangdDiagnosticsMode: diagnostics_1.defaultSettings.clangd.diagnosticsMode,
        wrapHeader: false,
        wrapIncludes: [],
        verbose: false,
        explicit: new Set(),
        projectConfigPath: null
    };
}
function parseFlags(argv, startIndex, options) {
    const requireValue = (flag, index) => {
        const value = argv[index + 1];
        if (value === undefined) {
            process.stderr.write(`Missing value for ${flag}\n`);
            process.exitCode = 1;
            return null;
        }
        return value;
    };
    for (let i = startIndex; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--json':
                options.format = 'json';
                break;
            case '--max-problems': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.maxProblems = Number.parseInt(value, 10);
                options.explicit.add('maxProblems');
                i++;
                break;
            }
            case '--qcc-path': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.qccPath = value;
                options.explicit.add('qccPath');
                i++;
                break;
            }
            case '--basilisk-path': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.basiliskPath = value;
                options.explicit.add('basiliskPath');
                i++;
                break;
            }
            case '--project-config': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.projectConfigPath = value;
                i++;
                break;
            }
            case '--no-qcc':
                options.enableQcc = false;
                options.explicit.add('enableQcc');
                break;
            case '--qcc-include': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.qccIncludePaths.push(value);
                options.explicit.add('qccIncludePaths');
                i++;
                break;
            }
            case '--clangd':
                options.clangdEnabled = true;
                options.explicit.add('clangdEnabled');
                break;
            case '--no-clangd':
                options.clangdEnabled = false;
                options.explicit.add('clangdEnabled');
                break;
            case '--clangd-path': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.clangdPath = value;
                options.explicit.add('clangdPath');
                i++;
                break;
            }
            case '--clangd-arg': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.clangdArgs.push(value);
                options.explicit.add('clangdArgs');
                i++;
                break;
            }
            case '--compile-commands-dir': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.compileCommandsDir = value;
                options.explicit.add('compileCommandsDir');
                i++;
                break;
            }
            case '--fallback-flag': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.fallbackFlags.push(value);
                options.explicit.add('fallbackFlags');
                i++;
                break;
            }
            case '--clangd-diagnostics': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                if (value === 'all' || value === 'filtered' || value === 'none') {
                    options.clangdDiagnosticsMode = value;
                    options.explicit.add('clangdDiagnosticsMode');
                }
                else {
                    process.stderr.write(`Invalid --clangd-diagnostics value: ${value}\n`);
                    process.exitCode = 1;
                    return false;
                }
                i++;
                break;
            }
            case '--wrap-header':
                options.wrapHeader = true;
                break;
            case '--wrap-include': {
                const value = requireValue(arg, i);
                if (!value) {
                    return false;
                }
                options.wrapIncludes.push(value);
                i++;
                break;
            }
            case '--verbose':
                options.verbose = true;
                break;
            case '-h':
            case '--help':
                printHelp();
                return false;
            default:
                process.stderr.write(`Unknown option: ${arg}\n`);
                printHelp();
                process.exitCode = 1;
                return false;
        }
    }
    if (Number.isNaN(options.maxProblems) || options.maxProblems <= 0) {
        options.maxProblems = diagnostics_1.defaultSettings.maxNumberOfProblems;
    }
    return true;
}
function parseArgs(argv) {
    if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
        printHelp();
        return null;
    }
    const command = argv[0];
    if (command !== 'check' && command !== 'doctor') {
        process.stderr.write(`Unknown command: ${command}\n`);
        printHelp();
        process.exitCode = 1;
        return null;
    }
    const baseOptions = createBaseOptions();
    if (command === 'doctor') {
        const ok = parseFlags(argv, 1, baseOptions);
        if (!ok) {
            return null;
        }
        return { command: 'doctor', options: baseOptions };
    }
    const filePath = argv[1];
    if (!filePath) {
        process.stderr.write('Missing file path.\n');
        printHelp();
        process.exitCode = 1;
        return null;
    }
    const options = {
        ...baseOptions,
        filePath
    };
    const ok = parseFlags(argv, 2, options);
    if (!ok) {
        return null;
    }
    return { command: 'check', options };
}
function mergeStringArrays(primary, secondary) {
    if (!secondary || secondary.length === 0) {
        return primary;
    }
    const seen = new Set();
    const merged = [];
    for (const entry of [...primary, ...secondary]) {
        if (!entry || seen.has(entry)) {
            continue;
        }
        seen.add(entry);
        merged.push(entry);
    }
    return merged;
}
function resolveCliPath(value) {
    const expanded = value.startsWith('~')
        ? path.join(os.homedir(), value.slice(1))
        : value;
    return path.isAbsolute(expanded) ? expanded : path.resolve(process.cwd(), expanded);
}
function resolveCliPaths(values) {
    return values.map(resolveCliPath);
}
function mergeSettings(base, partial) {
    const mergedQcc = {
        ...base.qcc,
        ...(partial.qcc || {})
    };
    mergedQcc.includePaths = mergeStringArrays(base.qcc?.includePaths ?? [], partial.qcc?.includePaths);
    return {
        ...base,
        ...partial,
        qcc: mergedQcc,
        clangd: {
            ...base.clangd,
            ...(partial.clangd || {})
        }
    };
}
function projectConfigToSettings(config) {
    const partial = {};
    if (config.qccPath) {
        partial.qccPath = config.qccPath;
    }
    if (config.basiliskPath) {
        partial.basiliskPath = config.basiliskPath;
    }
    if (config.qcc?.includePaths) {
        partial.qcc = { includePaths: config.qcc.includePaths };
    }
    if (config.clangd) {
        partial.clangd = { ...config.clangd };
    }
    return partial;
}
function applyProjectConfig(base, startDir, configPath, verbose) {
    if (!startDir && !configPath) {
        return base;
    }
    const result = configPath
        ? (0, projectConfig_1.loadProjectConfigFromFile)(configPath)
        : (startDir ? (0, projectConfig_1.loadProjectConfig)(startDir) : { path: null, config: null });
    if (result.error && result.path) {
        const message = `Failed to parse ${result.path}: ${result.error}`;
        if (configPath || verbose) {
            process.stderr.write(`${message}\n`);
        }
        if (configPath) {
            process.exitCode = 2;
        }
    }
    if (!result.config) {
        return base;
    }
    return mergeSettings(base, projectConfigToSettings(result.config));
}
function buildOverrides(options) {
    const overrides = {};
    if (options.explicit.has('qccPath')) {
        overrides.qccPath = options.qccPath;
    }
    if (options.explicit.has('basiliskPath')) {
        overrides.basiliskPath = options.basiliskPath;
    }
    if (options.explicit.has('enableQcc')) {
        overrides.enableDiagnostics = options.enableQcc;
    }
    if (options.explicit.has('maxProblems')) {
        overrides.maxNumberOfProblems = options.maxProblems;
    }
    if (options.explicit.has('qccIncludePaths')) {
        overrides.qcc = { includePaths: resolveCliPaths(options.qccIncludePaths) };
    }
    if (options.explicit.has('clangdEnabled')) {
        overrides.clangd = {
            ...(overrides.clangd || {}),
            enabled: options.clangdEnabled,
            mode: options.clangdEnabled ? 'proxy' : 'disabled'
        };
    }
    if (options.explicit.has('clangdPath')) {
        overrides.clangd = {
            ...(overrides.clangd || {}),
            path: options.clangdPath
        };
    }
    if (options.explicit.has('clangdArgs')) {
        overrides.clangd = {
            ...(overrides.clangd || {}),
            args: options.clangdArgs
        };
    }
    if (options.explicit.has('compileCommandsDir')) {
        overrides.clangd = {
            ...(overrides.clangd || {}),
            compileCommandsDir: options.compileCommandsDir
        };
    }
    if (options.explicit.has('fallbackFlags')) {
        overrides.clangd = {
            ...(overrides.clangd || {}),
            fallbackFlags: options.fallbackFlags
        };
    }
    if (options.explicit.has('clangdDiagnosticsMode')) {
        overrides.clangd = {
            ...(overrides.clangd || {}),
            diagnosticsMode: options.clangdDiagnosticsMode
        };
    }
    return overrides;
}
function buildSettings(options, startDir) {
    let settings = applyProjectConfig(diagnostics_1.defaultSettings, startDir, options.projectConfigPath, options.verbose);
    settings = mergeSettings(settings, buildOverrides(options));
    return settings;
}
function formatDiagnostic(filePath, diagnostic) {
    const line = diagnostic.range.start.line + 1;
    const col = diagnostic.range.start.character + 1;
    const severity = diagnostic.severity === node_1.DiagnosticSeverity.Error
        ? 'error'
        : diagnostic.severity === node_1.DiagnosticSeverity.Warning
            ? 'warning'
            : diagnostic.severity === node_1.DiagnosticSeverity.Information
                ? 'info'
                : 'hint';
    const source = diagnostic.source ? `${diagnostic.source}: ` : '';
    return `${filePath}:${line}:${col}: ${severity}: ${source}${diagnostic.message}`;
}
function dedupeDiagnostics(diagnostics) {
    const seen = new Set();
    const result = [];
    for (const diagnostic of diagnostics) {
        const key = [
            diagnostic.range.start.line,
            diagnostic.range.start.character,
            diagnostic.range.end.line,
            diagnostic.range.end.character,
            diagnostic.severity ?? '',
            diagnostic.message,
            diagnostic.source ?? ''
        ].join(':');
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(diagnostic);
    }
    return result;
}
async function runClangdDiagnostics(filePath, fileUri, content, settings, verbose) {
    const rootDir = path.dirname(filePath);
    const rootUri = vscode_uri_1.URI.file(rootDir).toString();
    const basiliskRoot = (0, clangdConfig_1.resolveBasiliskRoot)(settings, rootDir);
    const compileCommandsDir = (0, clangdConfig_1.resolvePathSetting)(settings.clangd.compileCommandsDir, rootDir) ||
        (basiliskRoot ? basiliskRoot : '');
    const args = [...settings.clangd.args];
    if (compileCommandsDir) {
        args.push(`--compile-commands-dir=${compileCommandsDir}`);
    }
    const fallbackFlags = (0, clangdConfig_1.mergeFlags)(settings.clangd.fallbackFlags, (0, clangdConfig_1.deriveBasiliskFallbackFlags)(basiliskRoot));
    const client = new clangdClient_1.ClangdClient({
        path: settings.clangd.path,
        args,
        rootUri,
        workspaceFolders: null,
        fallbackFlags
    }, {
        info: (message) => {
            if (verbose && message.trim()) {
                process.stderr.write(`[clangd] ${message}\n`);
            }
        },
        warn: (message) => {
            process.stderr.write(`[clangd] ${message}\n`);
        },
        error: (message) => {
            process.stderr.write(`[clangd] ${message}\n`);
        }
    });
    let diagnosticsResolve = null;
    const diagnosticsPromise = new Promise((resolve) => {
        diagnosticsResolve = resolve;
    });
    client.onDiagnostics((uri, diagnostics) => {
        if (uri === fileUri) {
            diagnosticsResolve?.(diagnostics || []);
        }
    });
    const initParams = {
        processId: process.pid,
        rootUri,
        capabilities: {}
    };
    await client.start(initParams);
    if (!client.isReady()) {
        await client.stop();
        throw new Error('clangd failed to initialize');
    }
    client.notify('textDocument/didOpen', {
        textDocument: {
            uri: fileUri,
            languageId: 'c',
            version: 1,
            text: content
        }
    });
    const timeoutMs = 4000;
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve([]), timeoutMs);
    });
    const diagnostics = await Promise.race([diagnosticsPromise, timeoutPromise]);
    await client.stop();
    const normalized = diagnostics.map((diagnostic) => ({
        ...diagnostic,
        source: diagnostic.source || 'clangd'
    }));
    if (settings.clangd.diagnosticsMode === 'none') {
        return [];
    }
    if (settings.clangd.diagnosticsMode === 'filtered') {
        return (0, basiliskDetect_1.filterClangdDiagnostics)(normalized, content);
    }
    return normalized;
}
function buildHeaderWrapper(filePath, wrapIncludes) {
    const headerPath = path.resolve(filePath).replace(/\\/g, '/');
    const includes = wrapIncludes.length > 0 ? wrapIncludes : ['run.h'];
    const lines = includes.map((include) => `#include "${include}"`);
    lines.push(`#include "${headerPath}"`);
    lines.push('int main() { return 0; }');
    return `${lines.join('\n')}\n`;
}
async function runDoctor(options) {
    const settings = buildSettings(options, process.cwd());
    if (options.projectConfigPath && process.exitCode === 2) {
        return;
    }
    const cwd = process.cwd();
    const qccResolved = (0, diagnostics_1.resolveQccPath)(settings) || settings.qccPath;
    const qccAvailable = qccResolved ? await (0, diagnostics_1.checkQccAvailable)(qccResolved) : false;
    const clangdResolved = settings.clangd.enabled
        ? (0, pathUtils_1.resolveExecutableOnPath)(settings.clangd.path) || settings.clangd.path
        : null;
    const basiliskRoot = (0, clangdConfig_1.resolveBasiliskRoot)(settings, cwd);
    const clangdWillRun = settings.clangd.enabled && settings.clangd.mode === 'proxy' && !qccAvailable;
    const qccLabel = settings.enableDiagnostics
        ? (qccAvailable ? `qcc=found(${qccResolved})` : `qcc=missing(${settings.qccPath})`)
        : 'qcc=disabled';
    const clangdLabel = settings.clangd.enabled
        ? (clangdResolved ? `clangd=found(${clangdResolved})` : `clangd=missing(${settings.clangd.path})`)
        : 'clangd=disabled';
    const basiliskLabel = basiliskRoot ? `basilisk=${basiliskRoot}` : 'basilisk=unset';
    const fallbackLabel = `clangd_fallback=${clangdWillRun ? 'on' : 'off'}`;
    process.stdout.write(`${qccLabel} | ${clangdLabel} | ${basiliskLabel} | ${fallbackLabel}\n`);
}
async function run() {
    const parsed = parseArgs(process.argv.slice(2));
    if (!parsed) {
        return;
    }
    if (parsed.command === 'doctor') {
        await runDoctor(parsed.options);
        return;
    }
    const options = parsed.options;
    const filePath = path.resolve(options.filePath);
    if (!fs.existsSync(filePath)) {
        process.stderr.write(`File not found: ${filePath}\n`);
        process.exitCode = 1;
        return;
    }
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const qccContent = options.wrapHeader
        ? buildHeaderWrapper(filePath, options.wrapIncludes)
        : originalContent;
    const clangdContent = originalContent;
    const uri = vscode_uri_1.URI.file(filePath).toString();
    const settings = buildSettings(options, path.dirname(filePath));
    if (options.projectConfigPath && process.exitCode === 2) {
        return;
    }
    const diagnostics = [];
    diagnostics.push(...(0, diagnostics_1.quickValidate)(originalContent));
    const qccResolved = (0, diagnostics_1.resolveQccPath)(settings);
    const qccAvailable = qccResolved ? await (0, diagnostics_1.checkQccAvailable)(qccResolved) : false;
    if (settings.enableDiagnostics) {
        const qccDiagnostics = await (0, diagnostics_1.runDiagnostics)(uri, qccContent, settings, {
            warn: (message) => {
                process.stderr.write(`${message}\n`);
            }
        });
        diagnostics.push(...qccDiagnostics);
    }
    const shouldRunClangd = settings.clangd.enabled && settings.clangd.mode === 'proxy' && !qccAvailable;
    if (shouldRunClangd) {
        try {
            const clangdDiagnostics = await runClangdDiagnostics(filePath, uri, clangdContent, settings, options.verbose);
            diagnostics.push(...clangdDiagnostics);
        }
        catch (error) {
            process.stderr.write(`clangd error: ${error.message}\n`);
            process.exitCode = 2;
            return;
        }
    }
    if (!qccAvailable && !shouldRunClangd) {
        process.stderr.write('qcc not available and clangd fallback disabled.\n');
        process.exitCode = 2;
        return;
    }
    const merged = dedupeDiagnostics(diagnostics).slice(0, settings.maxNumberOfProblems);
    if (options.format === 'json') {
        process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
    }
    else {
        for (const diagnostic of merged) {
            process.stdout.write(`${formatDiagnostic(filePath, diagnostic)}\n`);
        }
    }
    const hasError = merged.some((diagnostic) => diagnostic.severity === node_1.DiagnosticSeverity.Error);
    if (hasError) {
        process.exitCode = 1;
    }
}
void run();
//# sourceMappingURL=cli.js.map