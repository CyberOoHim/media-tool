export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!("clipboard" in navigator) || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard is not available in this browser.");
  }
  const type = blob.type || "image/png";
  const item = new ClipboardItem({ [type]: blob });
  await navigator.clipboard.write([item]);
}

export function imageFileFromClipboard(event: ClipboardEvent): File | null {
  const files = event.clipboardData?.files;
  if (files) {
    for (const file of files) {
      if (file.type.startsWith("image/")) return file;
    }
  }
  const items = event.clipboardData?.items;
  if (items) {
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  return null;
}
