import type { ReviewSession, AgentReview } from "../storage/types";
import type { PipelineEvent, PipelineState } from "./types";
import { fetchPR } from "../github/pr-fetcher";
import { ClaudeAgent } from "../agents/claude-agent";
import { buildReviewPrompt } from "../agents/prompts";
import { runCrossValidation } from "./cross-validator";
import { saveSession } from "../storage/store";
import { generateId } from "../utils/id";
import { log } from "../utils/logger";

export type PipelineListener = (event: PipelineEvent) => void;

export class ReviewPipeline {
  private listeners: PipelineListener[] = [];

  onEvent(listener: PipelineListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: PipelineEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async run(prNumber: number, repo?: string): Promise<ReviewSession> {
    const sessionId = generateId();
    const repoName = repo ?? "local";

    this.emit({ type: "start", prNumber, repo });

    // Step 1: Fetch PR data
    this.emit({ type: "fetch-start" });
    let session: ReviewSession;
    try {
      const prData = await fetchPR(prNumber, repo);
      session = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        repo: repoName,
        prNumber,
        status: "fetching",
        prData,
        reviews: [],
      };
      this.emit({ type: "fetch-complete", prData });
    } catch (err) {
      const error = String(err);
      this.emit({ type: "fetch-error", error });
      throw err;
    }

    // Step 2: Primary review (Claude)
    session.status = "reviewing";
    await saveSession(session);

    this.emit({ type: "review-start", agentName: "claude" });
    let review: AgentReview;
    try {
      const claude = new ClaudeAgent();
      const prompt = buildReviewPrompt(session.prData!);
      const startedAt = new Date().toISOString();
      const startMs = Date.now();

      const result = await claude.review(session.prData!, prompt);

      review = {
        agentName: claude.config.name,
        modelUsed: result.modelUsed,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        rawOutput: result.rawOutput,
        reasoningChain: result.reasoningChain,
        summary: result.summary,
        verdict: result.verdict,
        confidence: result.confidence,
      };
      session.reviews.push(review);
      this.emit({ type: "review-complete", review });
    } catch (err) {
      const error = String(err);
      session.status = "error";
      session.error = error;
      await saveSession(session);
      this.emit({ type: "review-error", error });
      throw err;
    }

    // Step 3: Cross-validation (Codex)
    session.status = "cross-validating";
    await saveSession(session);

    this.emit({ type: "cross-validation-start", validatorAgent: "codex" });
    try {
      const crossValidation = await runCrossValidation(review, session.prData!);
      session.crossValidation = crossValidation;
      this.emit({ type: "cross-validation-complete", crossValidation });
    } catch (err) {
      const error = String(err);
      session.status = "error";
      session.error = error;
      await saveSession(session);
      this.emit({ type: "cross-validation-error", error });
      throw err;
    }

    // Complete
    session.status = "complete";
    await saveSession(session);

    await log("info", "Pipeline complete", {
      sessionId,
      prNumber,
      verdict: review.verdict,
      crossValidationAgreement: session.crossValidation?.overallAgreement,
    });

    this.emit({ type: "complete", session });
    return session;
  }
}

export function reducePipelineState(
  state: PipelineState,
  event: PipelineEvent,
): PipelineState {
  switch (event.type) {
    case "start":
      return {
        status: "fetching",
        prNumber: event.prNumber,
        repo: event.repo,
      };
    case "fetch-start":
      return { ...state, status: "fetching" };
    case "fetch-complete":
      return { ...state, prData: event.prData };
    case "fetch-error":
      return { ...state, status: "error", error: event.error };
    case "review-start":
      return { ...state, status: "reviewing", currentAgent: event.agentName };
    case "review-complete":
      return { ...state, review: event.review, currentAgent: undefined };
    case "review-error":
      return { ...state, status: "error", error: event.error };
    case "cross-validation-start":
      return {
        ...state,
        status: "cross-validating",
        currentAgent: event.validatorAgent,
      };
    case "cross-validation-complete":
      return {
        ...state,
        crossValidation: event.crossValidation,
        currentAgent: undefined,
      };
    case "cross-validation-error":
      return { ...state, status: "error", error: event.error };
    case "complete":
      return { ...state, status: "complete", session: event.session };
    case "error":
      return { ...state, status: "error", error: event.error };
    default:
      return state;
  }
}
