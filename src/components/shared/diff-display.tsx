import React, { useMemo } from "react";

interface DiffDisplayProps {
  diffContent: string;
  view?: "unified" | "split";
}

/**
 * Split a multi-file unified diff into one string per file.
 * Each chunk starts with "diff --git ..." and includes everything
 * up to (but not including) the next "diff --git" line.
 */
function splitDiffByFile(fullDiff: string): string[] {
  const parts: string[] = [];
  const marker = "diff --git ";
  let idx = fullDiff.indexOf(marker);
  while (idx !== -1) {
    const next = fullDiff.indexOf(marker, idx + marker.length);
    parts.push(next === -1 ? fullDiff.slice(idx) : fullDiff.slice(idx, next));
    idx = next;
  }
  return parts.length > 0 ? parts : [fullDiff];
}

function fileNameFromPatch(patch: string): string {
  const match = patch.match(/^diff --git a\/.+ b\/(.+)$/m);
  return match?.[1] ?? "unknown";
}

export function DiffDisplay({ diffContent, view = "unified" }: DiffDisplayProps) {
  const fileDiffs = useMemo(() => splitDiffByFile(diffContent), [diffContent]);

  return (
    <>
      {fileDiffs.map((fileDiff, i) => (
        <box key={i} flexDirection="column" flexShrink={0} width="100%">
          <text
            fg="#93C5FD"
            attributes={1}
            flexShrink={0}
          >
            {fileNameFromPatch(fileDiff)}
          </text>
          <diff
            diff={fileDiff}
            view={view}
            showLineNumbers
            addedBg="#064E3B"
            removedBg="#7F1D1D"
            contextBg="#111827"
            lineNumberFg="#6B7280"
            wrapMode="char"
            width="100%"
            flexShrink={0}
          />
        </box>
      ))}
    </>
  );
}
