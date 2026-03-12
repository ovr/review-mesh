import React, { useState, useEffect, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { PRListItem } from "../../storage/types";
import { listPRs, getCurrentBranch } from "../../github/pr-fetcher";

interface PRListViewProps {
  repo?: string;
  onSelect: (pr: PRListItem) => void;
}

export function PRListView({ repo, onSelect }: PRListViewProps) {
  const [prs, setPrs] = useState<PRListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | undefined>();
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    loadPRs();
  }, [repo]);

  async function loadPRs() {
    setLoading(true);
    setError(null);
    try {
      const [items, branch] = await Promise.all([
        listPRs(repo),
        getCurrentBranch(),
      ]);
      setPrs(items);
      setCurrentBranch(branch);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useKeyboard(
    useCallback(
      (e) => {
        if (prs.length === 0) return;
        if (e.name === "up" || e.name === "k") {
          setFocusedIndex((i) => Math.max(0, i - 1));
        } else if (e.name === "down" || e.name === "j") {
          setFocusedIndex((i) => Math.min(prs.length - 1, i + 1));
        } else if (e.name === "return") {
          if (prs[focusedIndex]) onSelect(prs[focusedIndex]);
        }
      },
      [prs, focusedIndex, onSelect],
    ),
  );

  if (loading) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#F59E0B">Loading pull requests...</text>
      </box>
    );
  }

  if (error) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" gap={1}>
        <text fg="#EF4444">Error loading PRs: {error}</text>
        <text fg="#6B7280">Press r to retry</text>
      </box>
    );
  }

  if (prs.length === 0) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#6B7280">No open pull requests found</text>
      </box>
    );
  }

  return (
    <scrollbox focused flexGrow={1} width="100%" scrollY>
      {prs.map((pr, index) => {
        const isFocused = index === focusedIndex;
        const isCurrent = pr.headRefName === currentBranch;

        return (
          <box
            key={pr.number}
            flexDirection="column"
            width="100%"
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={isFocused ? "#374151" : undefined}
          >
            <box flexDirection="row" gap={1} alignItems="center">
              <text
                fg={isFocused ? "#FFFFFF" : "#E5E7EB"}
                attributes={isFocused ? 1 : 0}
              >
                #{pr.number} {pr.title}
              </text>
              {pr.isDraft && (
                <text fg="#000000" bg="#F59E0B" attributes={1}>
                  {" DRAFT "}
                </text>
              )}
              {isCurrent && (
                <text fg="#000000" bg="#3B82F6" attributes={1}>
                  {" Current Branch "}
                </text>
              )}
            </box>
            <text fg="#9CA3AF">
              {pr.author} → {pr.headRefName}
            </text>
          </box>
        );
      })}
    </scrollbox>
  );
}
