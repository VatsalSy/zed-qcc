"use strict";
/**
 * Diagnostics Provider for Basilisk C
 *
 * This module provides compilation diagnostics by invoking the qcc compiler
 * and parsing its error output. It supports both syntax errors and semantic
 * errors detected by the compiler.
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
exports.defaultSettings = void 0;
exports.resolveQccPath = resolveQccPath;
exports.runDiagnostics = runDiagnostics;
exports.quickValidate = quickValidate;
exports.checkQccAvailable = checkQccAvailable;
exports.getQccVersion = getQccVersion;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const vscode_languageserver_1 = require("vscode-languageserver");
const projectConfig_1 = require("./projectConfig");
const pathUtils_1 = require("./pathUtils");
exports.defaultSettings = {
    qccPath: 'qcc',
    basiliskPath: '',
    enableDiagnostics: true,
    diagnosticsOnSave: true,
    diagnosticsOnType: false,
    maxNumberOfProblems: 100,
    qcc: {
        includePaths: []
    },
    clangd: {
        enabled: true,
        mode: 'proxy',
        path: 'clangd',
        args: [],
        compileCommandsDir: '',
        fallbackFlags: [],
        diagnosticsMode: 'filtered'
    }
};
/**
 * Parse GCC-style error messages
 * Format: filename:line:column: severity: message
 */
function parseGccOutput(output) {
    const diagnostics = [];
    const lines = output.split('\n');
    // GCC/Clang error format: file:line:col: error/warning: message
    const errorRegex = /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/;
    // Alternative format: file:line: error/warning: message (no column)
    const errorRegexNoCol = /^(.+?):(\d+):\s*(error|warning|note):\s*(.+)$/;
    // Basilisk/qcc specific format
    const qccErrorRegex = /^(.+?):(\d+):\s*(.+)$/;
    for (const line of lines) {
        let match = errorRegex.exec(line);
        if (match) {
            diagnostics.push({
                file: match[1],
                line: parseInt(match[2], 10),
                column: parseInt(match[3], 10),
                severity: match[4],
                message: match[5]
            });
            continue;
        }
        match = errorRegexNoCol.exec(line);
        if (match) {
            diagnostics.push({
                file: match[1],
                line: parseInt(match[2], 10),
                column: 1,
                severity: match[3],
                message: match[4]
            });
            continue;
        }
        match = qccErrorRegex.exec(line);
        if (match && (line.includes('error') || line.includes('undefined') || line.includes('undeclared'))) {
            diagnostics.push({
                file: match[1],
                line: parseInt(match[2], 10),
                column: 1,
                severity: 'error',
                message: match[3]
            });
        }
    }
    return diagnostics;
}
/**
 * Convert severity string to DiagnosticSeverity
 */
function toSeverity(severity) {
    switch (severity) {
        case 'error':
            return vscode_languageserver_1.DiagnosticSeverity.Error;
        case 'warning':
            return vscode_languageserver_1.DiagnosticSeverity.Warning;
        case 'note':
            return vscode_languageserver_1.DiagnosticSeverity.Information;
        default:
            return vscode_languageserver_1.DiagnosticSeverity.Error;
    }
}
function resolveQccCandidates(settings) {
    const candidates = [];
    if (settings.qccPath) {
        candidates.push(settings.qccPath);
    }
    const basiliskRoots = [];
    if (settings.basiliskPath) {
        basiliskRoots.push(settings.basiliskPath);
    }
    const envBasilisk = process.env.BASILISK;
    if (envBasilisk && envBasilisk !== settings.basiliskPath) {
        basiliskRoots.push(envBasilisk);
    }
    for (const root of basiliskRoots) {
        candidates.push(path.join(root, 'qcc'));
        candidates.push(path.join(root, 'bin', 'qcc'));
    }
    candidates.push('/opt/homebrew/bin/qcc');
    candidates.push('/usr/local/bin/qcc');
    return candidates;
}
function resolveQccPath(settings) {
    for (const candidate of resolveQccCandidates(settings)) {
        const resolved = (0, pathUtils_1.resolveExecutableOnPath)(candidate);
        if (resolved) {
            return resolved;
        }
    }
    return null;
}
/**
 * Create a Diagnostic from parsed error
 */
function createDiagnostic(parsed) {
    // Lines and columns are 1-based in compiler output, 0-based in LSP
    const line = Math.max(0, parsed.line - 1);
    const col = Math.max(0, parsed.column - 1);
    return {
        range: vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(line, col), vscode_languageserver_1.Position.create(line, col + 1) // Highlight at least one character
        ),
        severity: toSeverity(parsed.severity),
        source: 'qcc',
        message: parsed.message
    };
}
/**
 * Run qcc to check for syntax errors
 */
async function runDiagnostics(documentUri, content, settings, logger) {
    if (!settings.enableDiagnostics) {
        return [];
    }
    const diagnostics = [];
    const resolvedQccPath = resolveQccPath(settings) || settings.qccPath;
    let tempFile = null;
    const originalPath = documentUri.startsWith('file://')
        ? documentUri.replace('file://', '')
        : documentUri;
    const originalDir = path.dirname(originalPath);
    const srcLocalDir = (0, projectConfig_1.findSrcLocalDir)(originalDir);
    try {
        // Create a temporary file with the content
        const tempRoot = os.tmpdir();
        const fileName = path.basename(documentUri);
        tempFile = path.join(tempRoot, `basilisk_${Date.now()}_${fileName}`);
        // Ensure the temp file has .c extension for qcc
        if (!tempFile.endsWith('.c')) {
            tempFile += '.c';
        }
        fs.writeFileSync(tempFile, content);
        const tempDir = path.dirname(tempFile);
        const tempBase = path.basename(tempFile);
        // Build qcc command. Use the basename and run from the temp directory so
        // qcc can generate its intermediate -cpp.c file alongside the input.
        const args = [
            '-Wall', // Enable all warnings
            '-fsyntax-only' // Only check syntax, don't compile
        ];
        const includeDirs = [];
        if (originalDir && originalDir !== tempDir) {
            includeDirs.push(originalDir);
        }
        if (srcLocalDir && srcLocalDir !== tempDir && srcLocalDir !== originalDir) {
            includeDirs.push(srcLocalDir);
        }
        if (settings.qcc?.includePaths?.length) {
            includeDirs.push(...settings.qcc.includePaths);
        }
        const seen = new Set();
        for (const includeDir of includeDirs) {
            if (!includeDir || seen.has(includeDir)) {
                continue;
            }
            seen.add(includeDir);
            args.push('-I', includeDir);
        }
        args.push(tempBase);
        // Set up environment
        const env = { ...process.env };
        if (settings.basiliskPath) {
            env['BASILISK'] = settings.basiliskPath;
        }
        // Run qcc
        const result = await runCommand(resolvedQccPath, args, {
            env,
            cwd: tempDir
        });
        // Parse output
        const allOutput = result.stderr + result.stdout;
        const parsedDiagnostics = parseGccOutput(allOutput);
        // Filter diagnostics to only include those for our file
        const baseFileName = path.basename(tempFile);
        for (const parsed of parsedDiagnostics) {
            // Match if the file is our temp file or the original file
            const parsedBase = path.basename(parsed.file);
            if (parsedBase === baseFileName ||
                parsedBase === path.basename(documentUri) ||
                parsed.file.includes(baseFileName)) {
                const diagnostic = createDiagnostic(parsed);
                diagnostics.push(diagnostic);
                if (diagnostics.length >= settings.maxNumberOfProblems) {
                    break;
                }
            }
        }
    }
    catch (error) {
        // If qcc is not found or fails, add a diagnostic
        const err = error;
        if (err.message.includes('ENOENT') || err.message.includes('not found')) {
            diagnostics.push({
                range: vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(0, 0), vscode_languageserver_1.Position.create(0, 1)),
                severity: vscode_languageserver_1.DiagnosticSeverity.Warning,
                source: 'basilisk-lsp',
                message: `qcc compiler not found at '${resolvedQccPath}'. Set basilisk.qccPath in settings.`
            });
        }
        else if (logger) {
            const message = err?.message ? err.message : String(error);
            logger.warn(`qcc diagnostics failed: ${message}`);
        }
    }
    finally {
        // Clean up temp file
        if (tempFile && fs.existsSync(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
            }
            catch {
                // Ignore cleanup errors
            }
        }
    }
    return diagnostics;
}
function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 30000; // 30 second default timeout
        let process;
        try {
            process = (0, child_process_1.spawn)(command, args, {
                env: options.env,
                cwd: options.cwd
                // shell: true removed to prevent command injection
            });
        }
        catch (error) {
            reject(error);
            return;
        }
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            process.kill();
            reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
        process.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        process.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        process.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        process.on('close', (code) => {
            clearTimeout(timer);
            resolve({ stdout, stderr, code });
        });
    });
}
/**
 * Quick syntax validation without running compiler
 * Checks for common Basilisk syntax issues
 */
function quickValidate(content) {
    const diagnostics = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for unclosed foreach without braces on same line
        if (/^\s*foreach\s*\([^)]*\)\s*$/.test(line)) {
            // Look ahead to see if next non-empty line has a brace
            let foundBrace = false;
            for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                if (lines[j].trim().startsWith('{') || lines[j].trim() === '') {
                    foundBrace = true;
                    break;
                }
                if (lines[j].trim().length > 0) {
                    break;
                }
            }
            if (!foundBrace && i + 1 < lines.length && !lines[i + 1].trim().startsWith('{')) {
                // Check if it's a single-line statement
                const nextLine = lines[i + 1]?.trim() || '';
                if (nextLine && !nextLine.endsWith(';') && !nextLine.startsWith('{')) {
                    diagnostics.push({
                        range: vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(i, 0), vscode_languageserver_1.Position.create(i, line.length)),
                        severity: vscode_languageserver_1.DiagnosticSeverity.Hint,
                        source: 'basilisk-lsp',
                        message: 'Consider using braces {} for foreach loops for clarity'
                    });
                }
            }
        }
        // Check for common mistakes with field access
        // Accessing field without [] in foreach context
        const fieldAccessRegex = /\b(scalar|vector)\s+(\w+)\s*;/;
        const match = fieldAccessRegex.exec(line);
        if (match) {
            diagnostics.push({
                range: vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(i, match.index), vscode_languageserver_1.Position.create(i, match.index + match[0].length)),
                severity: vscode_languageserver_1.DiagnosticSeverity.Warning,
                source: 'basilisk-lsp',
                message: `Field '${match[2]}' should be declared with [], e.g., '${match[1]} ${match[2]}[]'`
            });
        }
        // Check for event without parentheses
        if (/^\s*event\s+\w+\s+[^(]/.test(line) && !/^\s*event\s+\w+\s*\(/.test(line)) {
            diagnostics.push({
                range: vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(i, 0), vscode_languageserver_1.Position.create(i, line.length)),
                severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                source: 'basilisk-lsp',
                message: 'Event definition requires parentheses with timing parameters'
            });
        }
    }
    return diagnostics;
}
/**
 * Check if qcc is available
 */
async function checkQccAvailable(qccPath) {
    try {
        const resolved = (0, pathUtils_1.resolveExecutableOnPath)(qccPath) || (path.isAbsolute(qccPath) ? qccPath : null);
        if (!resolved) {
            return false;
        }
        const result = await runCommand(resolved, ['--version'], { timeout: 5000 });
        return result.code === 0 || result.stdout.includes('gcc') || result.stderr.includes('gcc');
    }
    catch {
        return false;
    }
}
/**
 * Get qcc version information
 */
async function getQccVersion(qccPath) {
    try {
        const resolved = (0, pathUtils_1.resolveExecutableOnPath)(qccPath) || (path.isAbsolute(qccPath) ? qccPath : null);
        if (!resolved) {
            return null;
        }
        const result = await runCommand(resolved, ['--version'], { timeout: 5000 });
        const output = result.stdout || result.stderr;
        // First line typically contains version info
        const firstLine = output.split('\n')[0];
        return firstLine || null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=diagnostics.js.map