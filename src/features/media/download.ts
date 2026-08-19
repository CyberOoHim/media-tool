import { toast } from "sonner";

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

async function saveWithPicker(blob: Blob, filename: string): Promise<boolean> {
  const w = window as SavePickerWindow;
  if (typeof w.showSaveFilePicker !== "function") return false;
  // Cross-origin preview iframes reject the picker; skip so the real <a> can run.
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

/** Programmatic save — prefer a real user-clicked <a download> via SaveLink. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (await saveWithPicker(blob, filename)) {
    toast.success(`Saved ${filename}`);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
  toast.success(`Saving ${filename}`);
}
