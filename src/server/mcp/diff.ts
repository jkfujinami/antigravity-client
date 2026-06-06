/**
 * Minimal line-level unified-diff utilities.
 *
 * `GetTurnDiff` returns full original + modified file contents (not a patch).
 * Returning both verbatim would defeat the token-saving purpose, so we compute
 * a compact unified diff (changed hunks + a few context lines) locally.
 *
 * We also expose hunk-level reconstruction: given the rejected hunk indices,
 * rebuild the file contents with only the *accepted* hunks applied. This backs
 * HUNK-scope edit rejection (`ag_reject_edit`).
 *
 * LCS-based; O(n*m) time/memory in line counts, so very large files fall back
 * to a counts-only notice.
 */

/** Above this product of line counts, skip inline diffing. */
const MAX_LCS_CELLS = 6_000_000; // ~2450×2450 lines

type Op = { t: "eq" | "del" | "ins"; line: string };

interface Annotated extends Op {
    oldNo: number | null;
    newNo: number | null;
    hunk: number; // hunk index this op belongs to, or -1
}

interface Hunk {
    /** Range of annotated-op indices [start, end] covered by this hunk. */
    opStart: number;
    opEnd: number;
}

function splitLines(s: string): { lines: string[]; trailingNewline: boolean } {
    const trailingNewline = s.endsWith("\n");
    const lines = s.split("\n");
    // A trailing "\n" produces a spurious empty last element; drop it so files
    // are treated as newline-terminated.
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    return { lines, trailingNewline };
}

function diffLines(a: string[], b: string[]): Op[] {
    const n = a.length;
    const m = b.length;
    const dp: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
        const row = dp[i];
        const next = dp[i + 1];
        for (let j = m - 1; j >= 0; j--) {
            row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
        }
    }

    const ops: Op[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push({ t: "eq", line: a[i] });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ t: "del", line: a[i] });
            i++;
        } else {
            ops.push({ t: "ins", line: b[j] });
            j++;
        }
    }
    while (i < n) ops.push({ t: "del", line: a[i++] });
    while (j < m) ops.push({ t: "ins", line: b[j++] });
    return ops;
}

/** Annotates ops with old/new line numbers and assigns each to a hunk. */
function analyze(
    original: string,
    modified: string,
    context: number,
): { ann: Annotated[]; hunks: Hunk[]; additions: number; deletions: number; tooLarge: boolean } {
    const { lines: a } = splitLines(original);
    const { lines: b } = splitLines(modified);

    if (a.length * b.length > MAX_LCS_CELLS) {
        return { ann: [], hunks: [], additions: 0, deletions: 0, tooLarge: true };
    }

    const ops = diffLines(a, b);

    let oldNo = 1;
    let newNo = 1;
    let additions = 0;
    let deletions = 0;
    const ann: Annotated[] = ops.map((op) => {
        if (op.t === "eq") return { ...op, oldNo: oldNo++, newNo: newNo++, hunk: -1 };
        if (op.t === "del") {
            deletions++;
            return { ...op, oldNo: oldNo++, newNo: null, hunk: -1 };
        }
        additions++;
        return { ...op, oldNo: null, newNo: newNo++, hunk: -1 };
    });

    const isChange = (e: Annotated) => e.t !== "eq";

    const hunks: Hunk[] = [];
    let idx = 0;
    while (idx < ann.length) {
        if (!isChange(ann[idx])) {
            idx++;
            continue;
        }
        const opStart = Math.max(0, idx - context);
        let end = idx;
        let k = idx;
        while (k < ann.length) {
            if (isChange(ann[k])) {
                end = k;
                k++;
                continue;
            }
            // keep the hunk open if another change is within 2*context
            let nextChange = -1;
            for (let p = k; p < Math.min(ann.length, k + context * 2 + 1); p++) {
                if (isChange(ann[p])) {
                    nextChange = p;
                    break;
                }
            }
            if (nextChange === -1) break;
            k++;
        }
        const opEnd = Math.min(ann.length - 1, end + context);
        const h = hunks.length;
        for (let p = opStart; p <= opEnd; p++) ann[p].hunk = h;
        hunks.push({ opStart, opEnd });
        idx = opEnd + 1;
    }

    return { ann, hunks, additions, deletions, tooLarge: false };
}

export interface UnifiedDiffResult {
    patch: string;
    additions: number;
    deletions: number;
    hunkCount: number;
    /** True when the file was too large to diff inline. */
    skipped: boolean;
}

/**
 * Builds a unified diff (with `context` lines around each change) from the
 * original and modified contents of a single file. Each hunk header is suffixed
 * with `hunk N` (1-based) so callers can reference hunks for rejection.
 */
export function renderUnifiedDiff(original: string, modified: string, context = 3): UnifiedDiffResult {
    const { ann, hunks, additions, deletions, tooLarge } = analyze(original, modified, context);
    if (tooLarge) {
        return { patch: "", additions: 0, deletions: 0, hunkCount: 0, skipped: true };
    }

    const lines: string[] = [];
    hunks.forEach((h, hi) => {
        const slice = ann.slice(h.opStart, h.opEnd + 1);
        const oldNos = slice.filter((x) => x.oldNo !== null).map((x) => x.oldNo as number);
        const newNos = slice.filter((x) => x.newNo !== null).map((x) => x.newNo as number);
        const oldStart = oldNos.length ? oldNos[0] : 0;
        const newStart = newNos.length ? newNos[0] : 0;
        lines.push(`@@ -${oldStart},${oldNos.length} +${newStart},${newNos.length} @@ hunk ${hi + 1}`);
        for (const x of slice) {
            const prefix = x.t === "eq" ? " " : x.t === "del" ? "-" : "+";
            lines.push(prefix + x.line);
        }
    });

    return { patch: lines.join("\n"), additions, deletions, hunkCount: hunks.length, skipped: false };
}

export interface ReconstructResult {
    contents: string;
    hunkCount: number;
    skipped: boolean;
}

/**
 * Reconstructs file contents with the given (1-based) hunk indices REJECTED —
 * i.e. every accepted hunk is applied and every rejected hunk is left at its
 * original text. Used to build the post-state for HUNK-scope rejection.
 *
 * Rejecting all hunks yields the original; rejecting none yields the modified.
 */
export function reconstructRejecting(
    original: string,
    modified: string,
    rejectedHunks1Based: number[],
    context = 3,
): ReconstructResult {
    const { ann, hunks, tooLarge } = analyze(original, modified, context);
    if (tooLarge) return { contents: modified, hunkCount: 0, skipped: true };

    const rejected = new Set(rejectedHunks1Based.map((n) => n - 1));
    const out: string[] = [];
    for (const x of ann) {
        if (x.t === "eq") {
            out.push(x.line);
        } else if (x.t === "del") {
            // deletion: applied (skip) when accepted; kept (emit) when rejected
            if (rejected.has(x.hunk)) out.push(x.line);
        } else {
            // insertion: applied (emit) when accepted; dropped when rejected
            if (!rejected.has(x.hunk)) out.push(x.line);
        }
    }

    const { trailingNewline } = splitLines(original);
    const contents = out.join("\n") + (trailingNewline ? "\n" : "");
    return { contents, hunkCount: hunks.length, skipped: false };
}
