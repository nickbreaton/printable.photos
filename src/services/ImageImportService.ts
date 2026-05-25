import { Context, DateTime, Effect, Layer, Schema, Semaphore } from "effect";

import { database } from "../data";
import { createImportImageBlobs } from "../imageResize";
import {
  DatabaseWriteError,
  ImageImportError,
  ImportedImageSchema,
  type ImportedImage,
} from "../schema";
import { MemoryEstimationService } from "./MemoryEstimationService";

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

    const importImage = Effect.fn("importImage")(function* (options: ImportImageOptions) {
      const bitmap = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () => createImageBitmap(options.file),
          catch: (cause) => new ImageImportError({ fileName: options.file.name, cause }),
        }),
        (bitmap) => Effect.sync(() => bitmap.close()),
      );
      const imageBlobs = yield* Effect.tryPromise({
        try: () => createImportImageBlobs({ blob: options.file, bitmap }),
        catch: (cause) => new ImageImportError({ fileName: options.file.name, cause }),
      });
      const timestamp = yield* DateTime.now;
      const imageId = yield* Effect.promise(() => Promise.resolve(globalThis.crypto.randomUUID()));

      return yield* Schema.encodeEffect(ImportedImageSchema)({
        image: {
          id: imageId,
          projectId: options.projectId,
          order: options.order,
          name: options.file.name,
          type: options.file.type,
          width: imageBlobs.optimizedDimensions.width,
          height: imageBlobs.optimizedDimensions.height,
          optimizedBlob: imageBlobs.optimizedBlob,
          crops: {},
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        originalImage: { imageId, blob: options.file },
      });
    }, Effect.scoped);

    const importImages = Effect.fn("importImages")(function* (options: ImportImagesOptions) {
      const maxImportBytes = yield* memoryEstimationService.estimate();
      const byteSemaphore = yield* Semaphore.make(maxImportBytes);

      return yield* Effect.all(
        options.files.map((file, index) =>
          byteSemaphore.withPermits(Math.min(file.size, maxImportBytes))(
            importImage({
              file,
              projectId: options.projectId,
              order: options.nextOrder + index,
            }),
          ),
        ),
        { concurrency: "unbounded" },
      );
    });

    const saveImportedImages = Effect.fn("saveImportedImages")(function* (importedImages: ImportedImage[]) {
      if (importedImages.length === 0) {
        return;
      }

      yield* Effect.tryPromise({
        try: () =>
          database.transaction("rw", database.projects, database.images, database.originalImages, async () => {
            await database.images.bulkAdd(importedImages.map((importedImage) => importedImage.image));
            await database.originalImages.bulkAdd(importedImages.map((importedImage) => importedImage.originalImage));
          }),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    const addImages = Effect.fn("addImages")(function* (options: AddImagesOptions) {
      const importedImages = yield* importImages({
        files: Array.from(options.files),
        projectId: options.projectId,
        nextOrder: getNextOrder(options.currentImages),
      });

      yield* saveImportedImages(importedImages);
    });

    return { addImages };
  }),
}) {
  static readonly layer = Layer.effect(ImageImportService, ImageImportService.make).pipe(
    Layer.provide(MemoryEstimationService.layer),
  );
}
