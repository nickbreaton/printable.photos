import { Context, Effect, Layer } from "effect";

import type { CropCoordinates, ProjectImage } from "../data";
import { DatabaseWriteError, type ImportedImage } from "../schema";
import { DatabaseService } from "../services/DatabaseService";

export class ImageRepository extends Context.Service<ImageRepository>()("ImageRepository", {
  make: Effect.gen(function* () {
    const { database } = yield* DatabaseService;

    const listByProject = Effect.fn("ImageRepository.listByProject")(function* (projectId: string) {
      const images = yield* Effect.promise(() => database.images.where("projectId").equals(projectId).sortBy("order"));
      const projectImages = yield* Effect.promise(() =>
        Promise.all(
          images.map(async (image): Promise<ProjectImage | undefined> => {
            const originalImage = image.optimizedBlob ? undefined : await database.originalImages.get(image.id);
            const blob = image.optimizedBlob ?? originalImage?.blob;

            return blob ? { ...image, blob } : undefined;
          }),
        ),
      );

      return projectImages.filter((image): image is ProjectImage => Boolean(image));
    });

    const addImportedImages = Effect.fn("ImageRepository.addImportedImages")(function* (
      importedImages: readonly ImportedImage[],
    ) {
      yield* Effect.tryPromise({
        try: () =>
          database.transaction("rw", database.projects, database.images, database.originalImages, async () => {
            await database.images.bulkAdd(importedImages.map((importedImage) => importedImage.image));
            await database.originalImages.bulkAdd(importedImages.map((importedImage) => importedImage.originalImage));
          }),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    const getOriginalImage = Effect.fn("ImageRepository.getOriginalImage")(function* (imageId: string) {
      return yield* Effect.promise(() => database.originalImages.get(imageId));
    });

    const deleteImage = Effect.fn("ImageRepository.deleteImage")(function* (imageId: string) {
      yield* Effect.tryPromise({
        try: () =>
          database.transaction("rw", database.projects, database.images, database.originalImages, async () => {
            await database.images.delete(imageId);
          }),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    const saveCrop = Effect.fn("ImageRepository.saveCrop")(function* (
      imageId: string,
      cropKey: string,
      cropCoordinates: CropCoordinates,
    ) {
      yield* Effect.tryPromise({
        try: () =>
          database.transaction("rw", database.projects, database.images, async () => {
            const image = await database.images.get(imageId);

            if (!image) {
              return;
            }

            await database.images.update(imageId, {
              crops: {
                ...image.crops,
                [cropKey]: cropCoordinates,
              },
            });
          }),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    return { addImportedImages, deleteImage, getOriginalImage, listByProject, saveCrop };
  }),
}) {
  static readonly layer = Layer.effect(ImageRepository, ImageRepository.make).pipe(Layer.provide(DatabaseService.layer));
}
