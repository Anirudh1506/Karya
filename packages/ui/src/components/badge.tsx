import * as React from "react";
import { cn } from "../lib";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

export function Badge({ className, ...props }: BadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-transparent bg-[var(--karya-control)] px-2 py-0.5 text-xs font-medium text-[var(--karya-muted)] shadow-[var(--karya-shadow-button)]",
        className,
      )}
      {...props}
    />
  );
}
