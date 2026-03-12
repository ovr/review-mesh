import React from "react";
import type { PipelineState } from "../../pipeline/types";
import type { PRListItem } from "../../storage/types";
import { AgentBadge } from "../shared/agent-badge";
import { AgreementIndicator } from "../shared/agreement-indicator";
import { useElapsedTimer } from "../../hooks/use-elapsed-timer";
import { CLAUDE_EFFORT } from "../../agents/claude-agent";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

interface ReviewViewProps {
  state: PipelineState;
  selectedPR: PRListItem | null;
}

function StatusLine({
  label,
  done,
  active,
  startedAt,
  completedAt,
}: {
  label: string;
  done: boolean;
  active: boolean;
  startedAt?: number;
  completedAt?: number;
}) {
  const elapsed = useElapsedTimer(startedAt, completedAt);
  const icon = done ? "✓" : active ? "⟳" : "○";
  const color = done ? "#10B981" : active ? "#F59E0B" : "#6B7280";
  return (
    <box flexDirection="row" gap={1} marginY={0}>
      <text fg={color}>{icon}</text>
      <text fg={done || active ? "#E5E7EB" : "#6B7280"}>{label}</text>
      {elapsed && (
        <text fg={done ? "#6B7280" : "#F59E0B"}>{elapsed}</text>
      )}
    </box>
  );
}

export function ReviewView({ state, selectedPR }: ReviewViewProps) {
  if (!selectedPR && state.status === "idle") {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" gap={1}>
        <text fg="#9CA3AF">Select a PR from the PRs tab to start a review</text>
        <text fg="#6B7280">Then press r to begin</text>
      </box>
    );
  }

  const isFetching = state.status === "fetching";
  const isReviewing = state.status === "reviewing";
  const isCrossValidating = state.status === "cross-validating";
  const isComplete = state.status === "complete";
  const isError = state.status === "error";

  const fetchDone = !!state.prData;
  const reviewDone = !!state.review;
  const crossDone = !!state.crossValidation;

  return (
    <scrollbox focused flexGrow={1} width="100%" scrollY padding={1}>
      {selectedPR && (
        <box flexDirection="column" marginBottom={1}>
          <text fg="#E5E7EB" attributes={1}>
            #{selectedPR.number} {selectedPR.title}
          </text>
          <text fg="#9CA3AF">
            {selectedPR.author} → {selectedPR.headRefName}
          </text>
        </box>
      )}

      <box flexDirection="column" gap={0} marginBottom={1}>
        <text fg="#7C3AED" attributes={1} marginBottom={1}>Pipeline Progress</text>
        <StatusLine label="Fetch PR data" done={fetchDone} active={isFetching} startedAt={state.fetchStartedAt} completedAt={state.fetchCompletedAt} />
        <StatusLine label="Primary review (Claude)" done={reviewDone} active={isReviewing} startedAt={state.reviewStartedAt} completedAt={state.reviewCompletedAt} />
        <StatusLine label="Cross-validation (Codex)" done={crossDone} active={isCrossValidating} startedAt={state.crossValidationStartedAt} completedAt={state.crossValidationCompletedAt} />
      </box>

      {(isReviewing || isCrossValidating) && state.streamProgress && (
        <box flexDirection="column" marginBottom={1} padding={1} borderStyle="rounded" border borderColor="#7C3AED">
          <box flexDirection="row" gap={2} marginBottom={0}>
            <text fg="#7C3AED" attributes={1}>Live Progress</text>
            {state.streamProgress.model && (
              <text fg="#6B7280">{state.streamProgress.model}</text>
            )}
            <text fg="#60A5FA">effort:{CLAUDE_EFFORT}</text>
          </box>

          <box flexDirection="row" gap={2}>
            <text fg={state.streamProgress.isGenerating ? "#F59E0B" : "#6B7280"}>
              {state.streamProgress.activity}
            </text>
          </box>

          <box flexDirection="row" gap={2}>
            <text fg="#9CA3AF">Turns: {state.streamProgress.turnCount}</text>
            <text fg="#9CA3AF">Tools: {state.streamProgress.toolUseCount}</text>
            {(state.streamProgress.inputTokens > 0 || state.streamProgress.outputTokens > 0) && (
              <text fg="#9CA3AF">
                Tokens: {formatTokens(state.streamProgress.inputTokens)}↑ {formatTokens(state.streamProgress.outputTokens)}↓
              </text>
            )}
            {state.streamProgress.costUsd !== undefined && (
              <text fg="#9CA3AF">Cost: ${state.streamProgress.costUsd.toFixed(4)}</text>
            )}
          </box>

          {state.streamProgress.textPreview && (
            <box marginTop={0}>
              <text fg="#6B7280">
                {state.streamProgress.textPreview}
              </text>
            </box>
          )}

          {state.streamProgress.recentTools.length > 0 && (
            <box flexDirection="column" marginTop={0}>
              <text fg="#9CA3AF" attributes={1}>Recent tools:</text>
              {state.streamProgress.recentTools.map((t, i) => (
                <text key={i} fg="#6B7280" marginLeft={1}>
                  {t.name}{t.context ? `: ${t.context}` : ""}
                </text>
              ))}
            </box>
          )}
        </box>
      )}

      {isError && state.error && (
        <box marginTop={1} padding={1} borderStyle="rounded" border borderColor="#EF4444">
          <text fg="#EF4444">{state.error}</text>
        </box>
      )}

      {state.review && (
        <box flexDirection="column" marginTop={1} padding={1} borderStyle="rounded" border borderColor="#374151">
          <box flexDirection="row" gap={1} alignItems="center" marginBottom={1}>
            <AgentBadge name={state.review.agentName} />
            <text fg="#E5E7EB" attributes={1}>Primary Review</text>
          </box>

          <box flexDirection="row" gap={2} marginBottom={1}>
            <text fg={state.review.verdict === "approve" ? "#10B981" : state.review.verdict === "request-changes" ? "#EF4444" : "#F59E0B"} attributes={1}>
              {state.review.verdict.toUpperCase()}
            </text>
            <text fg="#9CA3AF">
              Confidence: {Math.round(state.review.confidence * 100)}%
            </text>
            <text fg="#9CA3AF">
              {state.review.reasoningChain.length} steps
            </text>
            <text fg="#9CA3AF">
              {(state.review.durationMs / 1000).toFixed(1)}s
            </text>
            <text fg="#60A5FA">effort:{CLAUDE_EFFORT}</text>
          </box>

          <text fg="#D1D5DB">{state.review.summary}</text>
        </box>
      )}

      {state.crossValidation && (
        <box flexDirection="column" marginTop={1} padding={1} borderStyle="rounded" border borderColor="#374151">
          <box flexDirection="row" gap={1} alignItems="center" marginBottom={1}>
            <AgentBadge name={state.crossValidation.validatorAgent} />
            <text fg="#E5E7EB" attributes={1}>Cross-Validation</text>
          </box>

          <AgreementIndicator agreement={state.crossValidation.overallAgreement} />

          {state.crossValidation.disagreements.length > 0 && (
            <box flexDirection="column" marginTop={1}>
              <text fg="#EF4444" attributes={1}>Disagreements:</text>
              {state.crossValidation.disagreements.map((d, i) => (
                <text key={i} fg="#FCA5A5" marginLeft={1}>• {d}</text>
              ))}
            </box>
          )}
        </box>
      )}

      {isComplete && (
        <box marginTop={1}>
          <text fg="#10B981" attributes={1}>Review complete. Check Reasoning and Validation tabs for details.</text>
        </box>
      )}
    </scrollbox>
  );
}
