import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--karya-bg)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "border border-transparent bg-[var(--karya-control-hover)] text-[var(--karya-text)] shadow-[var(--karya-shadow-button)] hover:bg-[var(--karya-control)]",
        secondary: "border border-transparent bg-[var(--karya-control)] text-[var(--karya-text)] shadow-[var(--karya-shadow-button)] hover:bg-[var(--karya-control-hover)]",
        ghost: "text-[var(--karya-muted)] hover:bg-[var(--karya-control)] hover:text-[var(--karya-text)]",
        outline: "border border-[var(--karya-border-strong)] bg-[var(--karya-surface)] text-[var(--karya-text)] shadow-[var(--karya-shadow-button)] hover:bg-[var(--karya-control)]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, size, variant, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ className, size, variant }))}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
