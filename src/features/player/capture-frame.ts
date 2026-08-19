export async function captureVideoFrame(video: HTMLVideoElement): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Nothing to capture");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to capture frame.");
  return { blob, width: canvas.width, height: canvas.height };
}
