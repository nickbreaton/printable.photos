import { getDatabaseConnection } from "../database";
import { createDataSource } from "../datasource";
import { getEmitter } from "../emitter";

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
      emitter.on("add-photo", async () => {
        // TODO: optimize
        next(await fetch());
      })
    );
  });
};

export const addPhoto = async (photo: Photo) => {
  const db = await getDatabaseConnection();
  const emitter = getEmitter();
  const t = db.transaction("photo", "readwrite");
  await Promise.all([t.store.add(photo), t.done]);
  emitter.emit({ type: "add-photo", id: photo.id });
};
