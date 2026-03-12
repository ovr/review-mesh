import React from "react";
import type { PipelineState } from "../../pipeline/types";
import { useElapsedTimer } from "../../hooks/use-elapsed-timer";

interface FooterProps {
  activeTab: string;
  pipelineState: PipelineState;
}

function useActivityStatus(state: PipelineState): string | null {
  const fetchElapsed = useElapsedTimer(state.fetchStartedAt, state.fetchCompletedAt);
  const reviewElapsed = useElapsedTimer(state.reviewStartedAt, state.reviewCompletedAt);
  const crossElapsed = useElapsedTimer(state.crossValidationStartedAt, state.crossValidationCompletedAt);

  switch (state.status) {
    case "fetching":
      return `⟳ Fetching PR data... ${fetchElapsed ?? ""}`;
    case "reviewing":
      return `⟳ Claude reviewing PR... ${reviewElapsed ?? ""}`;
    case "cross-validating":
      return `⟳ Codex cross-validating... ${crossElapsed ?? ""}`;
    case "complete":
      return "✓ Review complete";
    case "error":
      return `✗ Error: ${state.error ?? "unknown"}`;
    default:
      return null;
  }
}

export function Footer({ activeTab, pipelineState }: FooterProps) {
  const hints: Record<string, string> = {
    prs: "Enter:select  r:refresh  q:quit  ←→:tabs",
    review: "r:start review  q:quit  ←→:tabs",
    reasoning: "↑↓:scroll  q:quit  ←→:tabs",
    validation: "↑↓:scroll  q:quit  ←→:tabs",
    history: "Enter:load  q:quit  ←→:tabs",
  };

  const activity = useActivityStatus(pipelineState);

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
    >
      <box flexShrink={1}>
        {activity ? (
          <text fg={pipelineState.status === "error" ? "#EF4444" : pipelineState.status === "complete" ? "#10B981" : "#F59E0B"}>
            {activity}
          </text>
        ) : (
          <text>{" "}</text>
        )}
      </box>
      <box flexShrink={0}>
        <text fg="#6B7280">{hints[activeTab] ?? "q:quit  ←→:tabs"}</text>
      </box>
    </box>
  );
}
