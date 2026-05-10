import { clsx, type ClassValue } from "clsx";
import picaFactory from "pica";
import { twMerge } from "tailwind-merge";

const pica = picaFactory();
const PREVIEW_SOFTEN_PX = 0.5;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function createPreviewBlob(
  file: File,
  sourceBitmap: ImageBitmap,
  maxEdgePx: number,
) {
  const longestEdge = Math.max(sourceBitmap.width, sourceBitmap.height);
  const targetLongestEdge = Math.min(longestEdge, maxEdgePx);

  if (targetLongestEdge === longestEdge) {
    return file;
  }

  const scale = targetLongestEdge / longestEdge;
  const targetWidth = Math.max(1, Math.round(sourceBitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(sourceBitmap.height * scale));

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceBitmap.width;
  sourceCanvas.height = sourceBitmap.height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Failed to create source canvas context");
  }
  sourceContext.drawImage(sourceBitmap, 0, 0);

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = targetWidth;
  previewCanvas.height = targetHeight;

  await pica.resize(sourceCanvas, previewCanvas, {
    filter: "hamming",
  });

  const softenedCanvas = document.createElement("canvas");
  softenedCanvas.width = targetWidth;
  softenedCanvas.height = targetHeight;
  const softenedContext = softenedCanvas.getContext("2d");
  if (!softenedContext) {
    throw new Error("Failed to create softened preview canvas context");
  }
  softenedContext.filter = `blur(${PREVIEW_SOFTEN_PX}px)`;
  softenedContext.drawImage(previewCanvas, 0, 0);

  return pica.toBlob(softenedCanvas, "image/jpeg", 0.95);
}
