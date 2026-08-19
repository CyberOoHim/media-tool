export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function fileStem(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return "file";
  const base = trimmed.replace(/\.[^/.]+$/, "");
  return base || "file";
}

export function extFromMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "png";
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Seconds → MM:SS, or HH:MM:SS when hours exist (or forceHours). */
export function formatTime(seconds: number, forceHours = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return forceHours ? "00:00:00" : "00:00";
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0 || forceHours) return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(m)}:${pad2(s)}`;
}

export function timestampForFilename(seconds: number): string {
  return formatTime(seconds, seconds >= 3600).replaceAll(":", "-");
}
