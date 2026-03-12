import React, { useState, useEffect } from "react";
import type { ReviewSession } from "../../storage/types";
import { listSessions } from "../../storage/store";
import { AgreementIndicator } from "../shared/agreement-indicator";

interface HistoryViewProps {
  onSelect: (session: ReviewSession) => void;
}

export function HistoryView({ onSelect }: HistoryViewProps) {
  const [sessions, setSessions] = useState<
    { path: string; session: ReviewSession }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const all = await listSessions();
      setSessions(all);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#F59E0B">Loading history...</text>
      </box>
    );
  }

  if (sessions.length === 0) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#9CA3AF">No review history found</text>
      </box>
    );
  }

  const options = sessions.map(({ session }) => ({
    name: `#${session.prNumber} ${session.repo} — ${session.status}`,
    description: `${new Date(session.createdAt).toLocaleString()} | ${
      session.reviews.length
    } review(s)${
      session.crossValidation
        ? ` | agreement: ${Math.round(session.crossValidation.overallAgreement * 100)}%`
        : ""
    }`,
    value: session,
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
        const s = sessions[index];
        if (s) onSelect(s.session);
      }}
    />
  );
}
