import { Context, Effect, Layer } from "effect";

import { OptimizeImageBlobError, OptimizeImageCanvasContextError } from "../schema";

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
  return Effect.callback<Blob, OptimizeImageBlobError>((resume) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resume(Effect.succeed(blob));
        } else {
          resume(Effect.fail(new OptimizeImageBlobError()));
        }
      },
      type,
      quality,
    );
  });
}

export class ImageOptimizationService extends Context.Service<ImageOptimizationService>()("ImageOptimizationService", {
  make: Effect.gen(function* () {
    const optimize = Effect.fn("ImageOptimizationService.optimize")(function* (bitmap: ImageBitmap) {
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

      return yield* canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    }, Effect.scoped);

    return { optimize };
  }),
}) {
  static readonly layer = Layer.effect(ImageOptimizationService, ImageOptimizationService.make);
}
