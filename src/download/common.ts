import picaFactory from "pica";
import { computeInitialCrop, cropFromPercentages, cropToSourcePixels, getCropKey } from "../crop";
import type { CropCoordinates } from "../data";
import type { PackedImageRectangle } from "../layout";

export const EXPORT_DPI = 300;
export const JPEG_QUALITY = 0.94;
export const pica = picaFactory();

export interface PaperLayout {
  width: number;
  height: number;
  units: "in" | "mm";
}

export interface DownloadImage {
  id: string;
  width: number;
  height: number;
  blob: Blob;
  type: string;
  crops: Record<string, CropCoordinates>;
}

export function toInches(value: number, units: PaperLayout["units"]) {
  return units === "mm" ? value / 25.4 : value;
}

function getPlacedCrop(image: DownloadImage, rect: PackedImageRectangle) {
  const savedCrop = image.crops?.[getCropKey(rect)];

  return savedCrop
    ? cropFromPercentages(savedCrop, image.width, image.height)
    : computeInitialCrop(image.width, image.height, rect);
}

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function get2dContext(canvas: HTMLCanvasElement, errorMessage: string) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(errorMessage);
  }

  return context;
}

export async function renderImageForRect(
  image: DownloadImage,
  rect: PackedImageRectangle,
  targetWidthPx: number,
  targetHeightPx: number,
  resize: "pica" | "canvas" = "pica",
) {
  const sourceBitmap = await createImageBitmap(image.blob);

  try {
    const crop = getPlacedCrop(image, rect);
    const sourceCrop = cropToSourcePixels(crop, image.width, image.height);
    const cropX = Math.max(0, Math.min(image.width - 1, sourceCrop.x));
    const cropY = Math.max(0, Math.min(image.height - 1, sourceCrop.y));
    const cropWidth = Math.max(1, Math.min(image.width - cropX, sourceCrop.width));
    const cropHeight = Math.max(1, Math.min(image.height - cropY, sourceCrop.height));
    const preRotationWidth = rect.rot ? targetHeightPx : targetWidthPx;
    const preRotationHeight = rect.rot ? targetWidthPx : targetHeightPx;
    const croppedCanvas = createCanvas(
      Math.max(1, Math.round(cropWidth)),
      Math.max(1, Math.round(cropHeight)),
    );
    const croppedContext = get2dContext(croppedCanvas, "Failed to create cropped canvas context");

    croppedContext.drawImage(
      sourceBitmap,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      croppedCanvas.width,
      croppedCanvas.height,
    );

    const fittedCanvas = createCanvas(preRotationWidth, preRotationHeight);

    if (resize === "pica") {
      await pica.resize(croppedCanvas, fittedCanvas, {
        quality: 3,
        unsharpAmount: 80,
        unsharpRadius: 0.6,
        unsharpThreshold: 2,
      });
    } else {
      const fittedContext = get2dContext(fittedCanvas, "Failed to create fitted canvas context");

      fittedContext.imageSmoothingEnabled = true;
      fittedContext.imageSmoothingQuality = "high";
      fittedContext.drawImage(croppedCanvas, 0, 0, fittedCanvas.width, fittedCanvas.height);
    }

    if (!rect.rot) {
      return fittedCanvas;
    }

    const rotatedCanvas = createCanvas(targetWidthPx, targetHeightPx);
    const rotatedContext = get2dContext(rotatedCanvas, "Failed to create rotated canvas context");

    rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedContext.rotate(Math.PI / 2);
    rotatedContext.drawImage(fittedCanvas, -fittedCanvas.width / 2, -fittedCanvas.height / 2);

    return rotatedCanvas;
  } finally {
    sourceBitmap.close();
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
