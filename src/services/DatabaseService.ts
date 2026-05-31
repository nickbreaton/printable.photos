import Dexie, { type EntityTable, type Transaction } from "dexie";
import { Context, Effect, Layer } from "effect";

import { createDefaultProject, type OriginalProjectImage, type Project, type StoredProjectImage } from "../data";
import { applyMigrations } from "../migrations";

export class PrintablePhotosDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  images!: EntityTable<StoredProjectImage, "id">;
  originalImages!: EntityTable<OriginalProjectImage, "imageId">;

  constructor() {
    super("printablePhotos");

    applyMigrations(this);

    this.on("populate", (transaction) => {
      void transaction.table("projects").add(createDefaultProject());
    });

    this.projects.hook("creating", (_primaryKey, project) => {
      project.updatedAt = Date.now();
    });

    this.projects.hook("updating", () => {
      return { updatedAt: Date.now() };
    });

    this.projects.hook("deleting", async (primaryKey, _project, transaction) => {
      const images = await transaction.table("images").where("projectId").equals(primaryKey).toArray();
      const imageIds = images.map((image) => image.id);

      await transaction.table("originalImages").bulkDelete(imageIds);
      await transaction.table("images").where("projectId").equals(primaryKey).delete();
    });

    const touchProject = (projectId: string, transaction: Transaction) => {
      return transaction.table("projects").update(projectId, {
        updatedAt: Date.now(),
      });
    };

    this.images.hook("creating", (_primaryKey, image, transaction) => {
      image.crops ??= {};
      image.updatedAt = Date.now();
      void touchProject(image.projectId, transaction);
    });

    this.images.hook("updating", (_mods, _primaryKey, image, transaction) => {
      void touchProject(image.projectId, transaction);
      return { updatedAt: Date.now() };
    });

    this.images.hook("deleting", async (primaryKey, image, transaction) => {
      await transaction.table("originalImages").delete(primaryKey);
      await touchProject(image.projectId, transaction);
    });
  }
}

export class DatabaseService extends Context.Service<DatabaseService>()("DatabaseService", {
  make: Effect.acquireRelease(
    Effect.sync(() => ({ database: new PrintablePhotosDatabase() })),
    ({ database }) => Effect.sync(() => database.close()),
  ),
}) {
  static readonly layer = Layer.effect(DatabaseService, DatabaseService.make);
}
