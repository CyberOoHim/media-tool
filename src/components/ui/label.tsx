import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "flex items-center justify-between font-mono text-xs uppercase tracking-wider text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
