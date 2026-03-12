import type { ReasoningStep, CrossValidationItem } from "../storage/types";

export type DiscussionTopic =
  | { source: "reasoning"; step: ReasoningStep }
  | { source: "validation"; step: ReasoningStep; validationItem: CrossValidationItem }
  | { source: "additional-finding"; step: ReasoningStep };

export interface DiscussionMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
