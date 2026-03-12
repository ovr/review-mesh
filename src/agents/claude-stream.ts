export interface ClaudeStreamSystemEvent {
  type: "system";
  subtype: "init" | string;
  [key: string]: unknown;
}

export interface ClaudeStreamAssistantEvent {
  type: "assistant";
  message: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; name: string; id: string; input: unknown }
    >;
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
  [key: string]: unknown;
}

export type ClaudeStreamEvent =
  | ClaudeStreamSystemEvent
  | ClaudeStreamAssistantEvent
  | ClaudeStreamResultEvent
  | { type: string; [key: string]: unknown };

export interface ClaudeStreamProgress {
  isGenerating: boolean;
  turnCount: number;
  toolUseCount: number;
  costUsd?: number;
  activity: string;
  lastToolName?: string;
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

export function updateProgress(
  current: ClaudeStreamProgress,
  event: ClaudeStreamEvent,
): ClaudeStreamProgress {
  switch (event.type) {
    case "system":
      return { ...current, activity: "Initializing...", isGenerating: true };

    case "assistant": {
      const assistantEvent = event as ClaudeStreamAssistantEvent;
      const content = assistantEvent.message?.content ?? [];
      let toolUseCount = current.toolUseCount;
      let lastToolName = current.lastToolName;
      let activity = "Generating...";

      for (const block of content) {
        if (block.type === "tool_use") {
          toolUseCount++;
          lastToolName = block.name;
          activity = `Using tool: ${block.name}`;
        }
      }

      return {
        ...current,
        isGenerating: true,
        turnCount: current.turnCount + 1,
        toolUseCount,
        lastToolName,
        activity,
      };
    }

    case "result": {
      const resultEvent = event as ClaudeStreamResultEvent;
      return {
        ...current,
        isGenerating: false,
        costUsd: resultEvent.total_cost_usd,
        turnCount: resultEvent.num_turns ?? current.turnCount,
        activity: resultEvent.subtype === "success" ? "Complete" : "Error",
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
  };
}
