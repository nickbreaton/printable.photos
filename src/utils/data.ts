// window.indexedDB.databases().then(dbs => dbs.forEach(db => { window.indexedDB.deleteDatabase(db.name) }))

import { openDB, DBSchema } from "idb";
import memoize from "just-memoize";
// import { readable } from 'svelte/store'

// type ProjectId = `project-${string}`

// interface Project {
//   id: ProjectId;
//   name: string;
// }

type PhotoId = `photo-${string}`;

export interface Photo {
  id: PhotoId;
  // projectId: ProjectId
  name: string;
  aspectRatio: number;
  width: number;
  unit: "inches";
  blob: Blob;
}

interface Schema extends DBSchema {
  photo: {
    value: Photo;
    key: Photo["id"];
  };
}

const getDatabaseConnection = memoize(() => {
  return openDB<Schema>("projects3", 1, {
    upgrade(db) {
      db.createObjectStore("photo", { keyPath: "id" });
    },
  });
});

function createEventEmitter<T extends { type: string }>() {
  const el = document.createElement("div");
  return {
    emit: (data: T) => el.dispatchEvent(new CustomEvent(`emitter:${data.type}`, { detail: data })),
    on<E extends T>(type: E["type"], callback: (data: E) => void) {
      el.addEventListener(`emitter:${type}` as any, callback);
      return () => el.removeEventListener(`emitter:${type}` as any, callback);
    },
  };
}

const getEmitter = memoize(() =>
  createEventEmitter<{ type: "add-photo"; id: PhotoId } | { type: "delete-photo"; id: PhotoId }>()
);

export interface DataSource<T> {
  subscribe(callback: (next: T) => void): () => void;
}

function createDataSource<T>(
  callback: ({ next, cleanup }: { next: (value: T) => void; cleanup: (action: () => void) => void }) => void
): DataSource<T> {
  const subscribers = new Set<(next: T) => void>();
  const cleanups = new Set<() => void>();

  callback({
    next: (v) => {
      subscribers.forEach((subscriber) => subscriber(v));
    },
    cleanup: (callback) => {
      cleanups.add(callback);
    },
  });

  return {
    subscribe: (subscriber) => {
      subscribers.add(subscriber);

      return () => {
        subscribers.delete(subscriber);
        if (subscribers.size === 0) {
          cleanups.forEach((cleanup) => cleanup());
        }
      };
    },
  };
}

export const photosSource = createDataSource<Photo[]>(async ({ next, cleanup }) => {
  const db = await getDatabaseConnection();
  const fetch = () => db.getAll("photo");

  next(await fetch());

  const emitter = getEmitter();

  cleanup(
    emitter.on("add-photo", async () => {
      // TODO: optimize
      next(await fetch());
    })
  );
});

export const addPhoto = async (photo: Photo) => {
  const db = await getDatabaseConnection();
  const emitter = getEmitter();
  const t = db.transaction("photo", "readwrite");
  await Promise.all([t.store.add(photo), t.done]);
  emitter.emit({ type: "add-photo", id: photo.id });
};
