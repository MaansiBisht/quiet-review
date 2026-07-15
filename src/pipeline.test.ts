import { test } from "node:test";
import assert from "node:assert/strict";

import { newSideHunkRanges } from "./context";
import { gate, parseSeverity } from "./gate";
import { Finding } from "./types";

test("newSideHunkRanges parses new-side ranges from a multi-hunk patch", () => {
  const patch = [
    "@@ -1,3 +1,4 @@",
    " a",
    "+b",
    "@@ -20,0 +22,2 @@",
    "+x",
    "+y",
    "@@ -50 +60 @@", // no counts => count defaults to 1
    "-old",
    "+new",
  ].join("\n");

  assert.deepEqual(newSideHunkRanges(patch), [
    { start: 1, count: 4 },
    { start: 22, count: 2 },
    { start: 60, count: 1 },
  ]);
});

test("gate keeps bug-only when min-severity is bug", () => {
  const findings: Finding[] = [
    { file: "a.ts", line: 1, severity: "bug", why: "x", scenario: "y" },
    { file: "a.ts", line: 2, severity: "behavior-change", why: "x", scenario: "y" },
  ];
  const kept = gate(findings, "bug");
  assert.equal(kept.length, 1);
  assert.equal(kept[0].severity, "bug");
});

test("gate keeps both when min-severity is behavior-change", () => {
  const findings: Finding[] = [
    { file: "a.ts", line: 1, severity: "bug", why: "x", scenario: "y" },
    { file: "a.ts", line: 2, severity: "behavior-change", why: "x", scenario: "y" },
  ];
  assert.equal(gate(findings, "behavior-change").length, 2);
});

test("parseSeverity defaults to bug on junk", () => {
  assert.equal(parseSeverity("nonsense"), "bug");
  assert.equal(parseSeverity("behavior-change"), "behavior-change");
});
