import { appendFile } from "fs/promises";
import { join } from "path";
import { getLogDir, ensureDir } from "../storage/paths";

let logFile: string | null = null;

async function getLogFile(): Promise<string> {
  if (!logFile) {
    const dir = getLogDir();
    await ensureDir(dir);
    const date = new Date().toISOString().slice(0, 10);
    logFile = join(dir, `${date}.log`);
  }
  return logFile;
}

export async function log(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  data?: unknown,
): Promise<void> {
  const file = await getLogFile();
  const timestamp = new Date().toISOString();
  const line = data
    ? `[${timestamp}] ${level.toUpperCase()}: ${message} ${JSON.stringify(data)}\n`
    : `[${timestamp}] ${level.toUpperCase()}: ${message}\n`;
  await appendFile(file, line, "utf-8");
}
