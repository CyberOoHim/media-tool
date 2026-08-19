import { toast } from "sonner";

export type SaveResult = "shared" | "saved" | "opened" | "cancelled";

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

function extensionOf(filename: string): string {
  const part = filename.split(".").pop();
  return part && part !== filename ? `.${part}` : "";
}

/** iPhone / iPad (including iPadOS that reports as Macintosh). */
export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function prefersShareSave(): boolean {
  if (isAppleTouchDevice()) return true;
  return navigator.maxTouchPoints > 0 && /Android|Mobile/i.test(navigator.userAgent);
}

async function saveWithPicker(blob: Blob, filename: string): Promise<boolean> {
  const w = window as SavePickerWindow;
  if (typeof w.showSaveFilePicker !== "function") return false;
  if (window.top !== window) return false;
  try {
    const ext = extensionOf(filename);
    const mime = blob.type || "application/octet-stream";
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "Image", accept: { [mime]: [ext || ".bin"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return true;
    return false;
  }
}

/**
 * Save a blob using the best path for the device.
 * iPad/iPhone ignore <a download> — use the native share sheet instead
 * (Save Image / Save to Files) from the same user tap.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });

  if (prefersShareSave() && typeof navigator.canShare === "function") {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return "shared";
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  if (await saveWithPicker(blob, filename)) return "saved";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  if (isAppleTouchDevice()) {
    a.target = "_blank";
  } else {
    a.download = filename;
  }
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 8000);
  return isAppleTouchDevice() ? "opened" : "saved";
}

export function toastSaveResult(result: SaveResult, filename: string) {
  if (result === "shared") {
    toast.success("Share sheet opened — choose Save Image or Save to Files");
    return;
  }
  if (result === "saved") {
    toast.success(`Saved ${filename}`);
    return;
  }
  if (result === "opened") {
    toast("Image opened — tap Share, then Save Image");
  }
}

/** Programmatic save — prefer SaveLink so the tap stays a user gesture. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  toastSaveResult(await saveBlob(blob, filename), filename);
}
