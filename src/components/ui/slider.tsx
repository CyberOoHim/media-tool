import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center py-3.5 data-[disabled]:opacity-50 cursor-pointer active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-3.5 w-full grow overflow-hidden rounded-[var(--radius-sm)] border-2 border-border bg-secondary shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
        <SliderPrimitive.Range className="absolute h-full bg-signal transition-all" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="relative block size-6.5 rounded-[var(--radius-sm)] border-2 border-border bg-card shadow-[2px_2px_0px_var(--color-border)] ring-offset-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none active:scale-110 active:bg-signal after:absolute after:-inset-3 after:content-['']" />
    </SliderPrimitive.Root>
  );
}

export { Slider };
