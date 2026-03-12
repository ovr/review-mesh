import React from "react";

interface AgentBadgeProps {
  name: string;
  color?: string;
}

const AGENT_COLORS: Record<string, string> = {
  claude: "#D97706",
  codex: "#10B981",
};

export function AgentBadge({ name, color }: AgentBadgeProps) {
  const badgeColor = color ?? AGENT_COLORS[name] ?? "#6B7280";

  return (
    <text fg="#000000" bg={badgeColor} attributes={1}>
      {` ${name.toUpperCase()} `}
    </text>
  );
}
