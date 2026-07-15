export type Severity = "bug" | "behavior-change";

export const SEVERITY_RANK: Record<Severity, number> = {
  "behavior-change": 1,
  bug: 2,
};

/** A single review comment the model wants to make. `[]` is the expected output. */
export interface Finding {
  file: string;
  /** Line in the NEW version of the file (RIGHT side of the diff). */
  line: number;
  severity: Severity;
  /** One-line statement of the problem. */
  why: string;
  /** Concrete failure path — mandatory. No grounded scenario => dropped. */
  scenario: string;
  /**
   * Exact replacement line(s) for a GitHub `suggestion` block.
   * Populated ONLY when the fix is high-confidence and local. Omit otherwise.
   */
  suggestion?: string;
}

/** One changed file plus the context we feed the model. */
export interface FileContext {
  path: string;
  /** Unified-diff patch for this file (from GitHub). */
  patch: string;
  /** Line windows around each hunk, read from the checked-out tree. */
  context: string;
}
