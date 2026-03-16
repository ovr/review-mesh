import React, { useState, useCallback, useRef } from "react";
import { useKeyboard } from "@opentui/react";
import { Header } from "./components/layout/header";
import { Footer } from "./components/layout/footer";
import { Navigation, TAB_OPTIONS } from "./components/layout/navigation";
import { PRListView } from "./components/views/pr-list-view";
import { ReviewView } from "./components/views/review-view";
import { ReasoningChainView } from "./components/views/reasoning-chain-view";
import { CrossValidationView } from "./components/views/cross-validation-view";
import { HistoryView } from "./components/views/history-view";
import { DiffView } from "./components/views/diff-view";
import type { PRListItem, ReasoningStep, ReviewSession } from "./storage/types";
import type { PipelineState } from "./pipeline/types";
import { ReviewPipeline, reducePipelineState } from "./pipeline/review-pipeline";
import { CommandInput } from "./components/layout/command-input";
import { DEFAULT_CLAUDE_EFFORT, type ClaudeEffortLevel } from "./agents/claude-agent";
import type { DiscussionTopic } from "./discussion/types";

interface AppProps {
  repo?: string;
  initialPR?: number;
}

export function App({ repo, initialPR }: AppProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedPR, setSelectedPR] = useState<PRListItem | null>(null);
  const [pipelineState, setPipelineState] = useState<PipelineState>({
    status: "idle",
  });
  const pipelineRef = useRef<ReviewPipeline | null>(null);
  const [claudeEffort, setClaudeEffort] = useState<ClaudeEffortLevel>(DEFAULT_CLAUDE_EFFORT as ClaudeEffortLevel);
  const commandInputFocusedRef = useRef(false);
  const setCommandInputFocused = useCallback((focused: boolean) => {
    commandInputFocusedRef.current = focused;
  }, []);

  const [discussionTopic, setDiscussionTopic] = useState<DiscussionTopic | null>(null);
  const [discussionSourceTab, setDiscussionSourceTab] = useState(3);

  const activeTab = TAB_OPTIONS[tabIndex]?.value ?? "prs";

  const startReview = useCallback(async () => {
    const pr = selectedPR;
    if (!pr) return;
    if (
      pipelineState.status !== "idle" &&
      pipelineState.status !== "complete" &&
      pipelineState.status !== "error"
    )
      return;

    const pipeline = new ReviewPipeline();
    pipelineRef.current = pipeline;

    pipeline.onEvent((event) => {
      setPipelineState((prev) => reducePipelineState(prev, event));
    });

    setPipelineState({ status: "idle" });
    setTabIndex(1); // Switch to Review tab
    setDiscussionTopic(null);

    try {
      await pipeline.run(pr.number, repo, { claudeEffort });
    } catch {
      // errors are handled via pipeline events
    }
  }, [selectedPR, pipelineState.status, repo, claudeEffort]);

  const loadSession = useCallback((session: ReviewSession) => {
    const review = session.reviews[0];
    setPipelineState({
      status: session.status === "complete" ? "complete" : session.status as any,
      prNumber: session.prNumber,
      repo: session.repo,
      prData: session.prData,
      review,
      crossValidation: session.crossValidation,
      session,
      error: session.error,
    });
    if (session.prData) {
      setSelectedPR({
        number: session.prNumber,
        title: session.prData.metadata.title,
        author: session.prData.metadata.author,
        headRefName: session.prData.metadata.headRefName,
        updatedAt: session.prData.fetchedAt,
        url: session.prData.metadata.url,
        labels: session.prData.metadata.labels,
        isDraft: false,
      });
    }
    setTabIndex(1); // Switch to Review tab
  }, []);

  const handleEffortChange = useCallback((_provider: string, effort: ClaudeEffortLevel) => {
    setClaudeEffort(effort);
  }, []);

  const handleReasoningSelect = useCallback((step: ReasoningStep) => {
    setDiscussionTopic({ source: "reasoning", step });
    setDiscussionSourceTab(tabIndex);
    setTabIndex(1); // Switch to Review tab
  }, [tabIndex]);

  const handleValidationSelect = useCallback((topic: DiscussionTopic) => {
    setDiscussionTopic(topic);
    setDiscussionSourceTab(tabIndex);
    setTabIndex(1); // Switch to Review tab
  }, [tabIndex]);

  const handleDiscussionClose = useCallback(() => {
    setDiscussionTopic(null);
    setTabIndex(discussionSourceTab);
  }, [discussionSourceTab]);

  useKeyboard((key) => {
    if (commandInputFocusedRef.current) return;
    if (key.name === "q" && !key.ctrl && !key.meta) {
      process.exit(0);
    }
    if (key.name === "left" && !key.ctrl && !key.meta) {
      setTabIndex((prev) => (prev > 0 ? prev - 1 : TAB_OPTIONS.length - 1));
    }
    if (key.name === "right" && !key.ctrl && !key.meta) {
      setTabIndex((prev) => (prev < TAB_OPTIONS.length - 1 ? prev + 1 : 0));
    }
  });

  const handlePRSelect = useCallback((pr: PRListItem) => {
    setSelectedPR(pr);
    setDiscussionTopic(null);
    setTabIndex(1); // Switch to Review tab
  }, []);

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Header
        repo={repo}
        prNumber={selectedPR?.number}
        prTitle={selectedPR?.title}
      />

      <Navigation selectedIndex={tabIndex} onTabChange={setTabIndex} />

      <box flexGrow={1} width="100%">
        {activeTab === "prs" && (
          <PRListView repo={repo} onSelect={handlePRSelect} />
        )}
        {activeTab === "review" && (
          <ReviewView
            state={pipelineState}
            selectedPR={selectedPR}
            claudeEffort={claudeEffort}
            discussionTopic={discussionTopic}
            onRestart={startReview}
            onDiscussionClose={handleDiscussionClose}
            onDiscussionFocusChange={setCommandInputFocused}
          />
        )}
        {activeTab === "diff" && (
          <DiffView
            prData={pipelineState.prData}
            annotations={(() => {
              const steps: ReasoningStep[] = [];
              if (pipelineState.review?.reasoningChain) {
                for (const s of pipelineState.review.reasoningChain) {
                  if (s.codeLocations?.length) steps.push(s);
                }
              }
              if (pipelineState.crossValidation?.additionalFindings) {
                for (const s of pipelineState.crossValidation.additionalFindings) {
                  if (s.codeLocations?.length) steps.push(s);
                }
              }
              return steps.length > 0 ? steps : undefined;
            })()}
          />
        )}
        {activeTab === "reasoning" && (
          <ReasoningChainView review={pipelineState.review} onSelect={handleReasoningSelect} />
        )}
        {activeTab === "validation" && (
          <CrossValidationView
            review={pipelineState.review}
            crossValidation={pipelineState.crossValidation}
            onSelect={handleValidationSelect}
          />
        )}
        {activeTab === "history" && <HistoryView onSelect={loadSession} />}
      </box>

      <CommandInput
        claudeEffort={claudeEffort}
        onEffortChange={handleEffortChange}
        onFocusChange={setCommandInputFocused}
      />

      <Footer activeTab={activeTab} pipelineState={pipelineState} />
    </box>
  );
}
