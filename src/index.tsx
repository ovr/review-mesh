import React from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app";

async function main() {
  const args = process.argv.slice(2);

  let repo: string | undefined;
  let prNumber: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "-r" || arg === "--repo") && args[i + 1]) {
      repo = args[++i];
    } else if ((arg === "-p" || arg === "--pr") && args[i + 1]) {
      prNumber = parseInt(args[++i], 10);
    } else if (arg === "-h" || arg === "--help") {
      console.log(`simplify-me-review — PR Review TUI with multi-agent cross-validation

Usage:
  simplify-me-review [options]

Options:
  -r, --repo <owner/repo>  GitHub repository (default: auto-detect from git)
  -p, --pr <number>        PR number to review immediately
  -h, --help               Show this help message

Navigation:
  ←→ / Tab       Switch between tabs
  ↑↓ / j/k       Scroll / navigate lists
  Enter           Select item
  r               Start review on selected PR
  q               Quit`);
      process.exit(0);
    } else if (/^\d+$/.test(arg)) {
      prNumber = parseInt(arg, 10);
    }
  }

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useAlternateScreen: true,
  });

  const root = createRoot(renderer);
  root.render(<App repo={repo} initialPR={prNumber} />);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
