import { Context, Effect, Layer } from "effect";

import { OptimizeImageCanvasContextError } from "../schema";

const MAX_OPTIMIZED_IMAGE_PIXELS = 6_000_000;
const JPEG_QUALITY = 0.9;

function getOptimizedDimensions(bitmap: ImageBitmap) {
  const scale = Math.min(1, Math.sqrt(MAX_OPTIMIZED_IMAGE_PIXELS / (bitmap.width * bitmap.height)));

  return {
    width: Math.max(1, Math.round(bitmap.width * scale)),
    height: Math.max(1, Math.round(bitmap.height * scale)),
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

export class OptimizeImageService extends Context.Service<OptimizeImageService>()("OptimizeImageService", {
  make: Effect.gen(function* () {
    const optimize = Effect.fn("OptimizeImageService.optimize")(function* (bitmap: ImageBitmap) {
      const dimensions = getOptimizedDimensions(bitmap);
      const canvas = document.createElement("canvas");

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          canvas.width = 0;
          canvas.height = 0;
        }),
      );

      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      const context = canvas.getContext("2d");

      if (!context) {
        return yield* new OptimizeImageCanvasContextError();
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);

      return yield* Effect.tryPromise({
        try: () => canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY),
        catch: (cause) => cause,
      });
    }, Effect.scoped);

    return { optimize };
  }),
}) {
  static readonly layer = Layer.effect(OptimizeImageService, OptimizeImageService.make);
}
