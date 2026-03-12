import React from "react";

interface FooterProps {
  activeTab: string;
}

export function Footer({ activeTab }: FooterProps) {
  const hints: Record<string, string> = {
    prs: "Enter:select  r:refresh  q:quit  ←→:tabs",
    review: "r:start review  q:quit  ←→:tabs",
    reasoning: "↑↓:scroll  q:quit  ←→:tabs",
    validation: "↑↓:scroll  q:quit  ←→:tabs",
    history: "Enter:load  q:quit  ←→:tabs",
  };

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      justifyContent="center"
      paddingX={1}
    >
      <text fg="#6B7280">{hints[activeTab] ?? "q:quit  ←→:tabs"}</text>
    </box>
  );
}
