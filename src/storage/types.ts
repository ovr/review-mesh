import { z } from "zod";

// --- PR Data (from gh CLI) ---

export const PRMetadataSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string(),
  author: z.string(),
  baseRefName: z.string(),
  headRefName: z.string(),
  url: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changedFiles: z.number(),
  labels: z.array(z.string()),
});

export const PRFileSchema = z.object({
  path: z.string(),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string(),
});

export const PRCommentSchema = z.object({
  author: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const PRDataSchema = z.object({
  metadata: PRMetadataSchema,
  diff: z.string(),
  files: z.array(PRFileSchema),
  comments: z.array(PRCommentSchema),
  fetchedAt: z.string(),
});

// --- Reasoning & Review ---

export const CodeLocationSchema = z.object({
  file: z.string(),
  startLine: z.number(),
  endLine: z.number().optional(),
});

export const ReasoningStepSchema = z.object({
  stepNumber: z.number(),
  category: z.enum([
    "observation",
    "analysis",
    "concern",
    "suggestion",
    "conclusion",
  ]),
  title: z.string(),
  content: z.string(),
  relatedFiles: z.array(z.string()),
  severity: z
    .enum(["info", "warning", "error", "critical"])
    .optional(),
  codeLocations: z.array(CodeLocationSchema).optional(),
});

export const AgentReviewSchema = z.object({
  agentName: z.string(),
  modelUsed: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  rawOutput: z.string(),
  reasoningChain: z.array(ReasoningStepSchema),
  summary: z.string(),
  verdict: z.enum(["approve", "request-changes", "comment"]),
  confidence: z.number().min(0).max(1),
});

// --- Cross Validation ---

export const CrossValidationItemSchema = z.object({
  stepRef: z.number(),
  agrees: z.boolean(),
  reasoning: z.string(),
});

export const CrossValidationSchema = z.object({
  validatorAgent: z.string(),
  originalAgent: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  items: z.array(CrossValidationItemSchema),
  overallAgreement: z.number().min(0).max(1),
  validatorVerdict: z.enum(["approve", "request-changes", "comment"]),
  additionalFindings: z.array(ReasoningStepSchema),
  disagreements: z.array(z.string()),
});

// --- Review Session ---

export const ReviewSessionStatusSchema = z.enum([
  "fetching",
  "reviewing",
  "cross-validating",
  "complete",
  "error",
]);

export const ReviewSessionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  repo: z.string(),
  prNumber: z.number(),
  status: ReviewSessionStatusSchema,
  prData: PRDataSchema.optional(),
  reviews: z.array(AgentReviewSchema),
  crossValidation: CrossValidationSchema.optional(),
  error: z.string().optional(),
});

// --- TypeScript types ---

export type PRMetadata = z.infer<typeof PRMetadataSchema>;
export type PRFile = z.infer<typeof PRFileSchema>;
export type PRComment = z.infer<typeof PRCommentSchema>;
export type PRData = z.infer<typeof PRDataSchema>;
export type CodeLocation = z.infer<typeof CodeLocationSchema>;
export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;
export type AgentReview = z.infer<typeof AgentReviewSchema>;
export type CrossValidationItem = z.infer<typeof CrossValidationItemSchema>;
export type CrossValidation = z.infer<typeof CrossValidationSchema>;
export type ReviewSessionStatus = z.infer<typeof ReviewSessionStatusSchema>;
export type ReviewSession = z.infer<typeof ReviewSessionSchema>;

// --- PR List Item (from gh pr list) ---

export interface PRListItem {
  number: number;
  title: string;
  author: string;
  headRefName: string;
  updatedAt: string;
  url: string;
  labels: string[];
  isDraft: boolean;
}
