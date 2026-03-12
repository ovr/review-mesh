import React from "react";
import { DiffDisplay } from "../shared/diff-display";
import type { PRData } from "../../storage/types";

interface DiffViewProps {
  prData?: PRData;
}

export function DiffView({ prData }: DiffViewProps) {
  if (!prData) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#6B7280">Diff will appear once PR data is fetched</text>
      </box>
    );
  }

  return (
    <scrollbox focused flexGrow={1} width="100%" scrollY>
      <DiffDisplay diffContent={prData.diff} />
    </scrollbox>
  );
}
