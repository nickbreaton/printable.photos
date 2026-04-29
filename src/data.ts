import Dexie, { type EntityTable } from "dexie";

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
  images: ProjectImage[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectImage {
  id: string;
  order: number;
  name: string;
  type: string;
  width: number;
  height: number;
  blob: Blob;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectData {
  project: Project;
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
    images: [],
    createdAt: now,
    updatedAt: now,
  };
}

class PrintablePhotosDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;

  constructor() {
    super("printablePhotos");

    this.version(1).stores({
      projects: "id, createdAt, updatedAt",
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
  }
}

export const db = new PrintablePhotosDatabase();
