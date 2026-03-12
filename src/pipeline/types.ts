import type { PRData, AgentReview, CrossValidation, ReviewSession } from "../storage/types";

export type PipelineStatus =
  | "idle"
  | "fetching"
  | "reviewing"
  | "cross-validating"
  | "complete"
  | "error";

export interface StreamProgressInfo {
  activity: string;
  turnCount: number;
  toolUseCount: number;
  costUsd?: number;
  isGenerating: boolean;
  lastToolName?: string;
}

export type PipelineEvent =
  | { type: "start"; startedAt: number; prNumber: number; repo?: string }
  | { type: "fetch-start"; startedAt: number }
  | { type: "fetch-complete"; startedAt: number; prData: PRData }
  | { type: "fetch-error"; startedAt: number; error: string }
  | { type: "review-start"; startedAt: number; agentName: string }
  | { type: "review-progress"; startedAt: number; progress: StreamProgressInfo }
  | { type: "review-complete"; startedAt: number; review: AgentReview }
  | { type: "review-error"; startedAt: number; error: string }
  | { type: "cross-validation-start"; startedAt: number; validatorAgent: string }
  | { type: "cross-validation-progress"; startedAt: number; progress: StreamProgressInfo }
  | { type: "cross-validation-complete"; startedAt: number; crossValidation: CrossValidation }
  | { type: "cross-validation-error"; startedAt: number; error: string }
  | { type: "complete"; startedAt: number; session: ReviewSession }
  | { type: "error"; startedAt: number; error: string };

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
  streamProgress?: StreamProgressInfo;
  fetchStartedAt?: number;
  fetchCompletedAt?: number;
  reviewStartedAt?: number;
  reviewCompletedAt?: number;
  crossValidationStartedAt?: number;
  crossValidationCompletedAt?: number;
}
