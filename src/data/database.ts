import memoize from "just-memoize";
import { DBSchema, openDB } from "idb";
import { Photo } from "./sources/photo";

interface Schema extends DBSchema {
  photo: {
    value: Photo;
    key: Photo["id"];
  };
}

export const getDatabaseConnection = memoize(() => {
  return openDB<Schema>("projects3", 1, {
    upgrade(db) {
      db.createObjectStore("photo", { keyPath: "id" });
    },
  });
});
