import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { ReviewSession } from "./types";
import { ReviewSessionSchema } from "./types";
import { getDataDir, getSessionDir, ensureDir } from "./paths";

export async function saveSession(session: ReviewSession): Promise<string> {
  const dir = getSessionDir(session.repo, session.prNumber);
  await ensureDir(dir);

  const filePath = join(dir, `session_${session.id}.json`);
  await writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
  return filePath;
}

export async function loadSession(filePath: string): Promise<ReviewSession> {
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);
  return ReviewSessionSchema.parse(data);
}

export async function listSessions(
  repo?: string,
  prNumber?: number,
): Promise<{ path: string; session: ReviewSession }[]> {
  const dataDir = getDataDir();
  await ensureDir(dataDir);

  let dirs: string[];
  try {
    dirs = await readdir(dataDir);
  } catch {
    return [];
  }

  const results: { path: string; session: ReviewSession }[] = [];

  for (const dirName of dirs) {
    if (repo && prNumber) {
      const expected = `${repo.replace("/", "_")}_${prNumber}`;
      if (dirName !== expected) continue;
    }

    const dirPath = join(dataDir, dirName);
    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      continue;
    }

    for (const fileName of files) {
      if (!fileName.startsWith("session_") || !fileName.endsWith(".json"))
        continue;
      const filePath = join(dirPath, fileName);
      try {
        const session = await loadSession(filePath);
        if (repo && session.repo !== repo) continue;
        if (prNumber && session.prNumber !== prNumber) continue;
        results.push({ path: filePath, session });
      } catch {
        // skip corrupted files
      }
    }
  }

  results.sort(
    (a, b) =>
      new Date(b.session.createdAt).getTime() -
      new Date(a.session.createdAt).getTime(),
  );

  return results;
}

export async function getLatestSession(
  repo: string,
  prNumber: number,
): Promise<ReviewSession | null> {
  const sessions = await listSessions(repo, prNumber);
  return sessions[0]?.session ?? null;
}
