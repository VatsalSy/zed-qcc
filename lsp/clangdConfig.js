"use strict";
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
exports.resolvePathSetting = resolvePathSetting;
exports.resolveBasiliskRoot = resolveBasiliskRoot;
exports.deriveBasiliskFallbackFlags = deriveBasiliskFallbackFlags;
exports.mergeFlags = mergeFlags;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const pathUtils_1 = require("./pathUtils");
/**
 * Resolves a path setting with tilde expansion and workspace root resolution.
 *
 * Expands ~ to home directory, resolves relative paths against rootPath,
 * and returns absolute paths unchanged.
 *
 * @param value - Path string from settings
 * @param rootPath - Workspace root path for relative resolution, or null
 * @returns Resolved absolute path, or empty string if value is empty
 */
function resolvePathSetting(value, rootPath) {
    if (!value) {
        return '';
    }
    const expanded = value.startsWith('~')
        ? path.join(os.homedir(), value.slice(1))
        : value;
    if (path.isAbsolute(expanded)) {
        return expanded;
    }
    return rootPath ? path.join(rootPath, expanded) : expanded;
}
/**
 * Resolves the Basilisk installation root directory.
 *
 * Checks in order: settings.basiliskPath, BASILISK env var, qcc location.
 *
 * @param settings - Current Basilisk settings
 * @param rootPath - Workspace root path for relative resolution
 * @returns Basilisk root path if found, null otherwise
 */
function resolveBasiliskRoot(settings, rootPath) {
    if (settings.basiliskPath) {
        return resolvePathSetting(settings.basiliskPath, rootPath);
    }
    const envPath = process.env.BASILISK;
    if (envPath) {
        return resolvePathSetting(envPath, rootPath);
    }
    const qccResolved = (0, pathUtils_1.resolveExecutableOnPath)(settings.qccPath) || (0, pathUtils_1.resolveExecutableOnPath)('qcc');
    if (qccResolved) {
        return path.dirname(qccResolved);
    }
    return null;
}
/**
 * Derives default clangd fallback include flags from Basilisk root.
 *
 * Returns include flags for Basilisk core directories (root, grid, navier-stokes, ast).
 *
 * @param basiliskRoot - Basilisk installation root path
 * @returns Array of -I flags, or empty array if basiliskRoot is null
 */
function deriveBasiliskFallbackFlags(basiliskRoot) {
    if (!basiliskRoot) {
        return [];
    }
    return [
        `-I${basiliskRoot}`,
        `-I${path.join(basiliskRoot, 'grid')}`,
        `-I${path.join(basiliskRoot, 'navier-stokes')}`,
        `-I${path.join(basiliskRoot, 'ast')}`
    ];
}
/**
 * Merges two arrays of compiler flags, deduplicating entries.
 *
 * @param primary - First array of flags
 * @param secondary - Second array of flags to merge
 * @returns Merged array with duplicates removed
 */
function mergeFlags(primary, secondary) {
    const seen = new Set();
    const merged = [];
    for (const flag of [...primary, ...secondary]) {
        if (seen.has(flag)) {
            continue;
        }
        seen.add(flag);
        merged.push(flag);
    }
    return merged;
}
//# sourceMappingURL=clangdConfig.js.map