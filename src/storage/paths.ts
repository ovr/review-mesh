import { join } from "path";
import { homedir } from "os";

const BASE_DIR = join(homedir(), ".simplify-me-review");
const DATA_DIR = join(BASE_DIR, "data");
const LOG_DIR = join(BASE_DIR, "logs");

export function getBaseDir(): string {
  return BASE_DIR;
}

export function getDataDir(): string {
  return DATA_DIR;
}

export function getLogDir(): string {
  return LOG_DIR;
}

export function getSessionDir(repo: string, prNumber: number): string {
  const safeName = repo.replace("/", "_");
  return join(DATA_DIR, `${safeName}_${prNumber}`);
}

export function getSessionFilePath(
  repo: string,
  prNumber: number,
  sessionId: string,
): string {
  const dir = getSessionDir(repo, prNumber);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(dir, `session_${timestamp}_${sessionId}.json`);
}

export async function ensureDir(dir: string): Promise<void> {
  const { mkdir } = await import("fs/promises");
  await mkdir(dir, { recursive: true });
}
