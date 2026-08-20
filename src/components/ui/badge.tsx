import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-2 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-foreground",
        signal: "border-border bg-signal text-signal-foreground",
        success: "border-border bg-success text-success-foreground",
        primary: "border-border bg-primary text-primary-foreground",
        accent: "border-border bg-accent text-accent-foreground",
        outline: "border-border bg-card text-foreground",
        destructive: "border-border bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
