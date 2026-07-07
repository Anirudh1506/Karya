import * as React from "react";
import { cn } from "../lib";

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Surface({ className, ...props }: SurfaceProps): React.ReactElement {
  return (
    <section
      className={cn("karya-surface-card rounded-xl border border-transparent bg-[var(--karya-surface)] shadow-[var(--karya-shadow-card)] transition-colors duration-200", className)}
      {...props}
    />
  );
}
