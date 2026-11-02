import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva("ms-badge", {
  variants: {
    variant: {
      default: "ms-badge-default",
      gold: "ms-badge-gold",
      green: "ms-badge-green",
      navy: "ms-badge-navy",
      red: "ms-badge-red",
      secondary: "ms-badge-secondary"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
