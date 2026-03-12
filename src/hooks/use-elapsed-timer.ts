import { useState, useEffect } from "react";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function useElapsedTimer(
  startedAt?: number,
  completedAt?: number,
): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt || completedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, completedAt]);

  if (!startedAt) return null;
  if (completedAt) return formatElapsed(completedAt - startedAt);
  return formatElapsed(now - startedAt);
}
