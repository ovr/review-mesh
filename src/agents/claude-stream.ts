export interface ClaudeStreamSystemEvent {
  type: "system";
  subtype: "init" | string;
  model?: string;
  session_id?: string;
  tools?: Array<{ name: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface ClaudeStreamAssistantEvent {
  type: "assistant";
  message: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; name: string; id: string; input: unknown }
    >;
    usage?: { input_tokens?: number; output_tokens?: number };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ClaudeStreamResultEvent {
  type: "result";
  subtype: "success" | "error" | string;
  structured_output?: unknown;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
  session_id?: string;
  [key: string]: unknown;
}

export type ClaudeStreamEvent =
  | ClaudeStreamSystemEvent
  | ClaudeStreamAssistantEvent
  | ClaudeStreamResultEvent
  | { type: string; [key: string]: unknown };

export interface ToolUseEntry {
  name: string;
  context: string;
}

export interface ClaudeStreamProgress {
  isGenerating: boolean;
  turnCount: number;
  toolUseCount: number;
  costUsd?: number;
  activity: string;
  lastToolName?: string;
  // New fields
  model?: string;
  sessionId?: string;
  textPreview?: string;
  recentTools: ToolUseEntry[];
  inputTokens: number;
  outputTokens: number;
  durationMs?: number;
  durationApiMs?: number;
}

export function parseStreamLine(line: string): ClaudeStreamEvent | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed.type === "string") {
      return parsed as ClaudeStreamEvent;
    }
    return null;
  } catch {
    return null;
  }
}

const MAX_RECENT_TOOLS = 5;
const MAX_TEXT_PREVIEW = 120;

function extractToolContext(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return name;
  const inp = input as Record<string, unknown>;

  // File-oriented tools
  if (typeof inp.file_path === "string") {
    return shortenPath(inp.file_path);
  }
  if (typeof inp.path === "string" && typeof inp.pattern === "string") {
    return `${inp.pattern} in ${shortenPath(inp.path)}`;
  }
  if (typeof inp.pattern === "string") {
    return String(inp.pattern).slice(0, 60);
  }
  // Bash / command tools
  if (typeof inp.command === "string") {
    return String(inp.command).slice(0, 60);
  }
  // Glob
  if (typeof inp.glob === "string") {
    return String(inp.glob);
  }

  return "";
}

function shortenPath(p: string): string {
  const parts = p.split("/");
  if (parts.length <= 3) return p;
  return ".../" + parts.slice(-3).join("/");
}

export function updateProgress(
  current: ClaudeStreamProgress,
  event: ClaudeStreamEvent,
): ClaudeStreamProgress {
  switch (event.type) {
    case "system": {
      const sysEvent = event as ClaudeStreamSystemEvent;
      return {
        ...current,
        activity: "Initializing...",
        isGenerating: true,
        model: sysEvent.model ?? current.model,
        sessionId: sysEvent.session_id ?? current.sessionId,
      };
    }

    case "assistant": {
      const assistantEvent = event as ClaudeStreamAssistantEvent;
      const content = assistantEvent.message?.content ?? [];
      let toolUseCount = current.toolUseCount;
      let lastToolName = current.lastToolName;
      let activity = "Generating...";
      let textPreview = current.textPreview;
      const recentTools = [...current.recentTools];

      // Accumulate token usage from message
      const usage = assistantEvent.message?.usage;
      let inputTokens = current.inputTokens;
      let outputTokens = current.outputTokens;
      if (usage) {
        inputTokens += usage.input_tokens ?? 0;
        outputTokens += usage.output_tokens ?? 0;
      }

      for (const block of content) {
        if (block.type === "tool_use") {
          toolUseCount++;
          lastToolName = block.name;
          const context = extractToolContext(block.name, block.input);
          activity = context
            ? `${block.name}: ${context}`
            : `Using tool: ${block.name}`;
          recentTools.push({ name: block.name, context });
          if (recentTools.length > MAX_RECENT_TOOLS) {
            recentTools.shift();
          }
        } else if (block.type === "text" && block.text) {
          const text = block.text.trim();
          if (text.length > 0) {
            textPreview =
              text.length > MAX_TEXT_PREVIEW
                ? text.slice(0, MAX_TEXT_PREVIEW) + "..."
                : text;
          }
        }
      }

      return {
        ...current,
        isGenerating: true,
        turnCount: current.turnCount + 1,
        toolUseCount,
        lastToolName,
        activity,
        textPreview,
        recentTools,
        inputTokens,
        outputTokens,
      };
    }

    case "result": {
      const resultEvent = event as ClaudeStreamResultEvent;
      // Result event may carry final usage
      let inputTokens = current.inputTokens;
      let outputTokens = current.outputTokens;
      if (resultEvent.usage) {
        inputTokens = resultEvent.usage.input_tokens ?? inputTokens;
        outputTokens = resultEvent.usage.output_tokens ?? outputTokens;
      }

      return {
        ...current,
        isGenerating: false,
        costUsd: resultEvent.total_cost_usd,
        turnCount: resultEvent.num_turns ?? current.turnCount,
        activity: resultEvent.subtype === "success" ? "Complete" : "Error",
        model: resultEvent.model ?? current.model,
        sessionId: resultEvent.session_id ?? current.sessionId,
        durationMs: resultEvent.duration_ms,
        durationApiMs: resultEvent.duration_api_ms,
        inputTokens,
        outputTokens,
      };
    }

    default:
      return current;
  }
}

export function initialProgress(): ClaudeStreamProgress {
  return {
    isGenerating: false,
    turnCount: 0,
    toolUseCount: 0,
    activity: "Starting...",
    recentTools: [],
    inputTokens: 0,
    outputTokens: 0,
  };
}
