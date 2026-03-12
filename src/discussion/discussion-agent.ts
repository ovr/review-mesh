import type { PRData } from "../storage/types";
import type { ClaudeEffortLevel } from "../agents/claude-agent";
import type { DiscussionTopic } from "./types";
import {
  parseStreamLine,
  updateProgress,
  initialProgress,
  type ClaudeStreamProgress,
  type ClaudeStreamResultEvent,
  type ClaudeStreamAssistantEvent,
} from "../agents/claude-stream";
import { spawnStreamingProcess } from "../utils/subprocess";
import { log } from "../utils/logger";

const CLAUDE_MODEL = "claude-opus-4-6";
const MAX_BUDGET_USD = "1.00";

interface DiscussWithAgentOptions {
  topic: DiscussionTopic;
  userMessage: string;
  prData: PRData;
  sessionId?: string;
  effort?: ClaudeEffortLevel;
  onProgress?: (progress: ClaudeStreamProgress) => void;
}

interface DiscussionResult {
  response: string;
  sessionId: string;
}

function buildTopicContext(topic: DiscussionTopic): string {
  const { step } = topic;
  let context = `## Finding
- Category: ${step.category}
- Title: ${step.title}`;

  if (step.severity) {
    context += `\n- Severity: ${step.severity}`;
  }

  context += `\n- Content: ${step.content}`;

  if (step.relatedFiles.length > 0) {
    context += `\n- Related files: ${step.relatedFiles.join(", ")}`;
  }

  if (topic.source === "validation") {
    const { validationItem } = topic;
    context += `\n- Validator ${validationItem.agrees ? "agrees" : "disagrees"}: ${validationItem.reasoning}`;
  }

  return context;
}

function filterDiffForFiles(diff: string, files: string[]): string {
  if (files.length === 0) return diff;

  const lines = diff.split("\n");
  const result: string[] = [];
  let include = false;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      include = files.some((f) => line.includes(f));
    }
    if (include) {
      result.push(line);
    }
  }

  return result.length > 0 ? result.join("\n") : diff;
}

function buildFirstTurnPrompt(
  topic: DiscussionTopic,
  userMessage: string,
  prData: PRData,
): string {
  const topicContext = buildTopicContext(topic);
  const relevantDiff = filterDiffForFiles(prData.diff, topic.step.relatedFiles);

  return `You are a senior code reviewer. The user wants to discuss a specific finding from a code review.

${topicContext}

## PR Context
- Title: ${prData.metadata.title}
- Author: ${prData.metadata.author}

## Relevant Diff
${relevantDiff}

## User's Question
${userMessage}

Respond conversationally. Be specific and reference the actual code.`;
}

export async function discussWithAgent(
  opts: DiscussWithAgentOptions,
): Promise<DiscussionResult> {
  const { topic, userMessage, prData, sessionId, effort, onProgress } = opts;

  const command = [
    "claude",
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--model",
    CLAUDE_MODEL,
    "--max-budget-usd",
    MAX_BUDGET_USD,
  ];

  if (effort) {
    command.push("--effort", effort);
  }

  if (sessionId) {
    command.push("--resume", sessionId);
  }

  const stdin = sessionId
    ? userMessage
    : buildFirstTurnPrompt(topic, userMessage, prData);

  await log("info", "Starting discussion agent", {
    sessionId,
    isResume: !!sessionId,
  });

  let progress = initialProgress();
  const ref: {
    resultEvent: ClaudeStreamResultEvent | null;
    lastAssistantEvent: ClaudeStreamAssistantEvent | null;
  } = { resultEvent: null, lastAssistantEvent: null };

  const result = await spawnStreamingProcess({
    command,
    stdin,
    timeoutMs: 300_000,
    env: { CLAUDE_CODE_ENTRYPOINT: "cli" },
    onLine: (line) => {
      const event = parseStreamLine(line);
      if (!event) return;

      progress = updateProgress(progress, event);

      if (event.type === "result") {
        ref.resultEvent = event as ClaudeStreamResultEvent;
      }
      if (event.type === "assistant") {
        ref.lastAssistantEvent = event as ClaudeStreamAssistantEvent;
      }

      if (onProgress) {
        onProgress(progress);
      }
    },
  });

  if (result.exitCode !== 0) {
    await log("error", "Discussion agent failed", {
      exitCode: result.exitCode,
      stderr: result.stderr.slice(0, 500),
    });
    throw new Error(
      `Discussion agent exited with code ${result.exitCode}: ${result.stderr.slice(0, 500)}`,
    );
  }

  // Extract text response from the last assistant event
  let response = "";
  if (ref.lastAssistantEvent?.message?.content) {
    for (const block of ref.lastAssistantEvent.message.content) {
      if (block.type === "text") {
        response += block.text;
      }
    }
  }

  // Fallback: scan all assistant events from stdout
  if (!response) {
    const lines = result.stdout.split("\n");
    for (const line of lines) {
      const event = parseStreamLine(line);
      if (event?.type === "assistant") {
        const assistantEvent = event as ClaudeStreamAssistantEvent;
        const content = assistantEvent.message?.content ?? [];
        for (const block of content) {
          if (block.type === "text") {
            response += block.text;
          }
        }
      }
    }
  }

  const resolvedSessionId =
    ref.resultEvent?.session_id ?? progress.sessionId ?? sessionId ?? "";

  await log("info", "Discussion agent completed", {
    sessionId: resolvedSessionId,
    responseLength: response.length,
    cost: ref.resultEvent?.total_cost_usd,
  });

  return {
    response: response || "(No response received)",
    sessionId: resolvedSessionId,
  };
}
