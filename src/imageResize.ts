const MAX_OPTIMIZED_IMAGE_PIXELS = 6_000_000;
const JPEG_QUALITY = 0.9;

interface ImageBlobOptions {
  blob: Blob;
  bitmap: ImageBitmap;
}

export interface ImportImageBlobs {
  optimizedBlob?: Blob;
  optimizedDimensions: { width: number; height: number };
}

function getOptimizedDimensions(options: ImageBlobOptions) {
  const scale = Math.min(
    1,
    Math.sqrt(MAX_OPTIMIZED_IMAGE_PIXELS / (options.bitmap.width * options.bitmap.height)),
  );

  return {
    width: Math.max(1, Math.round(options.bitmap.width * scale)),
    height: Math.max(1, Math.round(options.bitmap.height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create image blob"));
        }
      },
      type,
      quality,
    );
  });
}

async function resizeBitmapToBlob(bitmap: ImageBitmap, target: { width: number; height: number }) {
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create resize canvas context");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, target.width, target.height);

  return canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
}

export async function createImportImageBlobs(options: ImageBlobOptions): Promise<ImportImageBlobs> {
  const optimizedDimensions = getOptimizedDimensions(options);
  const shouldResize =
    optimizedDimensions.width !== options.bitmap.width ||
    optimizedDimensions.height !== options.bitmap.height;

  return {
    optimizedBlob: shouldResize ? await resizeBitmapToBlob(options.bitmap, optimizedDimensions) : undefined,
    optimizedDimensions,
  };
}
