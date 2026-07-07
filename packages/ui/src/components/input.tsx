import * as React from "react";
import { cn } from "../lib";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface-strong)] px-3 text-sm text-[var(--karya-text)] shadow-[var(--karya-shadow-button)] outline-none transition-all duration-150 placeholder:text-[var(--karya-subtle)] focus:border-[var(--karya-ring)] focus:ring-2 focus:ring-[var(--karya-ring-soft)]",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
