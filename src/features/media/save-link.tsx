import { Button, type ButtonProps } from "@/components/ui/button";
import { saveBlob, toastSaveResult } from "@/features/media/download";
import type { ReactNode } from "react";

type SaveLinkProps = {
  blob: Blob;
  filename: string;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
};

/**
 * User-gesture save. iPad/iPhone ignore <a download> and never write a file,
 * so we hand the blob to the native share sheet (Save Image / Save to Files).
 */
export function SaveLink({ blob, filename, children, variant = "success", size, className }: SaveLinkProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        void saveBlob(blob, filename).then((result) => {
          toastSaveResult(result, filename);
        });
      }}
    >
      {children}
    </Button>
  );
}
