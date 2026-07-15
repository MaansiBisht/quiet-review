import { Finding, FileContext } from "./types";
import { VERIFY_SYSTEM } from "./prompts";
import { Llm } from "./llm";

const MAX_TOKENS = 512;

const VERDICT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    grounded: {
      type: "boolean",
      description: "True only if the finding is real and fully supported by the code shown.",
    },
    reason: { type: "string" },
  },
  required: ["grounded", "reason"],
};

/**
 * Keep only findings that survive the grounding check. Runs concurrently.
 * On any verifier error we DROP the finding — silence is the safe default.
 */
export async function verifyFindings(
  llm: Llm,
  findings: Finding[],
  contextByPath: Map<string, FileContext>,
): Promise<Finding[]> {
  const checks = await Promise.all(
    findings.map((f) => isGrounded(llm, f, contextByPath.get(f.file))),
  );
  return findings.filter((_, i) => checks[i]);
}

async function isGrounded(
  llm: Llm,
  finding: Finding,
  ctx: FileContext | undefined,
): Promise<boolean> {
  if (!ctx) return false; // no context to ground against => drop

  try {
    const out = await llm.structured({
      model: llm.verifyModel,
      system: VERIFY_SYSTEM,
      user: `Finding:
- file: ${finding.file}
- line: ${finding.line}
- severity: ${finding.severity}
- why: ${finding.why}
- scenario: ${finding.scenario}

Diff:
\`\`\`diff
${ctx.patch}
\`\`\`

Surrounding code (line numbers are the new file):
\`\`\`
${ctx.context}
\`\`\``,
      toolName: "verdict",
      schema: VERDICT_SCHEMA,
      maxTokens: MAX_TOKENS,
    });
    return (out as { grounded?: boolean } | null)?.grounded === true;
  } catch {
    return false;
  }
}
