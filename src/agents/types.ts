import type { AgentReview, PRData, ReasoningStep } from "../storage/types";

export interface AgentConfig {
  name: string;
  displayName: string;
  color: string;
  command: string[];
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export interface AgentResult {
  rawOutput: string;
  reasoningChain: ReasoningStep[];
  summary: string;
  verdict: "approve" | "request-changes" | "comment";
  confidence: number;
  modelUsed: string;
}

export interface AgentRunner {
  readonly config: AgentConfig;
  review(prData: PRData, prompt: string): Promise<AgentResult>;
}

export interface CrossValidationInput {
  originalReview: AgentReview;
  prData: PRData;
}

export interface CrossValidationResult {
  items: Array<{
    stepRef: number;
    agrees: boolean;
    reasoning: string;
  }>;
  overallAgreement: number;
  validatorVerdict: "approve" | "request-changes" | "comment";
  additionalFindings: ReasoningStep[];
  disagreements: string[];
  rawOutput: string;
  modelUsed: string;
}
