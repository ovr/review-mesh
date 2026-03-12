import type { PRData, AgentReview, ReasoningStep } from "../storage/types";

export function buildReviewPrompt(prData: PRData): string {
  return `You are a senior code reviewer. Analyze this GitHub Pull Request thoroughly.

## PR Information
- **Title**: ${prData.metadata.title}
- **Author**: ${prData.metadata.author}
- **Branch**: ${prData.metadata.headRefName} → ${prData.metadata.baseRefName}
- **Changes**: +${prData.metadata.additions} -${prData.metadata.deletions} across ${prData.metadata.changedFiles} files

## PR Description
${prData.metadata.body || "(no description)"}

## Changed Files
${prData.files.map((f) => `- ${f.path} (+${f.additions} -${f.deletions})`).join("\n")}

## Full Diff
\`\`\`diff
${prData.diff}
\`\`\`

## Instructions
Provide a detailed code review with a structured reasoning chain. For each observation, analysis, concern, or suggestion, create a numbered step.

For each finding, include specific code locations with line numbers from the diff.
Use the line numbers from the new file side shown in diff hunk headers (@@ -old +new @@).

Respond with valid JSON matching this schema:
{
  "reasoningChain": [
    {
      "stepNumber": 1,
      "category": "observation" | "analysis" | "concern" | "suggestion" | "conclusion",
      "title": "Short title",
      "content": "Detailed explanation",
      "relatedFiles": ["file1.ts"],
      "severity": "info" | "warning" | "error" | "critical",
      "codeLocations": [{ "file": "file1.ts", "startLine": 42, "endLine": 45 }]
    }
  ],
  "summary": "Overall review summary",
  "verdict": "approve" | "request-changes" | "comment",
  "confidence": 0.85
}

Be thorough but fair. Focus on:
1. Correctness and potential bugs
2. Security concerns
3. Performance implications
4. Code quality and maintainability
5. Test coverage gaps`;
}

export function buildCrossValidationPrompt(
  originalReview: AgentReview,
  prData: PRData,
): string {
  const stepsText = originalReview.reasoningChain
    .map(
      (step) =>
        `### Step ${step.stepNumber}: [${step.category}] ${step.title}
${step.content}
Files: ${step.relatedFiles.join(", ") || "none"}
Severity: ${step.severity ?? "info"}
Code locations: ${step.codeLocations?.map((loc) => `${loc.file}:${loc.startLine}${loc.endLine ? `-${loc.endLine}` : ""}`).join(", ") || "none"}`,
    )
    .join("\n\n");

  return `You are a validator reviewing another AI agent's code review. Your job is to independently verify each reasoning step against the actual code diff.

## PR Information
- **Title**: ${prData.metadata.title}
- **Author**: ${prData.metadata.author}
- **Changes**: +${prData.metadata.additions} -${prData.metadata.deletions} across ${prData.metadata.changedFiles} files

## Full Diff
\`\`\`diff
${prData.diff}
\`\`\`

## Original Review by ${originalReview.agentName}
**Verdict**: ${originalReview.verdict} (confidence: ${originalReview.confidence})
**Summary**: ${originalReview.summary}

### Reasoning Steps to Validate:
${stepsText}

## Instructions
For EACH reasoning step above, determine if you agree or disagree based on the actual diff.
Also identify anything the original reviewer missed.
For any additional findings, include specific code locations with line numbers from the diff.
Use the line numbers from the new file side shown in diff hunk headers (@@ -old +new @@).

Respond with valid JSON matching this schema:
{
  "items": [
    {
      "stepRef": 1,
      "agrees": true | false,
      "reasoning": "Why you agree or disagree"
    }
  ],
  "overallAgreement": 0.85,
  "validatorVerdict": "approve" | "request-changes" | "comment",
  "additionalFindings": [
    {
      "stepNumber": 100,
      "category": "concern",
      "title": "Missed issue",
      "content": "Description of what was missed",
      "relatedFiles": ["file.ts"],
      "severity": "warning",
      "codeLocations": [{ "file": "file.ts", "startLine": 10, "endLine": 15 }]
    }
  ],
  "disagreements": ["Summary of key disagreements"]
}

Be objective. The original reviewer may be correct — don't disagree just to be different.`;
}

const CODE_LOCATIONS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      file: { type: "string" },
      startLine: { type: "number" },
      endLine: { type: "number" },
    },
    required: ["file", "startLine", "endLine"],
    additionalProperties: false,
  },
};

export const REVIEW_JSON_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    reasoningChain: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stepNumber: { type: "number" },
          category: {
            type: "string",
            enum: [
              "observation",
              "analysis",
              "concern",
              "suggestion",
              "conclusion",
            ],
          },
          title: { type: "string" },
          content: { type: "string" },
          relatedFiles: { type: "array", items: { type: "string" } },
          severity: {
            type: "string",
            enum: ["info", "warning", "error", "critical"],
          },
          codeLocations: CODE_LOCATIONS_SCHEMA,
        },
        required: [
          "stepNumber",
          "category",
          "title",
          "content",
          "relatedFiles",
        ],
      },
    },
    summary: { type: "string" },
    verdict: {
      type: "string",
      enum: ["approve", "request-changes", "comment"],
    },
    confidence: { type: "number" },
  },
  required: ["reasoningChain", "summary", "verdict", "confidence"],
});

export const CROSS_VALIDATION_JSON_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stepRef: { type: "number" },
          agrees: { type: "boolean" },
          reasoning: { type: "string" },
        },
        required: ["stepRef", "agrees", "reasoning"],
        additionalProperties: false,
      },
    },
    overallAgreement: { type: "number" },
    validatorVerdict: {
      type: "string",
      enum: ["approve", "request-changes", "comment"],
    },
    additionalFindings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stepNumber: { type: "number" },
          category: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          relatedFiles: { type: "array", items: { type: "string" } },
          severity: { type: "string" },
          codeLocations: CODE_LOCATIONS_SCHEMA,
        },
        required: ["stepNumber", "category", "title", "content", "relatedFiles", "severity", "codeLocations"],
        additionalProperties: false,
      },
    },
    disagreements: { type: "array", items: { type: "string" } },
  },
  required: [
    "items",
    "overallAgreement",
    "validatorVerdict",
    "additionalFindings",
    "disagreements",
  ],
  additionalProperties: false,
});
