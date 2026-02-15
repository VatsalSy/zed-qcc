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
exports.resolveExecutableOnPath = resolveExecutableOnPath;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/**
 * Expands tilde (~) prefix to the user's home directory.
 *
 * @param value - Path string that may start with ~
 * @returns Expanded path with home directory, or original value if no tilde
 */
function expandTilde(value) {
    if (value.startsWith('~')) {
        return path.join(os.homedir(), value.slice(1));
    }
    return value;
}
/**
 * Resolves an executable command to its full path by searching PATH.
 *
 * Handles tilde expansion, absolute paths, and PATH lookup with proper
 * executable permission checking on Unix systems. On Windows, respects PATHEXT.
 *
 * @param command - Command name or path to resolve
 * @returns Full path to executable if found, null otherwise
 */
function resolveExecutableOnPath(command) {
    if (!command) {
        return null;
    }
    const isWindows = process.platform === 'win32';
    const expanded = expandTilde(command);
    if (path.isAbsolute(expanded)) {
        if (!fs.existsSync(expanded)) {
            return null;
        }
        if (isWindows) {
            return expanded;
        }
        try {
            fs.accessSync(expanded, fs.constants.X_OK);
            return expanded;
        }
        catch {
            return null;
        }
    }
    const pathEnv = process.env.PATH || '';
    const pathDirs = pathEnv.split(path.delimiter).filter(Boolean);
    const hasExt = path.extname(expanded).length > 0;
    const extensions = isWindows
        ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
        : [''];
    for (const dir of pathDirs) {
        if (hasExt) {
            const fullPath = path.join(dir, expanded);
            if (fs.existsSync(fullPath)) {
                if (isWindows) {
                    return fullPath;
                }
                try {
                    fs.accessSync(fullPath, fs.constants.X_OK);
                    return fullPath;
                }
                catch {
                    continue;
                }
            }
            continue;
        }
        for (const ext of extensions) {
            const candidate = `${expanded}${ext}`;
            const fullPath = path.join(dir, candidate);
            if (!fs.existsSync(fullPath)) {
                continue;
            }
            if (isWindows) {
                return fullPath;
            }
            try {
                fs.accessSync(fullPath, fs.constants.X_OK);
                return fullPath;
            }
            catch {
                continue;
            }
        }
    }
    return null;
}
//# sourceMappingURL=pathUtils.js.map