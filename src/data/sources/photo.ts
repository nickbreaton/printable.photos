import { getDatabaseConnection } from "../database";
import { createDataSource } from "../datasource";
import { getEmitter } from "../emitter";
import { deleteImage, getImagesSource, getSourceImageSource } from "./image";

export type PhotoId = `photo-${string}`;

export interface Photo {
  id: PhotoId;
  // projectId: ProjectId
  name: string;
  aspectRatio: number;
  width: number;
  unit: "inches";
  createdAt: Date;
}

export const getPhotosSource = (/* TODO: projectId */) => {
  return createDataSource<Photo[]>(async ({ next, cleanup }) => {
    const db = await getDatabaseConnection();
    const fetch = () => db.transaction("photo", "readwrite").store.getAll();

    next(await fetch());

    const emitter = getEmitter();

    cleanup(
      emitter.on("change-photos", async () => {
        // TODO: optimize
        next(await fetch());
      })
    );
  });
};

export const putPhoto = async (photo: Photo) => {
  const db = await getDatabaseConnection();
  const emitter = getEmitter();
  const t = db.transaction("photo", "readwrite");
  await Promise.all([t.store.put(photo), t.done]);
  emitter.emit({ type: "change-photos" });
};

export const deletePhoto = async (photoId: PhotoId) => {
  const db = await getDatabaseConnection();
  const emitter = getEmitter();
  const t = db.transaction(["photo", "image"], "readwrite");
  await Promise.all([
    t.objectStore("photo").delete(photoId),
    new Promise<void>((resolve) => {
      const unsub = getImagesSource(photoId).subscribe(async (images) => {
        unsub();
        await Promise.all(images.map((image) => deleteImage(image.id)));
        resolve();
      });
    }),
  ]);
  await t.done;
  emitter.emit({ type: "change-photos" });
};
