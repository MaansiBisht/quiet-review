import * as core from "@actions/core";
import * as github from "@actions/github";

import { buildContext } from "./context";
import { reviewFiles } from "./review";
import { gate, parseSeverity } from "./gate";
import { verifyFindings } from "./verify";
import { getChangedFiles, postReview, PullRef } from "./github";
import { makeLlm } from "./llm";
import { FileContext } from "./types";

/** Cap files reviewed per PR to bound cost; log when we truncate (never silent). */
const MAX_FILES = 40;

async function run(): Promise<void> {
  const token = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
  const minSeverity = parseSeverity(core.getInput("min-severity") || "bug");

  const llm = makeLlm({
    anthropicKey: core.getInput("anthropic-api-key") || undefined,
    openaiKey: core.getInput("openai-api-key") || undefined,
    reviewModelOverride: core.getInput("model") || undefined,
  });
  core.info(`Reviewing with ${llm.provider} (${llm.reviewModel}).`);

  const pull = github.context.payload.pull_request;
  if (!pull) {
    core.info("Not a pull_request event — nothing to review.");
    return;
  }

  const pr: PullRef = {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: pull.number,
  };

  const octokit = github.getOctokit(token);

  let changed = await getChangedFiles(octokit, pr);
  if (changed.length > MAX_FILES) {
    core.warning(
      `PR changes ${changed.length} files; reviewing the first ${MAX_FILES}. ` +
        `${changed.length - MAX_FILES} files skipped.`,
    );
    changed = changed.slice(0, MAX_FILES);
  }

  const files: FileContext[] = buildContext(changed);
  const contextByPath = new Map(files.map((f) => [f.path, f]));

  const raw = await reviewFiles(llm, files);
  for (const f of raw) {
    core.info(`raw finding: ${f.file}:${f.line} [${f.severity}] ${f.why}`);
  }
  const gated = gate(raw, minSeverity);
  for (const f of raw.filter((f) => !gated.includes(f))) {
    core.info(`gate dropped: ${f.file}:${f.line} [${f.severity}] (min-severity: ${minSeverity})`);
  }
  const confirmed = await verifyFindings(llm, gated, contextByPath);

  core.info(
    `findings: ${raw.length} raw → ${gated.length} after gate → ${confirmed.length} confirmed`,
  );

  await postReview(octokit, pr, confirmed);

  if (confirmed.length === 0) core.info("Nothing worth commenting on. Staying quiet.");
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
