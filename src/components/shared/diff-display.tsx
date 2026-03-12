import React from "react";

interface DiffDisplayProps {
  diffContent: string;
  view?: "unified" | "split";
}

export function DiffDisplay({ diffContent, view = "unified" }: DiffDisplayProps) {
  return (
    <diff
      diff={diffContent}
      view={view}
      showLineNumbers
      addedBg="#064E3B"
      removedBg="#7F1D1D"
      contextBg="#111827"
      lineNumberFg="#6B7280"
      wrapMode="char"
      width="100%"
      flexGrow={1}
    />
  );
}
