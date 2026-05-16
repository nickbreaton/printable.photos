import Dexie, { type EntityTable } from "dexie";
import type { Transaction } from "dexie";

export interface PaperSettings {
  width: number;
  height: number;
  margin: number;
  gap: number;
  units: "in" | "mm";
  allowRotation: boolean;
}

export type ImageShape = "original" | "square";

export interface ImageSettings {
  width: number;
  shape: ImageShape;
}

export interface ProjectSettings {
  paper: PaperSettings;
  image: ImageSettings;
}

export interface Project {
  id: string;
  name: string;
  settings: ProjectSettings;
  createdAt: number;
  updatedAt: number;
}

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StoredProjectImage {
  id: string;
  projectId: string;
  order: number;
  name: string;
  type: string;
  width: number;
  height: number;
  optimizedBlob?: Blob;
  crops: Record<string, CropCoordinates>;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectImage extends StoredProjectImage {
  blob: Blob;
}

export interface OriginalProjectImage {
  imageId: string;
  blob: Blob;
}

export interface ProjectData {
  project: Project;
  images: ProjectImage[];
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  paper: {
    width: 8.5,
    height: 11,
    margin: 0.25,
    gap: 0.25,
    units: "in",
    allowRotation: false,
  },
  image: {
    width: 3,
    shape: "original",
  },
};

export function createDefaultProject(): Project {
  const timestamp = Date.now();

  return {
    id: "DEFAULT",
    name: "Untitled project",
    settings: structuredClone(DEFAULT_PROJECT_SETTINGS),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

class PrintablePhotosDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  images!: EntityTable<StoredProjectImage, "id">;
  originalImages!: EntityTable<OriginalProjectImage, "imageId">;

  constructor() {
    super("printablePhotos");

    this.version(1).stores({
      projects: "id",
      images: "id, projectId, [projectId+order]",
      originalImages: "imageId",
    });

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

export const database = new PrintablePhotosDatabase();
