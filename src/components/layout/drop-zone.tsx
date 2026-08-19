import { useCallback, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  accept: string;
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function DropZone({ accept, onFiles, disabled, className, children }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = useCallback(
    (files: FileList | null) => {
      if (!files?.length || disabled) return;
      onFiles(files);
    },
    [disabled, onFiles],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setOver(true);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    take(event.target.files);
    event.target.value = "";
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "relative cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed border-border transition-colors duration-150",
        over && "border-signal bg-signal/5",
        disabled && "cursor-default",
        className,
      )}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={onChange}
        disabled={disabled}
      />
      {children}
    </div>
  );
}
