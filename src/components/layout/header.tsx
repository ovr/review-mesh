import React from "react";

interface HeaderProps {
  repo?: string;
  prNumber?: number;
  prTitle?: string;
}

export function Header({ repo, prNumber, prTitle }: HeaderProps) {
  const title = prNumber
    ? `review-mesh — ${repo ?? "local"} #${prNumber}`
    : "review-mesh";

  return (
    <box
      height={3}
      width="100%"
      borderStyle="rounded"
      border
      borderColor="#7C3AED"
      flexDirection="row"
      justifyContent="center"
      alignItems="center"
      paddingX={1}
    >
      <text fg="#7C3AED" attributes={1}>
        {title}
      </text>
      {prTitle && (
        <text fg="#9CA3AF" marginLeft={2}>
          {prTitle.length > 60 ? prTitle.slice(0, 57) + "..." : prTitle}
        </text>
      )}
    </box>
  );
}
