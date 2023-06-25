import Dexie from "dexie";
import { Image } from "~/database/tables/image";
import { Photo } from "~/database/tables/photo";
import { Project } from "./tables/project";

class Database extends Dexie {
  photos!: Dexie.Table<Photo, Photo["id"]>;
  images!: Dexie.Table<Image, Image["id"]>;
  projects!: Dexie.Table<Project, Project["id"]>;

  constructor() {
    super("Database6");

    this.version(2).stores({
      projects: "id",
      photos: "id,projectId,name,aspectRatio,width,unit,createdAt",
      images: "id,photoId,type,devicePixelRatio,[photoId+type]",
    });

    this.photos.hook("deleting", async (id, _, tx) => {
      tx.on("complete", () => db.images.where("photoId").equals(id).delete());
    });
  }
}

export const db = new Database();
