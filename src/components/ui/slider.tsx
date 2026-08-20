import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2 data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-[var(--radius-sm)] border-2 border-border bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-signal" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-5 rounded-[var(--radius-sm)] border-2 border-border bg-card shadow-[1px_1px_0px_var(--color-border)] ring-offset-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none active:scale-95" />
    </SliderPrimitive.Root>
  );
}

export { Slider };
