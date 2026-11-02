import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "./utils";

export const Separator = React.forwardRef<React.ElementRef<typeof SeparatorPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>>(
  ({ className, orientation = "horizontal", ...props }, ref) => <SeparatorPrimitive.Root ref={ref} className={cn("ms-separator", className)} orientation={orientation} {...props} />
);
Separator.displayName = SeparatorPrimitive.Root.displayName;
