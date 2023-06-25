import Dexie from "dexie";
import { Image } from "~/database/sources/image";
import { Photo } from "~/database/sources/photo";

class Database extends Dexie {
  photos!: Dexie.Table<Photo, Photo["id"]>;
  images!: Dexie.Table<Image, Image["id"]>;

  constructor() {
    super("Database3");

    this.version(1).stores({
      photos: "id,name,aspectRatio,width,unit,createdAt",
      images: "id,photoId,type,devicePixelRatio,[photoId+type]",
    });

    this.photos.hook("deleting", async (id, _, trans) => {
      trans.on("complete", () => db.images.where("photoId").equals(id).delete());
    });
  }
}

export const db = new Database();
