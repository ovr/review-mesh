import React, { useState, useRef, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { PipelineState } from "../../pipeline/types";
import type { PRListItem } from "../../storage/types";
import { AgentBadge } from "../shared/agent-badge";
import { AgreementIndicator } from "../shared/agreement-indicator";
import { useElapsedTimer } from "../../hooks/use-elapsed-timer";
import type { ClaudeEffortLevel } from "../../agents/claude-agent";
import type { DiscussionTopic, DiscussionMessage } from "../../discussion/types";
import type { ClaudeStreamProgress } from "../../agents/claude-stream";
import { initialProgress } from "../../agents/claude-stream";
import { discussWithAgent } from "../../discussion/discussion-agent";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

interface ReviewViewProps {
  state: PipelineState;
  selectedPR: PRListItem | null;
  claudeEffort: ClaudeEffortLevel;
  discussionTopic: DiscussionTopic | null;
  onDiscussionClose: () => void;
  onDiscussionFocusChange: (focused: boolean) => void;
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

function TopicCard({ topic }: { topic: DiscussionTopic }) {
  const { step } = topic;
  const sevColor =
    step.severity === "critical"
      ? "#DC2626"
      : step.severity === "error"
        ? "#EF4444"
        : step.severity === "warning"
          ? "#F59E0B"
          : "#3B82F6";

  return (
    <box
      flexDirection="column"
      padding={1}
      borderStyle="rounded"
      border
      borderColor="#7C3AED"
      width="100%"
      marginBottom={1}
    >
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg="#6B7280">#{step.stepNumber}</text>
        <text fg={sevColor} attributes={1}>
          [{step.category.toUpperCase()}]
        </text>
        <text fg="#E5E7EB" attributes={1}>
          {step.title}
        </text>
        {step.severity && step.severity !== "info" && (
          <text fg={sevColor}>{step.severity.toUpperCase()}</text>
        )}
        {topic.source === "validation" && (
          <text fg={topic.validationItem.agrees ? "#10B981" : "#EF4444"}>
            {topic.validationItem.agrees ? "✓ Agreed" : "✗ Disagreed"}
          </text>
        )}
        <text fg="#6B7280">Esc:back</text>
      </box>

      <text fg="#D1D5DB" marginTop={1} wrapMode="word">
        {step.content}
      </text>

      {topic.source === "validation" && (
        <text fg="#9CA3AF" marginTop={1} wrapMode="word">
          Validator: {topic.validationItem.reasoning}
        </text>
      )}

      {step.relatedFiles.length > 0 && (
        <box flexDirection="row" gap={1} marginTop={1}>
          <text fg="#6B7280">Files:</text>
          <text fg="#818CF8">{step.relatedFiles.join(", ")}</text>
        </box>
      )}
    </box>
  );
}

function DiscussionView({
  topic,
  state,
  claudeEffort,
  onClose,
  onFocusChange,
}: {
  topic: DiscussionTopic;
  state: PipelineState;
  claudeEffort: ClaudeEffortLevel;
  onClose: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [streamProgress, setStreamProgress] = useState<ClaudeStreamProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useKeyboard(
    useCallback(
      (e) => {
        if (e.name === "escape") {
          onClose();
        }
      },
      [onClose],
    ),
  );

  const handleSubmit = useCallback(
    async (value: string | { value?: string }) => {
      const text = typeof value === "string" ? value : (value.value ?? "");
      const trimmed = text.trim();
      if (!trimmed || isLoading || !state.prData) return;

      setInputValue("");
      setError(null);

      const userMsg: DiscussionMessage = {
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStreamProgress(initialProgress());
      onFocusChange(true);

      try {
        const result = await discussWithAgent({
          topic,
          userMessage: trimmed,
          prData: state.prData,
          sessionId: sessionIdRef.current ?? undefined,
          effort: claudeEffort,
          onProgress: (p) => setStreamProgress(p),
        });

        sessionIdRef.current = result.sessionId;

        const assistantMsg: DiscussionMessage = {
          role: "assistant",
          content: result.response,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setError(String(err));
      } finally {
        setIsLoading(false);
        setStreamProgress(null);
        onFocusChange(false);
      }
    },
    [isLoading, state.prData, topic, claudeEffort, onFocusChange],
  );

  return (
    <box flexDirection="column" flexGrow={1} width="100%" padding={1}>
      <TopicCard topic={topic} />

      <scrollbox flexGrow={1} width="100%" scrollY>
        {messages.length === 0 && !isLoading && (
          <text fg="#9CA3AF">Type a question about this finding to start a discussion.</text>
        )}

        {messages.map((msg, i) => (
          <box key={i} flexDirection="column" marginBottom={1} width="100%">
            <text
              fg={msg.role === "user" ? "#60A5FA" : "#10B981"}
              attributes={1}
            >
              {msg.role === "user" ? "You:" : "Claude:"}
            </text>
            <text fg="#D1D5DB" wrapMode="word" marginLeft={1}>
              {msg.content}
            </text>
          </box>
        ))}

        {isLoading && streamProgress && (
          <box
            flexDirection="column"
            padding={1}
            borderStyle="rounded"
            border
            borderColor="#7C3AED"
            width="100%"
            marginBottom={1}
          >
            <box flexDirection="row" gap={2} marginBottom={0}>
              <text fg="#7C3AED" attributes={1}>
                Live Progress
              </text>
              {streamProgress.model && (
                <text fg="#6B7280">{streamProgress.model}</text>
              )}
              <text fg="#60A5FA">effort:{claudeEffort}</text>
            </box>

            <box flexDirection="row" gap={2}>
              <text fg={streamProgress.isGenerating ? "#F59E0B" : "#6B7280"}>
                {streamProgress.activity}
              </text>
            </box>

            <box flexDirection="row" gap={2}>
              <text fg="#9CA3AF">Turns: {streamProgress.turnCount}</text>
              <text fg="#9CA3AF">Tools: {streamProgress.toolUseCount}</text>
              {(streamProgress.inputTokens > 0 || streamProgress.outputTokens > 0) && (
                <text fg="#9CA3AF">
                  Tokens: {formatTokens(streamProgress.inputTokens)}↑{" "}
                  {formatTokens(streamProgress.outputTokens)}↓
                </text>
              )}
              {streamProgress.costUsd !== undefined && (
                <text fg="#9CA3AF">
                  Cost: ${streamProgress.costUsd.toFixed(4)}
                </text>
              )}
            </box>

            {streamProgress.recentTools.length > 0 && (
              <box flexDirection="column" marginTop={0}>
                <text fg="#9CA3AF" attributes={1}>
                  Recent tools:
                </text>
                {streamProgress.recentTools.map((t, i) => (
                  <text key={i} fg="#6B7280" marginLeft={1}>
                    {t.name}
                    {t.context ? `: ${t.context}` : ""}
                  </text>
                ))}
              </box>
            )}
          </box>
        )}

        {error && (
          <box
            padding={1}
            borderStyle="rounded"
            border
            borderColor="#EF4444"
            width="100%"
            marginBottom={1}
          >
            <text fg="#EF4444">{error}</text>
          </box>
        )}
      </scrollbox>

      <box flexDirection="row" width="100%" height={1} flexShrink={0}>
        <text fg="#7C3AED">&gt; </text>
        <input
          focused={!isLoading}
          value={inputValue}
          flexGrow={1}
          placeholder="Ask about this finding..."
          onInput={setInputValue}
          onSubmit={handleSubmit}
        />
      </box>
    </box>
  );
}

export function ReviewView({
  state,
  selectedPR,
  claudeEffort,
  discussionTopic,
  onDiscussionClose,
  onDiscussionFocusChange,
}: ReviewViewProps) {
  if (discussionTopic && state.prData) {
    return (
      <DiscussionView
        topic={discussionTopic}
        state={state}
        claudeEffort={claudeEffort}
        onClose={onDiscussionClose}
        onFocusChange={onDiscussionFocusChange}
      />
    );
  }

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
            <text fg="#60A5FA">effort:{claudeEffort}</text>
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
            <text fg="#60A5FA">effort:{claudeEffort}</text>
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
