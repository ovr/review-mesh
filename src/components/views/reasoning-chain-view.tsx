import React from "react";
import type { ReasoningStep, AgentReview } from "../../storage/types";
import { AgentBadge } from "../shared/agent-badge";

interface ReasoningChainViewProps {
  review: AgentReview | undefined;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: "#3B82F6",
  warning: "#F59E0B",
  error: "#EF4444",
  critical: "#DC2626",
};

const CATEGORY_ICONS: Record<string, string> = {
  observation: "👁",
  analysis: "🔍",
  concern: "⚠",
  suggestion: "💡",
  conclusion: "📋",
};

function StepCard({ step }: { step: ReasoningStep }) {
  const sevColor = SEVERITY_COLORS[step.severity ?? "info"] ?? "#6B7280";
  const icon = CATEGORY_ICONS[step.category] ?? "•";

  return (
    <box
      flexDirection="column"
      padding={1}
      marginBottom={1}
      borderStyle="rounded"
      border
      borderColor="#374151"
      width="100%"
    >
      <box flexDirection="row" gap={1} alignItems="center" marginBottom={0}>
        <text fg="#6B7280">#{step.stepNumber}</text>
        <text fg={sevColor} attributes={1}>
          [{step.category.toUpperCase()}]
        </text>
        <text fg="#E5E7EB" attributes={1}>
          {step.title}
        </text>
        {step.severity && step.severity !== "info" && (
          <text fg={sevColor}>
            {step.severity.toUpperCase()}
          </text>
        )}
      </box>

      <text fg="#D1D5DB" marginTop={1} wrapMode="word">
        {step.content}
      </text>

      {step.relatedFiles.length > 0 && (
        <box flexDirection="row" gap={1} marginTop={1}>
          <text fg="#6B7280">Files:</text>
          <text fg="#818CF8">{step.relatedFiles.join(", ")}</text>
        </box>
      )}
    </box>
  );
}

export function ReasoningChainView({ review }: ReasoningChainViewProps) {
  if (!review) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#9CA3AF">No review data yet. Run a review first.</text>
      </box>
    );
  }

  return (
    <scrollbox focused flexGrow={1} width="100%" scrollY padding={1}>
      <box flexDirection="row" gap={1} alignItems="center" marginBottom={1}>
        <AgentBadge name={review.agentName} />
        <text fg="#E5E7EB" attributes={1}>
          Reasoning Chain — {review.reasoningChain.length} steps
        </text>
      </box>

      {review.reasoningChain.map((step) => (
        <StepCard key={step.stepNumber} step={step} />
      ))}
    </scrollbox>
  );
}
