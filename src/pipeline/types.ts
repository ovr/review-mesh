import type { PRData, AgentReview, CrossValidation, ReviewSession } from "../storage/types";

export type PipelineStatus =
  | "idle"
  | "fetching"
  | "reviewing"
  | "cross-validating"
  | "complete"
  | "error";

export type PipelineEvent =
  | { type: "start"; prNumber: number; repo?: string }
  | { type: "fetch-start" }
  | { type: "fetch-complete"; prData: PRData }
  | { type: "fetch-error"; error: string }
  | { type: "review-start"; agentName: string }
  | { type: "review-complete"; review: AgentReview }
  | { type: "review-error"; error: string }
  | { type: "cross-validation-start"; validatorAgent: string }
  | { type: "cross-validation-complete"; crossValidation: CrossValidation }
  | { type: "cross-validation-error"; error: string }
  | { type: "complete"; session: ReviewSession }
  | { type: "error"; error: string };

export interface PipelineState {
  status: PipelineStatus;
  prNumber?: number;
  repo?: string;
  prData?: PRData;
  review?: AgentReview;
  crossValidation?: CrossValidation;
  session?: ReviewSession;
  error?: string;
  currentAgent?: string;
}
