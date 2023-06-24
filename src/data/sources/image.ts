import { getDatabaseConnection } from "../database";
import { createDataSource } from "../datasource";
import { PhotoId } from "./photo";

export type ImageId = `image-${string}`;

export type Image = { id: ImageId; photoId: PhotoId; blob: Blob } & (
  | { type: "source" }
  | { type: "scaled"; devicePixelRatio: number }
);

export const addImage = async (image: Image) => {
  const db = await getDatabaseConnection();
  // const emitter = getEmitter();
  const t = db.transaction("image", "readwrite");
  await Promise.all([t.store.add(image), t.done]);
  // emitter.emit({ type: "add-photo", id: photo.id });
};

export const deleteImage = async (imageId: ImageId) => {
  const db = await getDatabaseConnection();
  // const emitter = getEmitter();
  const t = db.transaction("image", "readwrite");
  await Promise.all([t.store.delete(imageId), t.done]);
  // emitter.emit({ type: "add-photo", id: photo.id });
};

export const getImagesSource = (photoId: PhotoId) => {
  return createDataSource<Image[]>(async ({ next }) => {
    const db = await getDatabaseConnection();
    const fetch = () => {
      return db.transaction("image", "readwrite").store.index("photoId").getAll(IDBKeyRange.only(photoId));
    };
    next(await fetch());
  });
};

export const getSourceImageSource = (photoId: PhotoId) => {
  return createDataSource<Image>(async ({ next }) => {
    const db = await getDatabaseConnection();
    const fetch = async () => {
      const cursor = await db
        .transaction("image", "readwrite")
        .store.index("photoId")
        .openCursor(IDBKeyRange.only(photoId));

      // TODO filter down to type = 'source'

      return cursor!.value;
    };

    next(await fetch());
  });
};
