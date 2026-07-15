import { Finding, FileContext } from "./types";
import { REVIEW_SYSTEM, reviewUserMessage } from "./prompts";
import { Llm } from "./llm";

const MAX_TOKENS = 4096;

const FINDINGS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: {
            type: "integer",
            description: "Line number in the NEW version of the file.",
          },
          severity: { type: "string", enum: ["bug", "behavior-change"] },
          why: { type: "string", description: "One-line statement of the problem." },
          scenario: {
            type: "string",
            description: "Concrete inputs/state that trigger the wrong behavior.",
          },
          suggestion: {
            type: "string",
            description:
              "Exact replacement line(s). Include ONLY for a high-confidence, local fix.",
          },
        },
        required: ["file", "line", "severity", "why", "scenario"],
      },
    },
  },
  required: ["findings"],
};

/** Single review pass over all changed files. Returns raw findings (pre-gate). */
export async function reviewFiles(llm: Llm, files: FileContext[]): Promise<Finding[]> {
  if (files.length === 0) return [];

  const out = await llm.structured({
    model: llm.reviewModel,
    system: REVIEW_SYSTEM,
    user: reviewUserMessage(files),
    toolName: "report_findings",
    schema: FINDINGS_SCHEMA,
    maxTokens: MAX_TOKENS,
  });

  if (!out || !Array.isArray(out.findings)) return [];
  return out.findings.filter(isFinding);
}

function isFinding(f: unknown): f is Finding {
  if (typeof f !== "object" || f === null) return false;
  const x = f as Record<string, unknown>;
  return (
    typeof x.file === "string" &&
    typeof x.line === "number" &&
    (x.severity === "bug" || x.severity === "behavior-change") &&
    typeof x.why === "string" &&
    typeof x.scenario === "string" &&
    (x.suggestion === undefined || typeof x.suggestion === "string")
  );
}
