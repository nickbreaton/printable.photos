// window.indexedDB.databases().then(dbs => dbs.forEach(db => { window.indexedDB.deleteDatabase(db.name) }))

import { openDB, IDBPDatabase, DBSchema } from "idb";

interface Schema extends DBSchema {
  images: {
    value: {
      id: string;
      // projectId: string;
      blob: Blob;
    };
    key: string;
  };
}

class ConnectionSubscriber {
  subscriptions = new Set<() => void>();

  subscribe = (subscription: () => void) => {
    this.subscriptions.add(subscription);
    return () => this.subscriptions.delete(subscription);
  };

  notify = () => {
    this.subscriptions.forEach((subscription) => subscription());
  };
}

export async function getConnection(): Promise<{ db: IDBPDatabase<Schema>; subscriber: ConnectionSubscriber }> {
  (window as any).__connection ??= await openDB<Schema>("projects", 1, {
    upgrade(db) {
      db.createObjectStore("images", { keyPath: "id" });
    },
  })

  (window as any).__connectionSubscriber ??= new ConnectionSubscriber();

  return { db: (window as any).__connection, subscriber: (window as any).__connectionSubscriber };
}
