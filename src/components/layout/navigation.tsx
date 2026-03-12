import React, { useEffect, useRef } from "react";
import type { TabSelectRenderable } from "@opentui/core";

export const TAB_OPTIONS = [
  { name: "PRs", description: "Browse pull requests", value: "prs" },
  { name: "Review", description: "Review results", value: "review" },
  { name: "Diff", description: "PR diff", value: "diff" },
  { name: "Reasoning", description: "Reasoning chain", value: "reasoning" },
  { name: "Validation", description: "Cross-validation", value: "validation" },
  { name: "History", description: "Past reviews", value: "history" },
];

interface NavigationProps {
  selectedIndex: number;
  onTabChange: (index: number) => void;
}

export function Navigation({ selectedIndex, onTabChange }: NavigationProps) {
  const tabRef = useRef<TabSelectRenderable>(null);

  useEffect(() => {
    if (tabRef.current && tabRef.current.getSelectedIndex() !== selectedIndex) {
      tabRef.current.setSelectedIndex(selectedIndex);
    }
  }, [selectedIndex]);

  return (
    <tab-select
      ref={tabRef}
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
