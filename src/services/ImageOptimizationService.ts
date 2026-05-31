import { Context, Effect, Layer } from "effect";

import { OptimizeImageBlobError, OptimizeImageCanvasContextError } from "../schema";
import { WebGraphicsService } from "./WebGraphicsService";

const MAX_OPTIMIZED_IMAGE_PIXELS = 6_000_000;
const JPEG_QUALITY = 0.9;

function getOptimizedDimensions(bitmap: ImageBitmap) {
  const scale = Math.min(1, Math.sqrt(MAX_OPTIMIZED_IMAGE_PIXELS / (bitmap.width * bitmap.height)));

  return {
    width: Math.max(1, Math.round(bitmap.width * scale)),
    height: Math.max(1, Math.round(bitmap.height * scale)),
  };
}

export class ImageOptimizationService extends Context.Service<ImageOptimizationService>()("ImageOptimizationService", {
  make: Effect.gen(function* () {
    const webGraphicsService = yield* WebGraphicsService;

    const optimize = Effect.fn("ImageOptimizationService.optimize")(function* (bitmap: ImageBitmap) {
      const dimensions = getOptimizedDimensions(bitmap);
      const { canvas, context } = yield* webGraphicsService
        .createCanvas(dimensions.width, dimensions.height)
        .pipe(Effect.mapError(() => new OptimizeImageCanvasContextError()));

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          canvas.width = 0;
          canvas.height = 0;
        }),
      );

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);

      return yield* webGraphicsService
        .encodeCanvas(canvas, "image/jpeg", JPEG_QUALITY)
        .pipe(Effect.mapError(() => new OptimizeImageBlobError()));
    });

    return { optimize };
  }),
}) {
  static readonly layer = Layer.effect(ImageOptimizationService, ImageOptimizationService.make).pipe(
    Layer.provide(WebGraphicsService.layer),
  );
}
