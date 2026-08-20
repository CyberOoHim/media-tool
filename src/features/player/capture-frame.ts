import {
  type TransformState,
  hasActiveTransform,
  renderTransformedSource,
} from "@/features/media/transform";

export async function captureVideoFrame(
  video: HTMLVideoElement,
  transform?: TransformState,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Nothing to capture");
  }

  let canvas: HTMLCanvasElement;
  if (transform && hasActiveTransform(transform)) {
    canvas = renderTransformedSource(
      video,
      video.videoWidth,
      video.videoHeight,
      transform,
    );
  } else {
    canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Failed to capture frame.");
  return { blob, width: canvas.width, height: canvas.height };
}
