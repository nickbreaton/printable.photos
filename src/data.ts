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

export interface ProjectImage {
  id: string;
  projectId: string;
  order: number;
  name: string;
  type: string;
  width: number;
  height: number;
  blob: Blob;
  previewBlob?: Blob;
  createdAt: number;
  updatedAt: number;
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
  const now = Date.now();

  return {
    id: "DEFAULT",
    name: "Untitled project",
    settings: structuredClone(DEFAULT_PROJECT_SETTINGS),
    createdAt: now,
    updatedAt: now,
  };
}

class PrintablePhotosDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  images!: EntityTable<ProjectImage, "id">;

  constructor() {
    super("printablePhotos");

    this.version(1).stores({
      projects: "id",
      images: "id, projectId, [projectId+order]",
    });

    this.on("populate", (transaction) => {
      transaction.table("projects").add(createDefaultProject());
    });

    this.projects.hook("creating", (_primaryKey, project) => {
      project.updatedAt = Date.now();
    });

    this.projects.hook("updating", () => {
      return { updatedAt: Date.now() };
    });

    this.projects.hook("deleting", (primaryKey, _project, transaction) => {
      return transaction
        .table("images")
        .where("projectId")
        .equals(primaryKey)
        .delete();
    });

    const touchProject = (projectId: string, transaction: Transaction) => {
      return transaction.table("projects").update(projectId, {
        updatedAt: Date.now(),
      });
    };

    this.images.hook("creating", (_primaryKey, image, transaction) => {
      image.updatedAt = Date.now();
      touchProject(image.projectId, transaction);
    });

    this.images.hook("updating", (_mods, _primaryKey, image, transaction) => {
      touchProject(image.projectId, transaction);
      return { updatedAt: Date.now() };
    });

    this.images.hook("deleting", (_primaryKey, image, transaction) => {
      return touchProject(image.projectId, transaction);
    });
  }
}

export const db = new PrintablePhotosDatabase();
