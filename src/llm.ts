import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type Provider = "anthropic" | "openai";

/** A forced-tool-call request. Returns the parsed tool arguments, or null. */
export interface StructuredCall {
  model: string;
  system: string;
  user: string;
  toolName: string;
  /** JSON Schema for the tool's arguments. */
  schema: Record<string, unknown>;
  maxTokens: number;
}

/** Provider-agnostic LLM. review.ts / verify.ts depend only on this. */
export interface Llm {
  readonly provider: Provider;
  /** Default model for the main review pass. */
  readonly reviewModel: string;
  /** Cheaper model for the per-finding verify pass. */
  readonly verifyModel: string;
  structured(call: StructuredCall): Promise<Record<string, unknown> | null>;
}

const DEFAULTS: Record<Provider, { review: string; verify: string }> = {
  anthropic: { review: "claude-sonnet-5", verify: "claude-haiku-4-5-20251001" },
  openai: { review: "gpt-4o", verify: "gpt-4o-mini" },
};

export interface LlmConfig {
  anthropicKey?: string;
  openaiKey?: string;
  /** Optional override of the review model. */
  reviewModelOverride?: string;
}

/**
 * Pick a provider from whichever key is present. If both are set, Anthropic
 * wins (arbitrary, documented). Throws if neither key is supplied.
 */
export function makeLlm(cfg: LlmConfig): Llm {
  if (cfg.anthropicKey) return anthropicLlm(cfg.anthropicKey, cfg.reviewModelOverride);
  if (cfg.openaiKey) return openaiLlm(cfg.openaiKey, cfg.reviewModelOverride);
  throw new Error("No API key provided: set anthropic-api-key or openai-api-key.");
}

function anthropicLlm(apiKey: string, reviewOverride?: string): Llm {
  const client = new Anthropic({ apiKey });
  return {
    provider: "anthropic",
    reviewModel: reviewOverride || DEFAULTS.anthropic.review,
    verifyModel: DEFAULTS.anthropic.verify,
    async structured(c) {
      const res = await client.messages.create({
        model: c.model,
        max_tokens: c.maxTokens,
        system: c.system,
        tools: [
          { name: c.toolName, input_schema: c.schema as Anthropic.Tool.InputSchema },
        ],
        tool_choice: { type: "tool", name: c.toolName },
        messages: [{ role: "user", content: c.user }],
      });
      const call = res.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      return (call?.input as Record<string, unknown>) ?? null;
    },
  };
}

function openaiLlm(apiKey: string, reviewOverride?: string): Llm {
  const client = new OpenAI({ apiKey });
  return {
    provider: "openai",
    reviewModel: reviewOverride || DEFAULTS.openai.review,
    verifyModel: DEFAULTS.openai.verify,
    async structured(c) {
      const res = await client.chat.completions.create({
        model: c.model,
        max_tokens: c.maxTokens,
        messages: [
          { role: "system", content: c.system },
          { role: "user", content: c.user },
        ],
        tools: [
          { type: "function", function: { name: c.toolName, parameters: c.schema } },
        ],
        tool_choice: { type: "function", function: { name: c.toolName } },
      });
      const args = res.choices[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return null;
      try {
        return JSON.parse(args) as Record<string, unknown>;
      } catch {
        return null;
      }
    },
  };
}
