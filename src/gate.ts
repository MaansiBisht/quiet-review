import { Finding, Severity, SEVERITY_RANK } from "./types";

/** Keep only findings at or above the configured minimum severity. Pure. */
export function gate(findings: Finding[], minSeverity: Severity): Finding[] {
  const floor = SEVERITY_RANK[minSeverity];
  return findings.filter((f) => SEVERITY_RANK[f.severity] >= floor);
}

/** Parse the `min-severity` input; default to `bug` on anything unexpected. */
export function parseSeverity(input: string): Severity {
  return input.trim() === "behavior-change" ? "behavior-change" : "bug";
}
