import { Context, Effect, Layer, Schema, Semaphore } from "effect";

import { database, type OriginalProjectImage, type StoredProjectImage } from "../data";
import { createImportImageBlobs } from "../imageResize";

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

interface ImportedImage {
  image: StoredProjectImage;
  originalImage: OriginalProjectImage;
}

class ImageImportError extends Schema.TaggedErrorClass<ImageImportError>()("ImageImportError", {
  fileName: Schema.String,
  cause: Schema.Defect,
}) {}

class DatabaseWriteError extends Schema.TaggedErrorClass<DatabaseWriteError>()("DatabaseWriteError", {
  cause: Schema.Defect,
}) {}

const StoredProjectImageSchema = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  order: Schema.Number,
  name: Schema.String,
  type: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
  optimizedBlob: Schema.optionalKey(Schema.instanceOf(Blob)),
  crops: Schema.Record(Schema.String, Schema.Unknown),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});

const OriginalProjectImageSchema = Schema.Struct({
  imageId: Schema.String,
  blob: Schema.instanceOf(Blob),
});

const ImportedImageSchema = Schema.Struct({
  image: StoredProjectImageSchema,
  originalImage: OriginalProjectImageSchema,
});

const importImage = Effect.fn("importImage")(function* (options: { file: File; projectId: string; order: number }) {
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
  const timestamp = yield* Effect.sync(() => Date.now());
  const imageId = yield* Effect.sync(() => crypto.randomUUID());

  return yield* Schema.decodeUnknownEffect(ImportedImageSchema)({
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

const importImages = Effect.fn("importImages")(function* (options: { files: File[]; projectId: string; nextOrder: number }) {
  const byteSemaphore = yield* Semaphore.make(MAX_IMPORT_BYTES);

  return yield* Effect.all(
    options.files.map((file, index) =>
      byteSemaphore.withPermits(Math.min(file.size, MAX_IMPORT_BYTES))(
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

function getNextOrder(images: readonly { order: number }[]) {
  return images.reduce((maxOrder, image) => Math.max(maxOrder, image.order), -1) + 1;
}

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

const addImages = Effect.fn("ImageImportService.addImages")(function* (options: AddImagesOptions) {
  const importedImages = yield* importImages({
    files: Array.from(options.files),
    projectId: options.projectId,
    nextOrder: getNextOrder(options.currentImages),
  });

  yield* saveImportedImages(importedImages);
});

interface AddImagesOptions {
  files: FileList;
  projectId: string;
  currentImages: readonly { order: number }[];
}

export class ImageImportService extends Context.Service<
  ImageImportService,
  {
    addImages(options: AddImagesOptions): ReturnType<typeof addImages>;
  }
>()("printablePhotos/services/ImageImportService") {
  static readonly layer = Layer.succeed(
    ImageImportService,
    ImageImportService.of({
      addImages,
    }),
  );
}
