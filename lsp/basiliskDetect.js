"use strict";
/**
 * Basilisk Code Detection and Diagnostic Filtering
 *
 * Detects Basilisk DSL constructs and filters clangd diagnostics
 * to suppress noise from Basilisk-specific syntax.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLikelyBasiliskText = isLikelyBasiliskText;
exports.filterClangdDiagnostics = filterClangdDiagnostics;
const basiliskLanguage_1 = require("./basiliskLanguage");
const BASILISK_TOKENS = [
    ...basiliskLanguage_1.CONTROL_KEYWORDS,
    ...basiliskLanguage_1.FIELD_TYPES,
    ...basiliskLanguage_1.CONSTANTS,
    ...basiliskLanguage_1.LOOP_VARIABLES
];
const BASILISK_TOKEN_REGEX = new RegExp(`\\b(${BASILISK_TOKENS.join('|')})\\b`);
const BASILISK_INCLUDE_REGEX = /#\s*include\s*[<"](?:grid\/|navier-stokes\/|two-phase|two-phase-generic|vof|run|events|common|utils|embed|curvature|fractions|conservation|view|output|draw)\.h/;
const NOISE_PATTERNS = [
    /unknown type name/i,
    /a type specifier is required/i,
    /expected ';' after top level declarator/i,
    /definition of variable with array type needs an explicit size/i,
    /use of undeclared identifier/i
];
/**
 * Checks if text contains Basilisk-specific constructs.
 *
 * @param text - Source code text to check
 * @returns True if Basilisk keywords or includes are found
 */
function isLikelyBasiliskText(text) {
    return BASILISK_TOKEN_REGEX.test(text) || BASILISK_INCLUDE_REGEX.test(text);
}
function lineLikelyBasilisk(line) {
    return BASILISK_TOKEN_REGEX.test(line) || BASILISK_INCLUDE_REGEX.test(line);
}
/**
 * Filters clangd diagnostics to suppress noise from Basilisk DSL constructs.
 *
 * Removes diagnostics for lines with Basilisk syntax if they match known noise patterns.
 *
 * @param diagnostics - Array of diagnostics from clangd
 * @param text - Full source text for context
 * @returns Filtered diagnostics array
 */
function filterClangdDiagnostics(diagnostics, text) {
    if (!isLikelyBasiliskText(text)) {
        return diagnostics;
    }
    const lines = text.split('\n');
    return diagnostics.filter((diagnostic) => {
        const line = lines[diagnostic.range.start.line] || '';
        if (!lineLikelyBasilisk(line)) {
            return true;
        }
        return !NOISE_PATTERNS.some((pattern) => pattern.test(diagnostic.message));
    });
}
//# sourceMappingURL=basiliskDetect.js.map