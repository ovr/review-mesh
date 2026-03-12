import React, { useState, useCallback, useMemo } from "react";
import { useKeyboard } from "@opentui/react";
import type { CrossValidation, AgentReview, ReasoningStep, CrossValidationItem } from "../../storage/types";
import type { DiscussionTopic } from "../../discussion/types";
import { AgentBadge } from "../shared/agent-badge";
import { AgreementIndicator } from "../shared/agreement-indicator";
import { severityRank } from "../../utils/severity";

interface CrossValidationViewProps {
  review: AgentReview | undefined;
  crossValidation: CrossValidation | undefined;
  onSelect?: (topic: DiscussionTopic) => void;
}

type SelectableItem =
  | { kind: "validation"; step: ReasoningStep; validationItem: CrossValidationItem }
  | { kind: "additional"; step: ReasoningStep };

export function CrossValidationView({
  review,
  crossValidation,
  onSelect,
}: CrossValidationViewProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const stepsById = useMemo(() => {
    if (!review) return new Map<number, ReasoningStep>();
    return new Map(review.reasoningChain.map((s) => [s.stepNumber, s]));
  }, [review]);

  const selectableItems = useMemo<SelectableItem[]>(() => {
    if (!crossValidation || !review) return [];
    const items: SelectableItem[] = [];

    for (const item of crossValidation.items) {
      const origStep = stepsById.get(item.stepRef);
      if (origStep) {
        items.push({ kind: "validation", step: origStep, validationItem: item });
      }
    }

    for (const finding of crossValidation.additionalFindings) {
      items.push({ kind: "additional", step: finding });
    }

    items.sort((a, b) => severityRank(b.step.severity) - severityRank(a.step.severity));
    return items;
  }, [crossValidation, review, stepsById]);

  useKeyboard(
    useCallback(
      (e) => {
        if (selectableItems.length === 0) return;
        if (e.name === "up" || e.name === "k") {
          setFocusedIndex((i) => Math.max(0, i - 1));
        } else if (e.name === "down" || e.name === "j") {
          setFocusedIndex((i) => Math.min(selectableItems.length - 1, i + 1));
        } else if (e.name === "return" && onSelect) {
          const item = selectableItems[focusedIndex];
          if (!item) return;
          if (item.kind === "validation") {
            onSelect({ source: "validation", step: item.step, validationItem: item.validationItem });
          } else {
            onSelect({ source: "additional-finding", step: item.step });
          }
        }
      },
      [selectableItems, focusedIndex, onSelect],
    ),
  );

  if (!review || !crossValidation) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#9CA3AF">
          No cross-validation data yet. Complete a review first.
        </text>
      </box>
    );
  }

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

      {selectableItems.map((item, idx) => {
        const isFocused = idx === focusedIndex;

        if (item.kind === "validation") {
          const { step, validationItem } = item;
          return (
            <box
              key={`v-${validationItem.stepRef}`}
              flexDirection="column"
              padding={1}
              marginBottom={1}
              borderStyle="rounded"
              border
              borderColor={isFocused ? "#7C3AED" : validationItem.agrees ? "#065F46" : "#7F1D1D"}
              width="100%"
            >
              <box flexDirection="row" gap={1} alignItems="center">
                <text fg={validationItem.agrees ? "#10B981" : "#EF4444"} attributes={1}>
                  {validationItem.agrees ? "✓ AGREE" : "✗ DISAGREE"}
                </text>
                <text fg="#6B7280">Step #{validationItem.stepRef}</text>
                <text fg="#E5E7EB" attributes={1}>
                  {step.title}
                </text>
              </box>

              <text fg="#9CA3AF" marginTop={1} wrapMode="word">
                Original: {step.content.slice(0, 200)}
                {step.content.length > 200 ? "..." : ""}
              </text>

              <text fg="#D1D5DB" marginTop={1} wrapMode="word">
                Validator: {validationItem.reasoning}
              </text>
            </box>
          );
        }

        const { step } = item;
        return (
          <box
            key={`a-${step.stepNumber}`}
            flexDirection="column"
            padding={1}
            marginBottom={1}
            borderStyle="rounded"
            border
            borderColor={isFocused ? "#7C3AED" : "#92400E"}
            width="100%"
          >
            <box flexDirection="row" gap={1}>
              <text fg="#F59E0B" attributes={1}>
                [ADDITIONAL] [{step.category.toUpperCase()}]
              </text>
              <text fg="#E5E7EB" attributes={1}>
                {step.title}
              </text>
            </box>
            <text fg="#D1D5DB" marginTop={1} wrapMode="word">
              {step.content}
            </text>
            {step.relatedFiles.length > 0 && (
              <text fg="#818CF8" marginTop={1}>
                Files: {step.relatedFiles.join(", ")}
              </text>
            )}
          </box>
        );
      })}

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
