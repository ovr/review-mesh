import { spawnProcess } from "../utils/subprocess";
import { log } from "../utils/logger";
import type { PRData, PRListItem, PRFile, PRComment } from "../storage/types";

async function ghJson<T>(args: string[]): Promise<T> {
  const result = await spawnProcess({
    command: ["gh", ...args],
    timeoutMs: 30_000,
  });
  if (result.exitCode !== 0) {
    throw new Error(`gh ${args.join(" ")} failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

async function ghText(args: string[]): Promise<string> {
  const result = await spawnProcess({
    command: ["gh", ...args],
    timeoutMs: 30_000,
  });
  if (result.exitCode !== 0) {
    throw new Error(`gh ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

export async function listPRs(repo?: string): Promise<PRListItem[]> {
  const repoArgs = repo ? ["-R", repo] : [];
  const raw = await ghJson<
    Array<{
      number: number;
      title: string;
      author: { login: string };
      headRefName: string;
      updatedAt: string;
      url: string;
      labels: Array<{ name: string }>;
      isDraft: boolean;
    }>
  >([
    "pr",
    "list",
    ...repoArgs,
    "--json",
    "number,title,author,headRefName,updatedAt,url,labels,isDraft",
    "--limit",
    "30",
  ]);

  return raw.map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.author.login,
    headRefName: pr.headRefName,
    updatedAt: pr.updatedAt,
    url: pr.url,
    labels: pr.labels.map((l) => l.name),
    isDraft: pr.isDraft,
  }));
}

export async function fetchPR(
  prNumber: number,
  repo?: string,
): Promise<PRData> {
  const repoArgs = repo ? ["-R", repo] : [];

  await log("info", `Fetching PR #${prNumber}`, { repo });

  const [metadata, diff, files, comments] = await Promise.all([
    ghJson<{
      number: number;
      title: string;
      body: string;
      author: { login: string };
      baseRefName: string;
      headRefName: string;
      url: string;
      additions: number;
      deletions: number;
      changedFiles: number;
      labels: Array<{ name: string }>;
    }>([
      "pr",
      "view",
      String(prNumber),
      ...repoArgs,
      "--json",
      "number,title,body,author,baseRefName,headRefName,url,additions,deletions,changedFiles,labels",
    ]),
    ghText(["pr", "diff", String(prNumber), ...repoArgs]),
    ghJson<
      Array<{
        path: string;
        additions: number;
        deletions: number;
        patch: string;
      }>
    >([
      "pr",
      "view",
      String(prNumber),
      ...repoArgs,
      "--json",
      "files",
    ]).then(
      (r: any) =>
        (r.files ?? r) as Array<{
          path: string;
          additions: number;
          deletions: number;
          patch: string;
        }>,
    ),
    ghJson<
      Array<{ author: { login: string }; body: string; createdAt: string }>
    >([
      "pr",
      "view",
      String(prNumber),
      ...repoArgs,
      "--json",
      "comments",
    ]).then(
      (r: any) =>
        (r.comments ?? r) as Array<{
          author: { login: string };
          body: string;
          createdAt: string;
        }>,
    ),
  ]);

  const prData: PRData = {
    metadata: {
      number: metadata.number,
      title: metadata.title,
      body: metadata.body ?? "",
      author: metadata.author.login,
      baseRefName: metadata.baseRefName,
      headRefName: metadata.headRefName,
      url: metadata.url,
      additions: metadata.additions,
      deletions: metadata.deletions,
      changedFiles: metadata.changedFiles,
      labels: metadata.labels.map((l) => l.name),
    },
    diff,
    files: (files ?? []).map((f) => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ?? "",
    })),
    comments: (comments ?? []).map((c) => ({
      author: c.author.login,
      body: c.body,
      createdAt: c.createdAt,
    })),
    fetchedAt: new Date().toISOString(),
  };

  await log("info", `Fetched PR #${prNumber}`, {
    files: prData.files.length,
    diffLength: prData.diff.length,
  });

  return prData;
}

export function detectRepo(): string | undefined {
  // gh commands auto-detect repo from git remote, so undefined means "use current dir's repo"
  return undefined;
}
