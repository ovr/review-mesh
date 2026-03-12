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
import type { PRListItem, ReviewSession } from "./storage/types";
import type { PipelineState } from "./pipeline/types";
import { ReviewPipeline, reducePipelineState } from "./pipeline/review-pipeline";

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

    try {
      await pipeline.run(pr.number, repo);
    } catch {
      // errors are handled via pipeline events
    }
  }, [selectedPR, pipelineState.status, repo]);

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

  useKeyboard((key) => {
    if (key.name === "q" && !key.ctrl && !key.meta) {
      process.exit(0);
    }
    if (key.name === "r" && !key.ctrl && !key.meta) {
      startReview();
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
          <ReviewView state={pipelineState} selectedPR={selectedPR} />
        )}
        {activeTab === "diff" && (
          <DiffView prData={pipelineState.prData} />
        )}
        {activeTab === "reasoning" && (
          <ReasoningChainView review={pipelineState.review} />
        )}
        {activeTab === "validation" && (
          <CrossValidationView
            review={pipelineState.review}
            crossValidation={pipelineState.crossValidation}
          />
        )}
        {activeTab === "history" && <HistoryView onSelect={loadSession} />}
      </box>

      <Footer activeTab={activeTab} pipelineState={pipelineState} />
    </box>
  );
}
