import type { AgentReview, CrossValidation, PRData } from "../storage/types";
import type { CrossValidationResult } from "../agents/types";
import { CodexAgent } from "../agents/codex-agent";
import { buildCrossValidationPrompt } from "../agents/prompts";
import { log } from "../utils/logger";

export async function runCrossValidation(
  originalReview: AgentReview,
  prData: PRData,
): Promise<CrossValidation> {
  const startedAt = new Date().toISOString();

  await log("info", "Starting cross-validation", {
    originalAgent: originalReview.agentName,
    steps: originalReview.reasoningChain.length,
  });

  const prompt = buildCrossValidationPrompt(originalReview, prData);
  const validator = new CodexAgent();

  let result: CrossValidationResult;
  try {
    result = await validator.crossValidate(prompt);
  } catch (err) {
    await log("error", "Cross-validation failed", {
      error: String(err),
    });
    throw err;
  }

  const completedAt = new Date().toISOString();

  await log("info", "Cross-validation complete", {
    agreement: result.overallAgreement,
    disagreements: result.disagreements.length,
    additionalFindings: result.additionalFindings.length,
  });

  return {
    validatorAgent: validator.config.name,
    originalAgent: originalReview.agentName,
    startedAt,
    completedAt,
    items: result.items,
    overallAgreement: result.overallAgreement,
    validatorVerdict: result.validatorVerdict,
    additionalFindings: result.additionalFindings,
    disagreements: result.disagreements,
  };
}
