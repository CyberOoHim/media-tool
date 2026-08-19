import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ReactNode } from "react";

type SaveLinkProps = {
  href: string;
  filename: string;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
};

/**
 * Real user-activated download. Programmatic a.click() is silently dropped
 * inside the live preview iframe; a genuine <a download> click is not.
 * target=_blank keeps the app in place if the browser ignores `download`.
 */
export function SaveLink({ href, filename, children, variant = "success", size, className }: SaveLinkProps) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a
        href={href}
        download={filename}
        target="_blank"
        rel="noopener"
        onClick={() => {
          toast.success(`Saving ${filename}`);
        }}
      >
        {children}
      </a>
    </Button>
  );
}
