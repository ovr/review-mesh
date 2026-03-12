import type { PRData } from "../../src/storage/types";

// --- Review JSON fixtures ---

export const VALID_REVIEW_JSON = JSON.stringify({
  reasoningChain: [
    {
      stepNumber: 1,
      category: "observation",
      title: "New endpoint added",
      content: "A new REST endpoint was added for user profiles.",
      relatedFiles: ["src/routes/profile.ts"],
      severity: "info",
    },
    {
      stepNumber: 2,
      category: "concern",
      title: "Missing input validation",
      content: "The endpoint does not validate the request body.",
      relatedFiles: ["src/routes/profile.ts"],
      severity: "warning",
    },
  ],
  summary: "The PR adds a profile endpoint but lacks input validation.",
  verdict: "request-changes",
  confidence: 0.85,
});

export const MINIMAL_REVIEW_JSON = JSON.stringify({
  summary: "Looks fine overall.",
});

export const MULTI_LINE_OUTPUT = [
  "Starting codex review...",
  "Processing files...",
  "Analysis complete.",
  VALID_REVIEW_JSON,
].join("\n");

export const EMBEDDED_JSON_OUTPUT = `Here is my analysis:\n${VALID_REVIEW_JSON}\nEnd of review.`;

export const GARBAGE_OUTPUT = [
  "Error: something went wrong",
  "Stack trace: ...",
  "No JSON here at all",
].join("\n");

// --- Cross-validation JSON fixtures ---

export const VALID_CROSS_VALIDATION_JSON = JSON.stringify({
  items: [
    {
      stepRef: 1,
      agrees: true,
      reasoning: "The observation about the new endpoint is accurate.",
    },
    {
      stepRef: 2,
      agrees: false,
      reasoning: "Input validation is present via middleware.",
    },
  ],
  overallAgreement: 0.75,
  validatorVerdict: "approve",
  additionalFindings: [
    {
      stepNumber: 3,
      category: "suggestion",
      title: "Add rate limiting",
      content: "Consider adding rate limiting to the new endpoint.",
      relatedFiles: ["src/routes/profile.ts"],
      severity: "info",
    },
  ],
  disagreements: ["Disagrees on input validation concern"],
});

export const MINIMAL_CROSS_VALIDATION_JSON = JSON.stringify({
  overallAgreement: 0.9,
});

// --- Mock PRData ---

export const MOCK_PR_DATA: PRData = {
  metadata: {
    number: 42,
    title: "Add user profile endpoint",
    body: "This PR adds a new endpoint for user profiles.",
    author: "testuser",
    baseRefName: "main",
    headRefName: "feature/profile",
    url: "https://github.com/test/repo/pull/42",
    additions: 50,
    deletions: 10,
    changedFiles: 3,
    labels: ["enhancement"],
  },
  diff: "diff --git a/src/routes/profile.ts b/src/routes/profile.ts\n+export function getProfile() {}",
  files: [
    {
      path: "src/routes/profile.ts",
      additions: 50,
      deletions: 10,
      patch: "+export function getProfile() {}",
    },
  ],
  comments: [
    {
      author: "reviewer1",
      body: "Looks good but needs validation.",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ],
  fetchedAt: "2026-01-01T12:00:00Z",
};
