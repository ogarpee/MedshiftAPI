import type { ReactNode } from "react";
import { Badge } from "./badge";

interface StatusBadgeProps {
  children: ReactNode;
  tone?: "gold" | "green" | "navy" | "red";
}

export function StatusBadge({ children, tone = "gold" }: StatusBadgeProps) {
  return (
    <Badge className={`status-badge status-badge-${tone}`} variant={tone}>
      {children}
    </Badge>
  );
}
