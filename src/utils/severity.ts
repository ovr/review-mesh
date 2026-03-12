const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  error: 3,
  warning: 2,
  info: 1,
};

export function severityRank(severity: string | undefined): number {
  return SEVERITY_ORDER[severity ?? "info"] ?? 0;
}
