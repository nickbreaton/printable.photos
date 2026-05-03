import { clsx, type ClassValue } from "clsx";
import picaFactory from "pica";
import { twMerge } from "tailwind-merge";

const pica = picaFactory();

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function createPreviewBlob(
  file: File,
  image: HTMLImageElement,
  maxEdgePx: number,
) {
  const longestEdge = Math.max(image.width, image.height);
  const targetLongestEdge = Math.min(longestEdge, maxEdgePx);

  if (targetLongestEdge === longestEdge) {
    return file;
  }

  const scale = targetLongestEdge / longestEdge;
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const sourceBitmap = await createImageBitmap(file);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceBitmap.width;
  sourceCanvas.height = sourceBitmap.height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    sourceBitmap.close();
    throw new Error("Failed to create source canvas context");
  }
  sourceContext.drawImage(sourceBitmap, 0, 0);
  sourceBitmap.close();

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = targetWidth;
  previewCanvas.height = targetHeight;

  await pica.resize(sourceCanvas, previewCanvas, {
    quality: 3,
    unsharpAmount: 80,
    unsharpRadius: 0.6,
    unsharpThreshold: 2,
  });

  return pica.toBlob(previewCanvas, "image/jpeg", 0.88);
}
