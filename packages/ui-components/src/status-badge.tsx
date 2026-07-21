import type { ReactNode } from "react";

interface StatusBadgeProps {
  children: ReactNode;
  tone?: "gold" | "green" | "navy";
}

export function StatusBadge({ children, tone = "gold" }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}
