import React from "react";
import type { CrossValidation, AgentReview, ReasoningStep } from "../../storage/types";
import { AgentBadge } from "../shared/agent-badge";
import { AgreementIndicator } from "../shared/agreement-indicator";

interface CrossValidationViewProps {
  review: AgentReview | undefined;
  crossValidation: CrossValidation | undefined;
}

export function CrossValidationView({
  review,
  crossValidation,
}: CrossValidationViewProps) {
  if (!review || !crossValidation) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#9CA3AF">
          No cross-validation data yet. Complete a review first.
        </text>
      </box>
    );
  }

  const stepsById = new Map(
    review.reasoningChain.map((s) => [s.stepNumber, s]),
  );

  return (
    <scrollbox focused flexGrow={1} width="100%" scrollY padding={1}>
      <box flexDirection="row" gap={2} alignItems="center" marginBottom={1}>
        <box flexDirection="row" gap={1} alignItems="center">
          <AgentBadge name={crossValidation.originalAgent} />
          <text fg="#9CA3AF">vs</text>
          <AgentBadge name={crossValidation.validatorAgent} />
        </box>
        <AgreementIndicator agreement={crossValidation.overallAgreement} />
      </box>

      <box flexDirection="row" gap={2} marginBottom={1}>
        <text
          fg={
            crossValidation.validatorVerdict === "approve"
              ? "#10B981"
              : crossValidation.validatorVerdict === "request-changes"
                ? "#EF4444"
                : "#F59E0B"
          }
          attributes={1}
        >
          Validator verdict: {crossValidation.validatorVerdict.toUpperCase()}
        </text>
      </box>

      {crossValidation.items.map((item) => {
        const origStep = stepsById.get(item.stepRef);
        return (
          <box
            key={item.stepRef}
            flexDirection="column"
            padding={1}
            marginBottom={1}
            borderStyle="rounded"
            border
            borderColor={item.agrees ? "#065F46" : "#7F1D1D"}
            width="100%"
          >
            <box flexDirection="row" gap={1} alignItems="center">
              <text fg={item.agrees ? "#10B981" : "#EF4444"} attributes={1}>
                {item.agrees ? "✓ AGREE" : "✗ DISAGREE"}
              </text>
              <text fg="#6B7280">Step #{item.stepRef}</text>
              {origStep && (
                <text fg="#E5E7EB" attributes={1}>
                  {origStep.title}
                </text>
              )}
            </box>

            {origStep && (
              <text fg="#9CA3AF" marginTop={1} wrapMode="word">
                Original: {origStep.content.slice(0, 200)}
                {origStep.content.length > 200 ? "..." : ""}
              </text>
            )}

            <text fg="#D1D5DB" marginTop={1} wrapMode="word">
              Validator: {item.reasoning}
            </text>
          </box>
        );
      })}

      {crossValidation.additionalFindings.length > 0 && (
        <box flexDirection="column" marginTop={1}>
          <text fg="#F59E0B" attributes={1} marginBottom={1}>
            Additional Findings (missed by original reviewer)
          </text>
          {crossValidation.additionalFindings.map((finding) => (
            <box
              key={finding.stepNumber}
              flexDirection="column"
              padding={1}
              marginBottom={1}
              borderStyle="rounded"
              border
              borderColor="#92400E"
              width="100%"
            >
              <box flexDirection="row" gap={1}>
                <text fg="#F59E0B" attributes={1}>
                  [{finding.category.toUpperCase()}]
                </text>
                <text fg="#E5E7EB" attributes={1}>
                  {finding.title}
                </text>
              </box>
              <text fg="#D1D5DB" marginTop={1} wrapMode="word">
                {finding.content}
              </text>
              {finding.relatedFiles.length > 0 && (
                <text fg="#818CF8" marginTop={1}>
                  Files: {finding.relatedFiles.join(", ")}
                </text>
              )}
            </box>
          ))}
        </box>
      )}

      {crossValidation.disagreements.length > 0 && (
        <box flexDirection="column" marginTop={1}>
          <text fg="#EF4444" attributes={1} marginBottom={1}>
            Key Disagreements
          </text>
          {crossValidation.disagreements.map((d, i) => (
            <text key={i} fg="#FCA5A5" marginLeft={1}>
              • {d}
            </text>
          ))}
        </box>
      )}
    </scrollbox>
  );
}
