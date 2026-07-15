import * as github from "@actions/github";
import { Finding } from "./types";

type Octokit = ReturnType<typeof github.getOctokit>;

export interface PullRef {
  owner: string;
  repo: string;
  pull_number: number;
}

export interface ChangedFile {
  path: string;
  patch?: string;
}

/** All files changed in the PR, with their unified-diff patch. */
export async function getChangedFiles(
  octokit: Octokit,
  pr: PullRef,
): Promise<ChangedFile[]> {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.pull_number,
    per_page: 100,
  });
  return files.map((f) => ({ path: f.filename, patch: f.patch }));
}

/**
 * Post findings as a single review with inline comments. Posts nothing when
 * there are no findings — the common, healthy path.
 *
 * ponytail: no dedupe yet, so re-running on `synchronize` can repeat comments.
 * Add dedupe-against-existing in M2.
 */
export async function postReview(
  octokit: Octokit,
  pr: PullRef,
  findings: Finding[],
): Promise<void> {
  if (findings.length === 0) return;

  const comments = findings.map((f) => ({
    path: f.file,
    line: f.line,
    side: "RIGHT" as const,
    body: commentBody(f),
  }));

  await octokit.rest.pulls.createReview({
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.pull_number,
    event: "COMMENT",
    comments,
  });
}

function commentBody(f: Finding): string {
  const tag = f.severity === "bug" ? "⚠️ Possible bug" : "🔀 Behavior change";
  let body = `**${tag}** — ${f.why}\n\n_${f.scenario}_`;
  if (f.suggestion !== undefined) {
    body += `\n\n\`\`\`suggestion\n${f.suggestion}\n\`\`\``;
  }
  return body;
}
