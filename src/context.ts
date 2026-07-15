import * as fs from "fs";
import { FileContext } from "./types";

/** Lines of context to include above/below each changed hunk. */
const WINDOW = 25;

interface ChangedFile {
  path: string;
  patch?: string;
}

/**
 * Build the context we send the model: the diff plus a window of real source
 * lines around each hunk, read from the checked-out working tree. This is a
 * language-agnostic line window, NOT an AST parse — the LLM understands the code.
 */
export function buildContext(files: ChangedFile[]): FileContext[] {
  const out: FileContext[] = [];
  for (const f of files) {
    if (!f.patch) continue; // binary / renamed-only / too-large: skip, no context to ground on
    out.push({
      path: f.path,
      patch: f.patch,
      context: windowsForFile(f.path, f.patch),
    });
  }
  return out;
}

/** Read the file from disk and return numbered line windows around each hunk. */
function windowsForFile(path: string, patch: string): string {
  let lines: string[];
  try {
    lines = fs.readFileSync(path, "utf8").split("\n");
  } catch {
    return "(file not found in checkout)";
  }

  const ranges = newSideHunkRanges(patch);
  if (ranges.length === 0) return "";

  const windows = mergeRanges(
    ranges.map(({ start, count }) => ({
      from: Math.max(1, start - WINDOW),
      to: Math.min(lines.length, start + count + WINDOW),
    })),
  );

  return windows
    .map(({ from, to }) => {
      const body = lines
        .slice(from - 1, to)
        .map((l, i) => `${from + i}: ${l}`)
        .join("\n");
      return `@@ lines ${from}-${to} @@\n${body}`;
    })
    .join("\n\n");
}

/** Parse `@@ -a,b +c,d @@` hunk headers for the NEW-side (+) ranges. */
export function newSideHunkRanges(patch: string): { start: number; count: number }[] {
  const ranges: { start: number; count: number }[] = [];
  const re = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(patch)) !== null) {
    ranges.push({ start: Number(m[1]), count: m[2] ? Number(m[2]) : 1 });
  }
  return ranges;
}

/** Merge overlapping/adjacent windows so we don't repeat lines. */
function mergeRanges(
  ranges: { from: number; to: number }[],
): { from: number; to: number }[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: { from: number; to: number }[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.from <= last.to + 1) {
      last.to = Math.max(last.to, r.to);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}
