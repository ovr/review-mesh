import { BaseAgent } from "./base-agent";
import { REVIEW_JSON_SCHEMA, CROSS_VALIDATION_JSON_SCHEMA } from "./prompts";
import type { AgentConfig, AgentResult, CrossValidationResult } from "./types";
import { log } from "../utils/logger";

const CODEX_CONFIG: AgentConfig = {
  name: "codex",
  displayName: "Codex",
  color: "#10B981",
  command: ["codex"],
  env: {},
  timeoutMs: 300_000,
};

export class CodexAgent extends BaseAgent {
  constructor() {
    super(CODEX_CONFIG);
  }

  protected buildCommand(_prompt: string): string[] {
    return ["codex", "-q", "--json", "-a", "full-auto", "-m", "o4-mini"];
  }

  protected parseOutput(raw: string): AgentResult {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Codex may return multiple JSON lines; take the last complete one
      const lines = raw.trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          parsed = JSON.parse(lines[i]);
          break;
        } catch {
          continue;
        }
      }
      if (!parsed) {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Failed to parse Codex output as JSON");
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    return {
      rawOutput: raw,
      reasoningChain: parsed.reasoningChain ?? [],
      summary: parsed.summary ?? "",
      verdict: parsed.verdict ?? "comment",
      confidence: parsed.confidence ?? 0.5,
      modelUsed: "o4-mini",
    };
  }

  async crossValidate(prompt: string): Promise<CrossValidationResult> {
    const { spawnProcess } = await import("../utils/subprocess");

    const result = await spawnProcess({
      command: ["codex", "-q", "--json", "-a", "full-auto", "-m", "o4-mini"],
      stdin: prompt,
      timeoutMs: this.config.timeoutMs ?? 300_000,
      env: this.config.env,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `Codex cross-validation failed: ${result.stderr.slice(0, 500)}`,
      );
    }

    return this.parseCrossValidationOutput(result.stdout);
  }

  private parseCrossValidationOutput(raw: string): CrossValidationResult {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const lines = raw.trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          parsed = JSON.parse(lines[i]);
          break;
        } catch {
          continue;
        }
      }
      if (!parsed) {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Failed to parse cross-validation output");
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    return {
      items: parsed.items ?? [],
      overallAgreement: parsed.overallAgreement ?? 0.5,
      validatorVerdict: parsed.validatorVerdict ?? "comment",
      additionalFindings: parsed.additionalFindings ?? [],
      disagreements: parsed.disagreements ?? [],
      rawOutput: raw,
      modelUsed: "o4-mini",
    };
  }
}
