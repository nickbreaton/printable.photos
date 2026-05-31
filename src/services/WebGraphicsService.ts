import { Context, Effect, Layer } from "effect";

import { CanvasBlobEncodeError, CanvasContextError, CreateImageBitmapError } from "../schema";

export class WebGraphicsService extends Context.Service<WebGraphicsService>()("WebGraphicsService", {
  make: Effect.gen(function* () {
    const createCanvas = Effect.fn("WebGraphicsService.createCanvas")(function* (width: number, height: number) {
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        return yield* new CanvasContextError();
      }

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          canvas.width = 0;
          canvas.height = 0;
        }),
      );

      return { canvas, context };
    });

    const encodeCanvas = Effect.fn("WebGraphicsService.encodeCanvas")(function* (
      canvas: HTMLCanvasElement,
      type: string,
      quality?: number,
    ) {
      return yield* Effect.callback<Blob, CanvasBlobEncodeError>((resume) => {
        canvas.toBlob(
          (blob) => resume(blob ? Effect.succeed(blob) : Effect.fail(new CanvasBlobEncodeError())),
          type,
          quality,
        );
      });
    });

    const createImageBitmap = Effect.fn("WebGraphicsService.createImageBitmap")(function* (source: ImageBitmapSource) {
      const bitmap = yield* Effect.tryPromise({
        try: () => window.createImageBitmap(source),
        catch: (cause) => new CreateImageBitmapError({ cause }),
      });

      yield* Effect.addFinalizer(() => {
        return Effect.sync(() => bitmap.close());
      });

      return bitmap;
    });

    return { createCanvas, createImageBitmap, encodeCanvas };
  }),
}) {
  static readonly layer = Layer.effect(WebGraphicsService, WebGraphicsService.make);
}
