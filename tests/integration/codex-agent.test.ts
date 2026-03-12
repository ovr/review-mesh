import { describe, test, expect, mock, beforeEach } from "bun:test";
import { CodexAgent } from "../../src/agents/codex-agent";
import type { AgentResult, CrossValidationResult } from "../../src/agents/types";
import type { SpawnResult } from "../../src/utils/subprocess";
import {
  VALID_REVIEW_JSON,
  MINIMAL_REVIEW_JSON,
  MULTI_LINE_OUTPUT,
  EMBEDDED_JSON_OUTPUT,
  GARBAGE_OUTPUT,
  VALID_CROSS_VALIDATION_JSON,
  MINIMAL_CROSS_VALIDATION_JSON,
  MOCK_PR_DATA,
} from "./codex-agent-fixtures";

// --- Mock subprocess, logger, and fs ---

const spawnProcessMock = mock<(opts: any) => Promise<SpawnResult>>(() =>
  Promise.resolve({ stdout: "", stderr: "", exitCode: 0 }),
);

mock.module("../../src/utils/subprocess", () => ({
  spawnProcess: spawnProcessMock,
}));

mock.module("../../src/utils/logger", () => ({
  log: mock(() => Promise.resolve()),
}));

// Mock fs for crossValidate temp schema file
const writeFileSyncMock = mock((_path: string, _data: string) => {});
const unlinkSyncMock = mock((_path: string) => {});

mock.module("fs", () => ({
  ...require("fs"),
  writeFileSync: writeFileSyncMock,
  unlinkSync: unlinkSyncMock,
}));

// --- Testable subclass to expose protected methods ---

class TestableCodexAgent extends CodexAgent {
  public exposedBuildCommand(prompt: string): string[] {
    return this.buildCommand(prompt);
  }

  public exposedParseOutput(raw: string): AgentResult {
    return this.parseOutput(raw);
  }
}

// --- Tests ---

describe("CodexAgent", () => {
  let agent: TestableCodexAgent;

  beforeEach(() => {
    agent = new TestableCodexAgent();
    spawnProcessMock.mockClear();
  });

  // 1. Construction
  describe("construction", () => {
    test("has correct config fields", () => {
      expect(agent.config.name).toBe("codex");
      expect(agent.config.displayName).toBe("Codex");
      expect(agent.config.color).toBe("#10B981");
      expect(agent.config.timeoutMs).toBe(300_000);
      expect(agent.config.command).toEqual(["codex"]);
    });
  });

  // 2. buildCommand
  describe("buildCommand", () => {
    test("returns correct command array", () => {
      const cmd = agent.exposedBuildCommand("some prompt");
      expect(cmd).toEqual([
        "codex",
        "exec",
        "--full-auto",
        "--ephemeral",
      ]);
    });

    test("ignores prompt argument", () => {
      const cmd1 = agent.exposedBuildCommand("prompt A");
      const cmd2 = agent.exposedBuildCommand("prompt B");
      expect(cmd1).toEqual(cmd2);
    });
  });

  // 3. parseOutput
  describe("parseOutput", () => {
    test("parses valid JSON with all fields", () => {
      const result = agent.exposedParseOutput(VALID_REVIEW_JSON);
      expect(result.reasoningChain).toHaveLength(2);
      expect(result.reasoningChain[0].category).toBe("observation");
      expect(result.summary).toBe(
        "The PR adds a profile endpoint but lacks input validation.",
      );
      expect(result.verdict).toBe("request-changes");
      expect(result.confidence).toBe(0.85);
    });

    test("applies defaults for minimal JSON", () => {
      const result = agent.exposedParseOutput(MINIMAL_REVIEW_JSON);
      expect(result.reasoningChain).toEqual([]);
      expect(result.verdict).toBe("comment");
      expect(result.confidence).toBe(0.5);
      expect(result.summary).toBe("Looks fine overall.");
    });

    test("extracts JSON from multi-line output (last line)", () => {
      const result = agent.exposedParseOutput(MULTI_LINE_OUTPUT);
      expect(result.verdict).toBe("request-changes");
      expect(result.confidence).toBe(0.85);
      expect(result.reasoningChain).toHaveLength(2);
    });

    test("extracts embedded JSON via regex fallback", () => {
      const result = agent.exposedParseOutput(EMBEDDED_JSON_OUTPUT);
      expect(result.verdict).toBe("request-changes");
      expect(result.confidence).toBe(0.85);
    });

    test("throws on garbage output", () => {
      expect(() => agent.exposedParseOutput(GARBAGE_OUTPUT)).toThrow(
        "Failed to parse Codex output as JSON",
      );
    });

    test("always sets modelUsed to codex", () => {
      const result = agent.exposedParseOutput(VALID_REVIEW_JSON);
      expect(result.modelUsed).toBe("codex");
    });

    test("preserves rawOutput", () => {
      const result = agent.exposedParseOutput(VALID_REVIEW_JSON);
      expect(result.rawOutput).toBe(VALID_REVIEW_JSON);
    });
  });

  // 4. crossValidate (with mocked subprocess + fs)
  describe("crossValidate", () => {
    beforeEach(() => {
      writeFileSyncMock.mockClear();
      unlinkSyncMock.mockClear();
    });

    test("parses valid cross-validation JSON", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: VALID_CROSS_VALIDATION_JSON,
        stderr: "",
        exitCode: 0,
      });

      const result = await agent.crossValidate("test prompt");
      expect(result.items).toHaveLength(2);
      expect(result.items[0].agrees).toBe(true);
      expect(result.items[1].agrees).toBe(false);
      expect(result.overallAgreement).toBe(0.75);
      expect(result.validatorVerdict).toBe("approve");
      expect(result.additionalFindings).toHaveLength(1);
      expect(result.disagreements).toEqual([
        "Disagrees on input validation concern",
      ]);
    });

    test("applies defaults for minimal cross-validation JSON", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: MINIMAL_CROSS_VALIDATION_JSON,
        stderr: "",
        exitCode: 0,
      });

      const result = await agent.crossValidate("test prompt");
      expect(result.items).toEqual([]);
      expect(result.overallAgreement).toBe(0.9);
      expect(result.validatorVerdict).toBe("comment");
      expect(result.additionalFindings).toEqual([]);
      expect(result.disagreements).toEqual([]);
    });

    test("handles multi-line cross-validation output", async () => {
      const multiLineCV = [
        "Validating...",
        "Processing...",
        VALID_CROSS_VALIDATION_JSON,
      ].join("\n");

      spawnProcessMock.mockResolvedValueOnce({
        stdout: multiLineCV,
        stderr: "",
        exitCode: 0,
      });

      const result = await agent.crossValidate("test prompt");
      expect(result.overallAgreement).toBe(0.75);
      expect(result.validatorVerdict).toBe("approve");
    });

    test("throws on non-zero exit code", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: "some output",
        stderr: "codex: command failed",
        exitCode: 1,
      });

      await expect(agent.crossValidate("test prompt")).rejects.toThrow(
        "Codex cross-validation failed",
      );
    });

    test("always sets modelUsed to codex", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: VALID_CROSS_VALIDATION_JSON,
        stderr: "",
        exitCode: 0,
      });

      const result = await agent.crossValidate("test prompt");
      expect(result.modelUsed).toBe("codex");
    });

    test("preserves rawOutput", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: VALID_CROSS_VALIDATION_JSON,
        stderr: "",
        exitCode: 0,
      });

      const result = await agent.crossValidate("test prompt");
      expect(result.rawOutput).toBe(VALID_CROSS_VALIDATION_JSON);
    });

    test("passes --output-schema flag and writes schema to temp file", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: VALID_CROSS_VALIDATION_JSON,
        stderr: "",
        exitCode: 0,
      });

      await agent.crossValidate("test prompt");
      const callArgs = spawnProcessMock.mock.calls[0][0];
      expect(callArgs.command).toContain("--output-schema");
      expect(callArgs.command).toContain("--ephemeral");
      expect(callArgs.command).not.toContain("--json");
      expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    });

    test("cleans up schema temp file", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: VALID_CROSS_VALIDATION_JSON,
        stderr: "",
        exitCode: 0,
      });

      await agent.crossValidate("test prompt");
      expect(unlinkSyncMock).toHaveBeenCalledTimes(1);
    });
  });

  // 5. review (with mocked subprocess)
  describe("review", () => {
    test("calls spawnProcess and parses output", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: VALID_REVIEW_JSON,
        stderr: "",
        exitCode: 0,
      });

      const result = await agent.review(MOCK_PR_DATA, "review this PR");
      expect(result.verdict).toBe("request-changes");
      expect(result.confidence).toBe(0.85);
      expect(result.modelUsed).toBe("codex");
      expect(spawnProcessMock).toHaveBeenCalledTimes(1);
    });

    test("throws on non-zero exit code", async () => {
      spawnProcessMock.mockResolvedValueOnce({
        stdout: "",
        stderr: "process failed",
        exitCode: 1,
      });

      await expect(
        agent.review(MOCK_PR_DATA, "review this PR"),
      ).rejects.toThrow("codex exited with code 1");
    });
  });
});

// 6. Real codex invocation (conditional)
describe("CodexAgent real invocation", () => {
  const shouldRun = process.env.RUN_REAL_AGENT_TESTS === "1";

  test.skipIf(!shouldRun)(
    "review() returns valid result shape",
    async () => {
      const agent = new CodexAgent();
      const result = await agent.review(
        MOCK_PR_DATA,
        "Please review this PR. Return JSON with reasoningChain, summary, verdict, and confidence.",
      );

      expect(result).toHaveProperty("rawOutput");
      expect(result).toHaveProperty("reasoningChain");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("verdict");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("modelUsed");
      expect(result.modelUsed).toBe("codex");
      expect(["approve", "request-changes", "comment"]).toContain(
        result.verdict,
      );
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    },
    { timeout: 60_000 },
  );

  test.skipIf(!shouldRun)(
    "crossValidate() returns valid result shape",
    async () => {
      const agent = new CodexAgent();
      const result = await agent.crossValidate(
        "Cross-validate this review. Return JSON with items, overallAgreement, validatorVerdict, additionalFindings, and disagreements.",
      );

      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("overallAgreement");
      expect(result).toHaveProperty("validatorVerdict");
      expect(result).toHaveProperty("additionalFindings");
      expect(result).toHaveProperty("disagreements");
      expect(result).toHaveProperty("rawOutput");
      expect(result).toHaveProperty("modelUsed");
      expect(result.modelUsed).toBe("codex");
      expect(["approve", "request-changes", "comment"]).toContain(
        result.validatorVerdict,
      );
    },
    { timeout: 60_000 },
  );
});
