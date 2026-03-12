import { BaseAgent } from "./base-agent";
import { REVIEW_JSON_SCHEMA, CROSS_VALIDATION_JSON_SCHEMA } from "./prompts";
import type { AgentConfig, AgentResult, CrossValidationResult } from "./types";
import type { PRData } from "../storage/types";
import {
  parseStreamLine,
  updateProgress,
  initialProgress,
  type ClaudeStreamProgress,
  type ClaudeStreamResultEvent,
} from "./claude-stream";
import { spawnStreamingProcess } from "../utils/subprocess";
import { log } from "../utils/logger";

const CLAUDE_MODEL = "claude-opus-4-6";
const CLAUDE_MAX_BUDGET_USD = "5.00";
export const CLAUDE_EFFORT = "medium";

const CLAUDE_CONFIG: AgentConfig = {
  name: "claude",
  displayName: "Claude",
  color: "#D97706",
  command: ["claude"],
  env: { CLAUDE_CODE_ENTRYPOINT: "cli" },
  timeoutMs: 300_000,
};

export type ProgressCallback = (progress: ClaudeStreamProgress) => void;

export class ClaudeAgent extends BaseAgent {
  constructor() {
    super(CLAUDE_CONFIG);
  }

  protected buildCommand(_prompt: string): string[] {
    return [
      "claude",
      "-p",
      "--verbose",
      "--output-format",
      "stream-json",
      "--json-schema",
      REVIEW_JSON_SCHEMA,
      "--max-budget-usd",
      CLAUDE_MAX_BUDGET_USD,
      "--model",
      CLAUDE_MODEL,
      "--effort",
      CLAUDE_EFFORT,
    ];
  }

  protected parseOutput(raw: string): AgentResult {
    // When streaming, the final result event has structured_output
    // Try to find the result event line in the raw output
    const lines = raw.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "result" && parsed.structured_output) {
          const content = parsed.structured_output;
          return {
            rawOutput: raw,
            reasoningChain: content.reasoningChain ?? [],
            summary: content.summary ?? "",
            verdict: content.verdict ?? "comment",
            confidence: content.confidence ?? 0.5,
            modelUsed: CLAUDE_MODEL,
          };
        }
      } catch {
        // not JSON, skip
      }
    }

    // Fallback: try parsing the whole output as JSON (non-streaming format)
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse Claude output as JSON");
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    const content = parsed.result ? JSON.parse(parsed.result) : parsed;

    return {
      rawOutput: raw,
      reasoningChain: content.reasoningChain ?? [],
      summary: content.summary ?? "",
      verdict: content.verdict ?? "comment",
      confidence: content.confidence ?? 0.5,
      modelUsed: CLAUDE_MODEL,
    };
  }

  async review(prData: PRData, prompt: string, onProgress?: ProgressCallback): Promise<AgentResult> {
    const command = this.buildCommand(prompt);

    await log("info", `Starting ${this.config.name} streaming review`, {
      command: command.join(" "),
    });

    let progress = initialProgress();
    const ref: { resultEvent: ClaudeStreamResultEvent | null } = { resultEvent: null };

    const result = await spawnStreamingProcess({
      command,
      stdin: prompt,
      timeoutMs: this.config.timeoutMs ?? 300_000,
      env: this.config.env,
      onLine: (line) => {
        const event = parseStreamLine(line);
        if (!event) return;

        progress = updateProgress(progress, event);

        if (event.type === "result") {
          ref.resultEvent = event as ClaudeStreamResultEvent;
        }

        if (onProgress) {
          onProgress(progress);
        }
      },
    });

    if (result.exitCode !== 0) {
      await log("error", `${this.config.name} failed`, {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(0, 500),
      });
      throw new Error(
        `${this.config.name} exited with code ${result.exitCode}: ${result.stderr.slice(0, 500)}`,
      );
    }

    await log("info", `${this.config.name} completed`, {
      outputLength: result.stdout.length,
      cost: ref.resultEvent?.total_cost_usd,
      turns: ref.resultEvent?.num_turns,
    });

    // Use the result event's structured_output if available
    if (ref.resultEvent?.structured_output) {
      const content = ref.resultEvent.structured_output as any;
      return {
        rawOutput: result.stdout,
        reasoningChain: content.reasoningChain ?? [],
        summary: content.summary ?? "",
        verdict: content.verdict ?? "comment",
        confidence: content.confidence ?? 0.5,
        modelUsed: CLAUDE_MODEL,
      };
    }

    // Fallback to parsing the full output
    return this.parseOutput(result.stdout);
  }

  buildCrossValidationCommand(): string[] {
    return [
      "claude",
      "-p",
      "--verbose",
      "--output-format",
      "stream-json",
      "--json-schema",
      CROSS_VALIDATION_JSON_SCHEMA,
      "--max-budget-usd",
      CLAUDE_MAX_BUDGET_USD,
      "--model",
      CLAUDE_MODEL,
      "--effort",
      CLAUDE_EFFORT,
    ];
  }

  async crossValidate(prompt: string, onProgress?: ProgressCallback): Promise<CrossValidationResult> {
    const command = this.buildCrossValidationCommand();

    await log("info", `Starting ${this.config.name} streaming cross-validation`, {
      command: command.join(" "),
    });

    let progress = initialProgress();
    const ref: { resultEvent: ClaudeStreamResultEvent | null } = { resultEvent: null };

    const result = await spawnStreamingProcess({
      command,
      stdin: prompt,
      timeoutMs: this.config.timeoutMs ?? 300_000,
      env: this.config.env,
      onLine: (line) => {
        const event = parseStreamLine(line);
        if (!event) return;

        progress = updateProgress(progress, event);

        if (event.type === "result") {
          ref.resultEvent = event as ClaudeStreamResultEvent;
        }

        if (onProgress) {
          onProgress(progress);
        }
      },
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `Claude cross-validation failed: ${result.stderr.slice(0, 500)}`,
      );
    }

    // Use the result event's structured_output if available
    if (ref.resultEvent?.structured_output) {
      const content = ref.resultEvent.structured_output as any;
      return {
        items: content.items ?? [],
        overallAgreement: content.overallAgreement ?? 0.5,
        validatorVerdict: content.validatorVerdict ?? "comment",
        additionalFindings: content.additionalFindings ?? [],
        disagreements: content.disagreements ?? [],
        rawOutput: result.stdout,
        modelUsed: CLAUDE_MODEL,
      };
    }

    return this.parseCrossValidationOutput(result.stdout);
  }

  private parseCrossValidationOutput(raw: string): CrossValidationResult {
    // Try to find the result event in streaming output
    const lines = raw.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "result" && parsed.structured_output) {
          const content = parsed.structured_output;
          return {
            items: content.items ?? [],
            overallAgreement: content.overallAgreement ?? 0.5,
            validatorVerdict: content.validatorVerdict ?? "comment",
            additionalFindings: content.additionalFindings ?? [],
            disagreements: content.disagreements ?? [],
            rawOutput: raw,
            modelUsed: CLAUDE_MODEL,
          };
        }
      } catch {
        // not JSON, skip
      }
    }

    // Fallback: try parsing whole output
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse cross-validation output");
      parsed = JSON.parse(jsonMatch[0]);
    }

    const content = parsed.result ? JSON.parse(parsed.result) : parsed;

    return {
      items: content.items ?? [],
      overallAgreement: content.overallAgreement ?? 0.5,
      validatorVerdict: content.validatorVerdict ?? "comment",
      additionalFindings: content.additionalFindings ?? [],
      disagreements: content.disagreements ?? [],
      rawOutput: raw,
      modelUsed: CLAUDE_MODEL,
    };
  }
}
