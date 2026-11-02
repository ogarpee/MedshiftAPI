import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "./utils";

export const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>>(
  ({ className, ...props }, ref) => <AvatarPrimitive.Root ref={ref} className={cn("ms-avatar", className)} {...props} />
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

export const AvatarImage = AvatarPrimitive.Image;

export const AvatarFallback = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Fallback>, React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>>(
  ({ className, ...props }, ref) => <AvatarPrimitive.Fallback ref={ref} className={cn("ms-avatar-fallback", className)} {...props} />
);
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;
