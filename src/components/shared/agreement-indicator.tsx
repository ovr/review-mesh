import React from "react";

interface AgreementIndicatorProps {
  agreement: number; // 0-1
  showLabel?: boolean;
}

export function AgreementIndicator({
  agreement,
  showLabel = true,
}: AgreementIndicatorProps) {
  let color: string;
  let label: string;

  if (agreement >= 0.8) {
    color = "#10B981";
    label = "HIGH AGREEMENT";
  } else if (agreement >= 0.5) {
    color = "#F59E0B";
    label = "PARTIAL AGREEMENT";
  } else {
    color = "#EF4444";
    label = "LOW AGREEMENT";
  }

  const pct = Math.round(agreement * 100);

  return (
    <box flexDirection="row" alignItems="center" gap={1}>
      <text fg={color} attributes={1}>
        {"●"}
      </text>
      <text fg={color} attributes={1}>
        {`${pct}%`}
      </text>
      {showLabel && (
        <text fg="#9CA3AF">
          {label}
        </text>
      )}
    </box>
  );
}
