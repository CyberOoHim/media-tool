import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] font-mono text-sm font-semibold tracking-wide transition-all duration-75 select-none disabled:pointer-events-none disabled:opacity-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-2 border-border bg-primary text-primary-foreground shadow-[2px_2px_0px_var(--color-border)] hover:brightness-105",
        primary:
          "border-2 border-border bg-primary text-primary-foreground shadow-[2px_2px_0px_var(--color-border)] hover:brightness-105",
        secondary:
          "border-2 border-border bg-secondary text-secondary-foreground shadow-[2px_2px_0px_var(--color-border)] hover:bg-muted",
        signal:
          "border-2 border-border bg-signal text-signal-foreground shadow-[2px_2px_0px_var(--color-border)] hover:brightness-105",
        accent:
          "border-2 border-border bg-accent text-accent-foreground shadow-[2px_2px_0px_var(--color-border)] hover:brightness-105",
        outline:
          "border-2 border-border bg-card text-foreground shadow-[2px_2px_0px_var(--color-border)] hover:bg-secondary",
        ghost:
          "border-2 border-transparent text-foreground hover:border-border hover:bg-secondary/70",
        success:
          "border-2 border-border bg-success text-success-foreground shadow-[2px_2px_0px_var(--color-border)] hover:brightness-105",
        destructive:
          "border-2 border-border bg-destructive text-destructive-foreground shadow-[2px_2px_0px_var(--color-border)] hover:brightness-105",
      },
      size: {
        default: "h-9 px-4 text-xs uppercase tracking-wider",
        sm: "h-7 px-2.5 text-[11px] uppercase tracking-wider",
        lg: "h-11 px-6 text-sm uppercase tracking-wider",
        icon: "size-9 p-0",
        "icon-sm": "size-7 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
