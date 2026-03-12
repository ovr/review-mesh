import { BaseAgent } from "./base-agent";
import { REVIEW_JSON_SCHEMA, CROSS_VALIDATION_JSON_SCHEMA } from "./prompts";
import type { AgentConfig, AgentResult, CrossValidationResult } from "./types";
import { log } from "../utils/logger";

const CLAUDE_CONFIG: AgentConfig = {
  name: "claude",
  displayName: "Claude",
  color: "#D97706",
  command: ["claude"],
  env: { CLAUDE_CODE_ENTRYPOINT: "cli" },
  timeoutMs: 300_000,
};

export class ClaudeAgent extends BaseAgent {
  constructor() {
    super(CLAUDE_CONFIG);
  }

  protected buildCommand(_prompt: string): string[] {
    return [
      "claude",
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      REVIEW_JSON_SCHEMA,
      "--max-budget-usd",
      "0.50",
      "--model",
      "claude-sonnet-4-20250514",
    ];
  }

  protected parseOutput(raw: string): AgentResult {
    // Claude with --output-format json wraps result in a JSON envelope
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON from the output
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse Claude output as JSON");
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Claude --output-format json returns { result: "..." } where result is the actual content
    const content = parsed.result ? JSON.parse(parsed.result) : parsed;

    return {
      rawOutput: raw,
      reasoningChain: content.reasoningChain ?? [],
      summary: content.summary ?? "",
      verdict: content.verdict ?? "comment",
      confidence: content.confidence ?? 0.5,
      modelUsed: "claude-sonnet-4-20250514",
    };
  }

  buildCrossValidationCommand(): string[] {
    return [
      "claude",
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      CROSS_VALIDATION_JSON_SCHEMA,
      "--max-budget-usd",
      "0.50",
      "--model",
      "claude-sonnet-4-20250514",
    ];
  }

  async crossValidate(prompt: string): Promise<CrossValidationResult> {
    const { spawnProcess } = await import("../utils/subprocess");

    const result = await spawnProcess({
      command: this.buildCrossValidationCommand(),
      stdin: prompt,
      timeoutMs: this.config.timeoutMs ?? 300_000,
      env: this.config.env,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `Claude cross-validation failed: ${result.stderr.slice(0, 500)}`,
      );
    }

    return this.parseCrossValidationOutput(result.stdout);
  }

  private parseCrossValidationOutput(raw: string): CrossValidationResult {
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
      modelUsed: "claude-sonnet-4-20250514",
    };
  }
}
