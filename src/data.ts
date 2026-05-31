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
  lastSelectedAt: number;
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
    allowRotation: true,
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
    lastSelectedAt: timestamp,
  };
}
