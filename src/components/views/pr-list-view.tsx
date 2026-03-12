import React, { useState, useEffect } from "react";
import type { PRListItem } from "../../storage/types";
import { listPRs } from "../../github/pr-fetcher";

interface PRListViewProps {
  repo?: string;
  onSelect: (pr: PRListItem) => void;
}

export function PRListView({ repo, onSelect }: PRListViewProps) {
  const [prs, setPrs] = useState<PRListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPRs();
  }, [repo]);

  async function loadPRs() {
    setLoading(true);
    setError(null);
    try {
      const items = await listPRs(repo);
      setPrs(items);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

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

  const options = prs.map((pr) => ({
    name: `#${pr.number} ${pr.title}`,
    description: `${pr.author} → ${pr.headRefName}${pr.isDraft ? " [DRAFT]" : ""}`,
    value: pr,
  }));

  return (
    <select
      focused
      options={options}
      width="100%"
      flexGrow={1}
      textColor="#E5E7EB"
      focusedBackgroundColor="#374151"
      focusedTextColor="#FFFFFF"
      selectedBackgroundColor="#7C3AED"
      selectedTextColor="#FFFFFF"
      descriptionColor="#9CA3AF"
      showDescription
      onSelect={(index) => {
        if (prs[index]) onSelect(prs[index]);
      }}
    />
  );
}
