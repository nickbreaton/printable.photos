import memoize from "just-memoize";
import { DBSchema, openDB } from "idb";
import { Photo } from "./sources/photo";
import { Image } from "./sources/image";

interface Schema extends DBSchema {
  photo: {
    value: Photo;
    key: Photo["id"];
  };
  image: {
    value: Image;
    key: Image["id"];
    indexes: { photoId: Image["photoId"] };
  };
}

export const getDatabaseConnection = memoize(() => {
  return openDB<Schema>("projects8", 1, {
    upgrade(db) {
      db.createObjectStore("photo", { keyPath: "id" });

      const imageStore = db.createObjectStore("image", { keyPath: "id" });
      imageStore.createIndex("photoId", "photoId");
    },
  });
});
