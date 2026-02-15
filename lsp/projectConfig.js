"use strict";
/**
 * Project Configuration Loader
 *
 * Loads and parses .comphy-basilisk project configuration files.
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
exports.findRepoRoot = findRepoRoot;
exports.findSrcLocalDir = findSrcLocalDir;
exports.loadProjectConfig = loadProjectConfig;
exports.loadProjectConfigFromFile = loadProjectConfigFromFile;
exports.resolveProjectConfig = resolveProjectConfig;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
function expandHome(value) {
    if (!value.startsWith('~')) {
        return value;
    }
    return path.join(os.homedir(), value.slice(1));
}
function resolvePathEntry(value, baseDir) {
    const expanded = expandHome(value);
    if (path.isAbsolute(expanded)) {
        return expanded;
    }
    return path.join(baseDir, expanded);
}
function resolvePathArray(values, baseDir) {
    if (!values || values.length === 0) {
        return [];
    }
    return values.map((entry) => resolvePathEntry(entry, baseDir));
}
function resolveConfigPath(inputPath) {
    const expanded = expandHome(inputPath);
    if (path.isAbsolute(expanded)) {
        return expanded;
    }
    return path.resolve(process.cwd(), expanded);
}
function isDirectory(dirPath) {
    try {
        return fs.statSync(dirPath).isDirectory();
    }
    catch {
        return false;
    }
}
/**
 * Finds the repository root by searching upward for .git directory.
 *
 * @param startDir - Directory to start searching from
 * @returns Path to repository root, or null if not found
 */
function findRepoRoot(startDir) {
    let current = startDir;
    while (true) {
        const gitPath = path.join(current, '.git');
        if (fs.existsSync(gitPath)) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return null;
}
/**
 * Finds the src-local directory by searching upward from startDir to repo root.
 *
 * @param startDir - Directory to start searching from
 * @returns Path to src-local directory, or null if not found
 */
function findSrcLocalDir(startDir) {
    const repoRoot = findRepoRoot(startDir);
    let current = startDir;
    while (true) {
        const candidate = path.join(current, 'src-local');
        if (isDirectory(candidate)) {
            return candidate;
        }
        if (repoRoot && current === repoRoot) {
            break;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return null;
}
function findConfigPath(startDir, fileName) {
    const repoRoot = findRepoRoot(startDir);
    let current = startDir;
    while (true) {
        const candidate = path.join(current, fileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        if (repoRoot && current === repoRoot) {
            break;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return null;
}
/**
 * Loads project configuration by searching upward from startDir.
 *
 * @param startDir - Directory to start searching from
 * @param fileName - Config file name (default: .comphy-basilisk)
 * @returns Result with path, config object, and optional error
 */
function loadProjectConfig(startDir, fileName = '.comphy-basilisk') {
    const configPath = findConfigPath(startDir, fileName);
    if (!configPath) {
        return { path: null, config: null };
    }
    try {
        const raw = fs.readFileSync(configPath, 'utf8').trim();
        if (!raw) {
            return { path: configPath, config: null };
        }
        const parsed = JSON.parse(raw);
        const baseDir = path.dirname(configPath);
        const resolved = resolveProjectConfig(parsed, baseDir);
        return { path: configPath, config: resolved };
    }
    catch (error) {
        return {
            path: configPath,
            config: null,
            error: error.message
        };
    }
}
/**
 * Loads project configuration from an explicit file path.
 *
 * @param filePath - Path to config file (supports ~ and relative paths)
 * @returns Result with path, config object, and optional error
 */
function loadProjectConfigFromFile(filePath) {
    const resolvedPath = resolveConfigPath(filePath);
    if (!fs.existsSync(resolvedPath)) {
        return {
            path: resolvedPath,
            config: null,
            error: 'file not found'
        };
    }
    try {
        const raw = fs.readFileSync(resolvedPath, 'utf8').trim();
        if (!raw) {
            return { path: resolvedPath, config: null };
        }
        const parsed = JSON.parse(raw);
        const baseDir = path.dirname(resolvedPath);
        const resolved = resolveProjectConfig(parsed, baseDir);
        return { path: resolvedPath, config: resolved };
    }
    catch (error) {
        return {
            path: resolvedPath,
            config: null,
            error: error.message
        };
    }
}
/**
 * Resolves relative paths in project configuration against baseDir.
 *
 * @param config - Project configuration with potentially relative paths
 * @param baseDir - Base directory for path resolution
 * @returns Configuration with resolved absolute paths
 */
function resolveProjectConfig(config, baseDir) {
    const resolved = { ...config };
    if (config.basiliskPath) {
        resolved.basiliskPath = resolvePathEntry(config.basiliskPath, baseDir);
    }
    if (config.qccPath) {
        resolved.qccPath = resolvePathEntry(config.qccPath, baseDir);
    }
    const includePaths = [
        ...(config.qcc?.includePaths ?? []),
        ...(config.qccIncludePaths ?? [])
    ];
    if (includePaths.length > 0) {
        resolved.qcc = {
            ...(config.qcc || {}),
            includePaths: resolvePathArray(includePaths, baseDir)
        };
    }
    if (config.clangd) {
        resolved.clangd = { ...config.clangd };
        if (config.clangd.compileCommandsDir) {
            resolved.clangd.compileCommandsDir = resolvePathEntry(config.clangd.compileCommandsDir, baseDir);
        }
    }
    return resolved;
}
//# sourceMappingURL=projectConfig.js.map