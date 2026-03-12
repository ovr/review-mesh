import React from "react";

export const TAB_OPTIONS = [
  { name: "PRs", description: "Browse pull requests", value: "prs" },
  { name: "Review", description: "Review results", value: "review" },
  { name: "Reasoning", description: "Reasoning chain", value: "reasoning" },
  { name: "Validation", description: "Cross-validation", value: "validation" },
  { name: "History", description: "Past reviews", value: "history" },
];

interface NavigationProps {
  selectedIndex: number;
  onTabChange: (index: number) => void;
}

export function Navigation({ selectedIndex, onTabChange }: NavigationProps) {
  return (
    <tab-select
      focused
      options={TAB_OPTIONS}
      selectedBackgroundColor="#7C3AED"
      selectedTextColor="#FFFFFF"
      textColor="#9CA3AF"
      backgroundColor="#1F2937"
      height={1}
      width="100%"
      showDescription={false}
      showUnderline
      onChange={(index) => onTabChange(index)}
    />
  );
}
