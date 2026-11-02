import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const buttonVariants = cva("ms-button", {
  variants: {
    variant: {
      default: "ms-button-default",
      destructive: "ms-button-destructive",
      ghost: "ms-button-ghost",
      outline: "ms-button-outline",
      secondary: "ms-button-secondary"
    },
    size: {
      default: "ms-button-md",
      icon: "ms-button-icon",
      sm: "ms-button-sm"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ asChild, className, size, variant, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ size, variant }), className)} ref={ref} {...props} />;
});

Button.displayName = "Button";

export { buttonVariants };
