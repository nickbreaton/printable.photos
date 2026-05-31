import { Context, DateTime, Effect, Layer, Schema, Semaphore } from "effect";

import { database } from "../data";
import { DatabaseWriteError, ImageImportError, ImportedImageSchema } from "../schema";
import { MemoryEstimationService } from "./MemoryEstimationService";
import { ImageOptimizationService } from "./ImageOptimizationService";
import { UUIDService } from "./UUIDService";
import { WebGraphicsService } from "./WebGraphicsService";

function getNextOrder(images: readonly { order: number }[]) {
  return images.reduce((maxOrder, image) => Math.max(maxOrder, image.order), -1) + 1;
}

interface ImportImageOptions {
  file: File;
  projectId: string;
  order: number;
}

interface ImportImagesOptions {
  files: File[];
  projectId: string;
  nextOrder: number;
}

interface AddImagesOptions {
  files: FileList;
  projectId: string;
  currentImages: readonly { order: number }[];
}

export class ImageImportService extends Context.Service<ImageImportService>()("ImageImportService", {
  make: Effect.gen(function* () {
    const memoryEstimationService = yield* MemoryEstimationService;
    const imageOptimizationService = yield* ImageOptimizationService;
    const { randomUUID } = yield* UUIDService;
    const webGraphicsService = yield* WebGraphicsService;

    const importImage = Effect.fn("ImageImportService.importImage")(function* (options: ImportImageOptions) {
      const bitmap = yield* Effect.acquireRelease(
        webGraphicsService
          .createImageBitmap(options.file)
          .pipe(Effect.mapError((cause) => new ImageImportError({ fileName: options.file.name, cause }))),
        (bitmap) => Effect.sync(() => bitmap.close()),
      );

      const optimizedBlob = yield* imageOptimizationService
        .optimize(bitmap)
        .pipe(Effect.mapError((cause) => new ImageImportError({ fileName: options.file.name, cause })));

      const createdAt = yield* DateTime.now;
      const imageId = yield* randomUUID();

      return yield* Schema.encodeEffect(ImportedImageSchema)({
        image: {
          id: imageId,
          projectId: options.projectId,
          order: options.order,
          name: options.file.name,
          type: options.file.type,
          width: bitmap.width,
          height: bitmap.height,
          optimizedBlob,
          crops: {},
          createdAt,
          updatedAt: createdAt,
        },
        originalImage: { imageId, blob: options.file },
      });
    }, Effect.scoped);

    const importImages = Effect.fn("ImageImportService.importImages")(function* (options: ImportImagesOptions) {
      const maxImportBytes = yield* memoryEstimationService.estimate();
      const byteSemaphore = yield* Semaphore.make(maxImportBytes);

      return yield* Effect.all(
        options.files.map((file, index) => {
          // Still allow images exceeding the max parallel size to be processed
          const permitSize = Math.min(file.size, maxImportBytes);

          const projectId = options.projectId;
          const order = options.nextOrder + index;

          return importImage({ file, projectId, order }).pipe(byteSemaphore.withPermits(permitSize));
        }),
        { concurrency: "unbounded" },
      );
    });

    const addImages = Effect.fn("ImageImportService.addImages")(function* (options: AddImagesOptions) {
      const importedImages = yield* importImages({
        files: Array.from(options.files),
        projectId: options.projectId,
        nextOrder: getNextOrder(options.currentImages),
      });

      yield* Effect.tryPromise({
        try: () =>
          database.transaction("rw", database.projects, database.images, database.originalImages, async () => {
            await database.images.bulkAdd(importedImages.map((importedImage) => importedImage.image));
            await database.originalImages.bulkAdd(importedImages.map((importedImage) => importedImage.originalImage));
          }),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    return { addImages };
  }),
}) {
  static readonly layer = Layer.effect(ImageImportService, ImageImportService.make).pipe(
    Layer.provide(MemoryEstimationService.layer),
    Layer.provide(ImageOptimizationService.layer),
    Layer.provide(UUIDService.layer),
    Layer.provide(WebGraphicsService.layer),
  );
}
