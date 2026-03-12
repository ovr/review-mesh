import { spawnProcess } from "../utils/subprocess";
import { log } from "../utils/logger";
import type { AgentConfig, AgentResult } from "./types";
import type { PRData } from "../storage/types";

export abstract class BaseAgent {
  constructor(public readonly config: AgentConfig) {}

  protected abstract buildCommand(prompt: string): string[];
  protected abstract parseOutput(raw: string): AgentResult;

  async review(prData: PRData, prompt: string): Promise<AgentResult> {
    const command = this.buildCommand(prompt);

    await log("info", `Starting ${this.config.name} review`, {
      command: command.join(" "),
    });

    const result = await spawnProcess({
      command,
      stdin: prompt,
      timeoutMs: this.config.timeoutMs ?? 300_000,
      env: this.config.env,
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
    });

    return this.parseOutput(result.stdout);
  }
}
