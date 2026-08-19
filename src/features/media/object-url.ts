export function revokeQuiet(url: string | undefined | null) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* already revoked */
  }
}

export function createTrackedUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
