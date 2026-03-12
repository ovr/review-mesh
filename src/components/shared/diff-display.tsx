import React, { useMemo, useRef, useEffect } from "react";
import type { DiffRenderable } from "@opentui/core";
import type { ReasoningStep } from "../../storage/types";

interface DiffDisplayProps {
  diffContent: string;
  view?: "unified" | "split";
  annotations?: ReasoningStep[];
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

const SEVERITY_COLORS: Record<string, { gutter: string; content: string }> = {
  info: { gutter: "#3B82F6", content: "#1E3A5F" },
  warning: { gutter: "#F59E0B", content: "#5F4B1E" },
  error: { gutter: "#EF4444", content: "#5F1E1E" },
  critical: { gutter: "#DC2626", content: "#7F1D1D" },
};

interface DiffLineMap {
  newLineToDisplay: Map<number, number>;
}

/**
 * Parse a unified diff for a single file and build a mapping from
 * new-file line numbers to 0-indexed display line numbers.
 */
function buildDiffLineMap(fileDiff: string): DiffLineMap {
  const lines = fileDiff.split("\n");
  const newLineToDisplay = new Map<number, number>();

  let displayLine = -1; // will be incremented for each line we encounter
  let newLine = 0;
  let inHunk = false;

  for (const line of lines) {
    // Hunk header: @@ -old,count +new,count @@
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      displayLine++;
      newLine = parseInt(hunkMatch[1], 10);
      inHunk = true;
      continue;
    }

    if (!inHunk) {
      // Header lines (diff --git, index, ---, +++) each take a display line
      displayLine++;
      continue;
    }

    if (line.startsWith("-")) {
      // Removed line — no new-file line number
      displayLine++;
    } else if (line.startsWith("+")) {
      // Added line — maps to newLine
      displayLine++;
      newLineToDisplay.set(newLine, displayLine);
      newLine++;
    } else {
      // Context line
      displayLine++;
      newLineToDisplay.set(newLine, displayLine);
      newLine++;
    }
  }

  return { newLineToDisplay };
}

/**
 * Check if a file annotation matches a diff file name.
 * Supports suffix matching (e.g., "src/app.ts" matches "app.ts").
 */
function fileMatches(diffFileName: string, annotationFile: string): boolean {
  if (diffFileName === annotationFile) return true;
  return (
    diffFileName.endsWith("/" + annotationFile) ||
    annotationFile.endsWith("/" + diffFileName)
  );
}

interface FileAnnotation {
  startLine: number;
  endLine: number;
  severity: string;
}

function getFileAnnotations(
  fileName: string,
  annotations: ReasoningStep[],
): FileAnnotation[] {
  const result: FileAnnotation[] = [];
  for (const step of annotations) {
    if (!step.codeLocations) continue;
    for (const loc of step.codeLocations) {
      if (fileMatches(fileName, loc.file)) {
        result.push({
          startLine: loc.startLine,
          endLine: loc.endLine ?? loc.startLine,
          severity: step.severity ?? "info",
        });
      }
    }
  }
  return result;
}

interface FileDiffProps {
  fileDiff: string;
  fileName: string;
  view: "unified" | "split";
  fileAnnotations: FileAnnotation[];
}

function FileDiffComponent({ fileDiff, fileName, view, fileAnnotations }: FileDiffProps) {
  const diffRef = useRef<DiffRenderable>(null);
  const lineMap = useMemo(() => buildDiffLineMap(fileDiff), [fileDiff]);

  useEffect(() => {
    const el = diffRef.current;
    if (!el || fileAnnotations.length === 0) return;

    el.clearAllLineColors();

    for (const ann of fileAnnotations) {
      for (let srcLine = ann.startLine; srcLine <= ann.endLine; srcLine++) {
        const displayLine = lineMap.newLineToDisplay.get(srcLine);
        if (displayLine == null) continue;
        const colors = SEVERITY_COLORS[ann.severity] ?? SEVERITY_COLORS.info;
        el.setLineColor(displayLine, {
          gutter: colors.gutter,
          content: colors.content,
        });
      }
    }
  }, [fileAnnotations, lineMap]);

  const annotationCount = fileAnnotations.length;

  return (
    <box flexDirection="column" flexShrink={0} width="100%">
      <text
        fg="#93C5FD"
        attributes={1}
        flexShrink={0}
      >
        {fileName}{annotationCount > 0 ? ` (${annotationCount} issue${annotationCount !== 1 ? "s" : ""})` : ""}
      </text>
      <diff
        ref={diffRef}
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
  );
}

export function DiffDisplay({ diffContent, view = "unified", annotations }: DiffDisplayProps) {
  const fileDiffs = useMemo(() => splitDiffByFile(diffContent), [diffContent]);

  return (
    <>
      {fileDiffs.map((fileDiff, i) => {
        const fileName = fileNameFromPatch(fileDiff);
        const fileAnnotations = annotations
          ? getFileAnnotations(fileName, annotations)
          : [];

        return (
          <FileDiffComponent
            key={i}
            fileDiff={fileDiff}
            fileName={fileName}
            view={view}
            fileAnnotations={fileAnnotations}
          />
        );
      })}
    </>
  );
}
