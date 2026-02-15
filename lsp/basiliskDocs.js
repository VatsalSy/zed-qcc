"use strict";
/**
 * Basilisk Documentation Indexer
 *
 * Extracts and indexes documentation comments from Basilisk C source files
 * for use in hover and completion information.
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
exports.ensureBasiliskDocs = ensureBasiliskDocs;
exports.getBasiliskDoc = getBasiliskDoc;
exports.parseDocsFromFile = parseDocsFromFile;
exports.parseGlobalsFromFile = parseGlobalsFromFile;
exports.cleanDocComment = cleanDocComment;
exports.splitTopLevelCommas = splitTopLevelCommas;
exports.parseDeclaration = parseDeclaration;
exports.findSignatureAfter = findSignatureAfter;
exports.isModifierLine = isModifierLine;
exports.formatDoc = formatDoc;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SOURCE_EXTENSIONS = new Set(['.h', '.c']);
const MAX_LOOKAHEAD_LINES = 40;
let docRootKey = null;
let docIndex = new Map();
let loading = null;
let loadGeneration = 0;
/**
 * Ensures documentation is indexed for the given roots.
 *
 * Rebuilds the index if roots have changed. Handles concurrent calls safely.
 *
 * @param roots - Array of directory paths to index for documentation
 */
async function ensureBasiliskDocs(roots) {
    const docRoots = resolveDocRoots(roots);
    if (docRoots.length === 0) {
        loadGeneration++;
        docRootKey = null;
        docIndex = new Map();
        return;
    }
    const nextKey = JSON.stringify(docRoots);
    while (true) {
        if (docRootKey === nextKey && docIndex.size > 0) {
            return;
        }
        const existing = loading;
        if (existing) {
            await existing;
            continue;
        }
        const generation = ++loadGeneration;
        loading = (async () => {
            const roots = docRoots;
            const key = nextKey;
            const nextIndex = await buildDocIndex(roots);
            if (generation !== loadGeneration) {
                return;
            }
            docIndex = nextIndex;
            docRootKey = key;
        })();
        try {
            await loading;
        }
        finally {
            loading = null;
        }
        return;
    }
}
/**
 * Retrieves documentation for a symbol from the index.
 *
 * @param symbol - Symbol name to look up
 * @returns Documentation entry if found, undefined otherwise
 */
function getBasiliskDoc(symbol) {
    return docIndex.get(symbol);
}
function resolveDocRoots(roots) {
    const resolved = [];
    const seen = new Set();
    for (const root of roots) {
        if (!root) {
            continue;
        }
        const candidate = resolveDocRoot(root);
        if (!candidate) {
            continue;
        }
        const normalized = path.resolve(candidate);
        if (seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        resolved.push(normalized);
    }
    return resolved;
}
function resolveDocRoot(root) {
    const basiliskSource = resolveBasiliskSourceRoot(root);
    if (basiliskSource) {
        return basiliskSource;
    }
    if (isDirectory(root)) {
        return root;
    }
    return null;
}
function resolveBasiliskSourceRoot(root) {
    if (!root) {
        return null;
    }
    const direct = root;
    if (isBasiliskSourceDir(direct)) {
        return direct;
    }
    const nested = path.join(root, 'src');
    if (isBasiliskSourceDir(nested)) {
        return nested;
    }
    return null;
}
function isDirectory(dir) {
    try {
        return fs.statSync(dir).isDirectory();
    }
    catch {
        return false;
    }
}
function isBasiliskSourceDir(dir) {
    try {
        const stats = fs.statSync(dir);
        if (!stats.isDirectory()) {
            return false;
        }
    }
    catch {
        return false;
    }
    const markers = [
        path.join(dir, 'fractions.h'),
        path.join(dir, 'draw.h'),
        path.join(dir, 'view.h'),
        path.join(dir, 'grid')
    ];
    return markers.some((marker) => fs.existsSync(marker));
}
async function buildDocIndex(sourceRoots) {
    const files = await collectSourceFiles(sourceRoots);
    const entries = new Map();
    for (const file of files) {
        let content;
        try {
            content = await fs.promises.readFile(file, 'utf8');
        }
        catch {
            continue;
        }
        const docs = parseDocsFromFile(content, file);
        const globals = parseGlobalsFromFile(content, file);
        for (const doc of [...docs, ...globals]) {
            const existing = entries.get(doc.symbol);
            if (!existing || doc.markdown.length > existing.markdown.length) {
                entries.set(doc.symbol, doc);
            }
        }
    }
    return entries;
}
async function collectSourceFiles(roots) {
    const files = [];
    const seen = new Set();
    const stack = [...roots];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
            continue;
        }
        let entries;
        try {
            entries = await fs.promises.readdir(current, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.')) {
                continue;
            }
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            const ext = path.extname(entry.name);
            if (SOURCE_EXTENSIONS.has(ext)) {
                if (!seen.has(fullPath)) {
                    seen.add(fullPath);
                    files.push(fullPath);
                }
            }
        }
    }
    return files;
}
function parseDocsFromFile(content, filePath) {
    const entries = [];
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('/**') && !line.includes('/*!')) {
            continue;
        }
        const start = i;
        let end = i;
        while (end < lines.length && !lines[end].includes('*/')) {
            end++;
        }
        if (end >= lines.length) {
            break;
        }
        const docText = cleanDocComment(lines.slice(start, end + 1));
        if (!docText) {
            i = end;
            continue;
        }
        const signature = findSignatureAfter(lines, end + 1);
        if (!signature) {
            i = end;
            continue;
        }
        const markdown = formatDoc(signature.signature, docText, signature.name);
        if (markdown) {
            entries.push({
                symbol: signature.name,
                signature: signature.signature,
                markdown,
                source: filePath
            });
        }
        i = end;
    }
    return entries;
}
function parseGlobalsFromFile(content, filePath) {
    const entries = [];
    const lines = content.split(/\r?\n/);
    let braceDepth = 0;
    let inBlockComment = false;
    let inString = false;
    let inChar = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let inLineComment = false;
        let escaped = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = j + 1 < line.length ? line[j + 1] : '';
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\' && (inString || inChar)) {
                escaped = true;
                continue;
            }
            if (!inString && !inChar && !inLineComment && !inBlockComment) {
                if (char === '/' && nextChar === '/') {
                    inLineComment = true;
                    j++;
                    continue;
                }
                if (char === '/' && nextChar === '*') {
                    inBlockComment = true;
                    j++;
                    continue;
                }
            }
            if (inBlockComment && char === '*' && nextChar === '/') {
                inBlockComment = false;
                j++;
                continue;
            }
            if (inLineComment || inBlockComment) {
                continue;
            }
            if (char === '"' && !inChar) {
                inString = !inString;
                continue;
            }
            if (char === "'" && !inString) {
                inChar = !inChar;
                continue;
            }
            if (!inString && !inChar) {
                if (char === '{') {
                    braceDepth++;
                }
                else if (char === '}') {
                    braceDepth = Math.max(0, braceDepth - 1);
                }
            }
        }
        if (braceDepth !== 0 || inBlockComment) {
            continue;
        }
        const match = /^\s*(?:static\s+)?(?:const\s+)?(double|int|float|char|long|short|unsigned|size_t|bool)\s+([^;]+);/.exec(line);
        if (!match) {
            continue;
        }
        const varType = match[1];
        const declarations = match[2];
        const parts = splitTopLevelCommas(declarations);
        const docComment = findDocCommentAbove(lines, i);
        for (const part of parts) {
            const parenIndex = part.indexOf('(');
            const equalsIndex = part.indexOf('=');
            if (parenIndex !== -1 && (equalsIndex === -1 || parenIndex < equalsIndex)) {
                continue;
            }
            const parsed = parseDeclaration(part);
            if (!parsed) {
                continue;
            }
            const signature = `${varType} ${parsed.name}${parsed.suffix}`;
            const markdown = docComment ? formatDoc(signature, docComment, parsed.name) : `**${signature}**`;
            entries.push({
                symbol: parsed.name,
                signature,
                markdown,
                source: filePath
            });
        }
    }
    return entries;
}
function cleanDocComment(lines) {
    const cleaned = lines.map((line, index) => {
        let value = line;
        if (index === 0) {
            value = value.replace(/^\s*\/\*+!?/, '');
        }
        if (index === lines.length - 1) {
            value = value.replace(/\*\/\s*$/, '');
        }
        value = value.replace(/^\s*\*\s?/, '');
        return value;
    });
    const doc = cleaned.join('\n').trim();
    return doc;
}
function findDocCommentAbove(lines, lineIndex) {
    let i = lineIndex - 1;
    while (i >= 0 && lines[i].trim() === '') {
        i--;
    }
    if (i < 0) {
        return null;
    }
    if (!lines[i].includes('*/')) {
        return null;
    }
    let start = i;
    while (start >= 0) {
        const line = lines[start];
        if (line.includes('/**') || line.includes('/*!')) {
            break;
        }
        if (line.includes('/*')) {
            return null;
        }
        start--;
    }
    if (start < 0) {
        return null;
    }
    const raw = lines.slice(start, i + 1);
    const doc = cleanDocComment(raw);
    return doc.length > 0 ? doc : null;
}
function splitTopLevelCommas(input) {
    const parts = [];
    let current = '';
    let paren = 0;
    let brace = 0;
    let bracket = 0;
    let inString = false;
    let inChar = false;
    let escaped = false;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === '\\' && (inString || inChar)) {
            current += char;
            escaped = true;
            continue;
        }
        if (char === '"' && !inChar) {
            inString = !inString;
            current += char;
            continue;
        }
        if (char === "'" && !inString) {
            inChar = !inChar;
            current += char;
            continue;
        }
        if (!inString && !inChar) {
            if (char === '(')
                paren++;
            else if (char === ')')
                paren = Math.max(0, paren - 1);
            else if (char === '{')
                brace++;
            else if (char === '}')
                brace = Math.max(0, brace - 1);
            else if (char === '[')
                bracket++;
            else if (char === ']')
                bracket = Math.max(0, bracket - 1);
            else if (char === ',' && paren === 0 && brace === 0 && bracket === 0) {
                if (current.trim()) {
                    parts.push(current.trim());
                }
                current = '';
                continue;
            }
        }
        current += char;
    }
    if (current.trim()) {
        parts.push(current.trim());
    }
    return parts;
}
function parseDeclaration(part) {
    const assignmentIndex = part.indexOf('=');
    const declarator = assignmentIndex >= 0 ? part.slice(0, assignmentIndex) : part;
    const trimmed = declarator.trim();
    if (!trimmed) {
        return null;
    }
    const cleaned = trimmed.replace(/^[\s*]+/, '');
    const match = cleaned.match(/^([A-Za-z_]\w*)(.*)$/);
    if (!match) {
        return null;
    }
    const name = match[1];
    let suffix = match[2] || '';
    const arrayMatch = suffix.match(/(\[[^\]]*\])+/);
    suffix = arrayMatch ? arrayMatch[0] : '';
    return { name, suffix };
}
function findSignatureAfter(lines, startIndex) {
    let collected = '';
    let linesChecked = 0;
    for (let i = startIndex; i < lines.length && linesChecked < MAX_LOOKAHEAD_LINES; i++, linesChecked++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (!trimmed) {
            continue;
        }
        if (trimmed.startsWith('//')) {
            continue;
        }
        if (!collected && (trimmed.startsWith('#include') || trimmed.startsWith('#pragma'))) {
            return null;
        }
        if (trimmed.startsWith('#')) {
            if (trimmed.startsWith('#define')) {
                collected = collected ? `${collected} ${trimmed}` : trimmed;
                break;
            }
            continue;
        }
        if (!collected && isModifierLine(trimmed)) {
            continue;
        }
        collected = collected ? `${collected} ${trimmed}` : trimmed;
        if (trimmed.includes('{') || trimmed.includes(';')) {
            break;
        }
    }
    if (!collected) {
        return null;
    }
    let signatureText = collected.trim();
    if (!signatureText) {
        return null;
    }
    if (!signatureText.startsWith('#define') && !signatureText.startsWith('macro')) {
        const lastParen = signatureText.lastIndexOf(')');
        if (lastParen !== -1) {
            signatureText = signatureText.slice(0, lastParen + 1).trim();
        }
    }
    const defineMatch = signatureText.match(/^#define\s+(\w+)\s*(?:\(([^)]*)\))?/);
    if (defineMatch) {
        const name = defineMatch[1];
        const params = defineMatch[2]?.trim() ?? '';
        return {
            name,
            signature: params ? `${name}(${params})` : name
        };
    }
    const macroMatch = signatureText.match(/^macro\s+(\w+)\s*\(([^)]*)\)/);
    if (macroMatch) {
        const name = macroMatch[1];
        const params = macroMatch[2].trim();
        return {
            name,
            signature: `${name}(${params})`
        };
    }
    const funcMatch = signatureText.match(/([A-Za-z_]\w*)\s*\((.*)\)/);
    if (!funcMatch) {
        return null;
    }
    const name = funcMatch[1];
    const params = funcMatch[2].trim();
    return {
        name,
        signature: `${name}(${params})`
    };
}
function isModifierLine(line) {
    const trimmed = line.trim();
    return trimmed === 'trace' || trimmed === 'static' || trimmed === 'inline' || trimmed === 'extern' || trimmed === 'const';
}
function formatDoc(signature, docText, name) {
    if (!docText) {
        return `**${signature}**`;
    }
    const lines = docText.split('\n');
    const firstIndex = lines.findIndex((line) => line.trim().length > 0);
    if (firstIndex >= 0) {
        const first = lines[firstIndex];
        if (isHeadingWithName(first, name)) {
            const transformed = headingToDescription(first);
            if (transformed) {
                lines[firstIndex] = transformed;
            }
            else {
                lines.splice(firstIndex, 1);
            }
        }
    }
    const body = lines.join('\n').trim();
    if (!body) {
        return `**${signature}**`;
    }
    return `**${signature}**\n\n${body}`;
}
function isHeadingWithName(line, name) {
    if (!/^#+\s+/.test(line)) {
        return false;
    }
    const cleaned = line.replace(/[*_`]/g, '');
    const namePattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
    return namePattern.test(cleaned);
}
function headingToDescription(line) {
    const trimmed = line.replace(/^#+\s+/, '');
    const cleaned = trimmed.replace(/[*_`]/g, '');
    const colonIndex = cleaned.indexOf(':');
    if (colonIndex >= 0) {
        const tail = cleaned.slice(colonIndex + 1).trim();
        return tail.length > 0 ? tail : null;
    }
    return null;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=basiliskDocs.js.map
