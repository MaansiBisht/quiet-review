<div align="center">

# quiet-review

**An AI PR reviewer that stays quiet.**

Comments only when a change plausibly introduces a bug or alters behavior.
Silence is the expected output.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Action](https://img.shields.io/badge/GitHub-Action-2088FF?logo=githubactions&logoColor=white)](action.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Providers](https://img.shields.io/badge/LLM-Anthropic%20%7C%20OpenAI-8A2BE2)](#provider)

</div>

---

Most AI reviewers comment on everything — style, naming, "consider
extracting" — so teams mute them. **quiet-review** does the opposite: it
reviews like a careful human, and says nothing unless it's confident it
found a real bug or behavior change.

## Contents

- [Why](#why)
- [Install](#install)
- [Provider](#provider)
- [Inputs](#inputs)
- [How it works](#how-it-works)
- [Privacy](#privacy)
- [License](#license)

## Why

| | |
|---|---|
| 🤫 **Silent by default** | No comment is the expected output for most diffs. It earns attention by rarely spending it. |
| 🔍 **Grounded, not guessy** | Reads the diff plus surrounding code, and fetches supporting definitions on demand. If it can't ground a finding, it stays silent instead of hallucinating a bug. |
| ✅ **Actionable** | High-confidence fixes get a one-click GitHub `suggestion`. Lower-confidence findings get an explanation in prose instead of a fabricated patch. |
| 🔒 **Zero hosting** | Runs in your CI, on your API key. Nothing is hosted by us. |

## Install

Add `.github/workflows/quiet-review.yml` to your repo:

```yaml
name: quiet-review
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4          # required: gives the reviewer repo context
      - uses: <your-org>/quiet-review@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          # or, instead:
          # openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

Add the matching secret to the repo (**Settings → Secrets and variables →
Actions**). That's it — every PR from now on gets reviewed.

## Provider

Bring **either** an Anthropic or an OpenAI key — whichever you provide is
used (Anthropic wins if you set both).

| Provider | Default model |
|---|---|
| Anthropic | `claude-sonnet-5` |
| OpenAI | `gpt-4o` |

Override with the `model` input.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `anthropic-api-key` | one of* | — | Anthropic API key (a repo secret). |
| `openai-api-key` | one of* | — | OpenAI API key (a repo secret). |
| `model` | no | per provider | Review model id override. |
| `min-severity` | no | `bug` | Lowest severity to comment on. |

\* Provide exactly one of `anthropic-api-key` / `openai-api-key`.

## How it works

```
PR opened/updated
       │
       ▼
1. Read changed files + each hunk's enclosing scope
       │
       ▼
2. Review the change — grep the checked-out tree for symbols
   it can't see (a called function, a type, a caller) instead
   of guessing
       │
       ▼
3. Severity gate — keep only bugs & behavior changes
       │
       ▼
4. Verification pass — drop anything inferred from code
   it didn't actually read
       │
       ▼
5. Post survivors as inline comments (with `suggestion` blocks
   where confident). Nothing survives → nothing posted.
```

## Privacy

The diff and any snippets the reviewer fetches are sent to your chosen AI
provider (Anthropic or OpenAI) using **your** key. No repo content leaves
your CI otherwise, and quiet-review stores nothing.

## License

[MIT](LICENSE)
