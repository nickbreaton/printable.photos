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

export const PAPER_PRESETS = {
  Photos: [
    { label: "4x6", value: "4x6", width: 4, height: 6 },
    { label: "5x7", value: "5x7", width: 5, height: 7 },
    { label: "8x10", value: "8x10", width: 8, height: 10 },
  ],
  Paper: [
    { label: "Letter", value: "Letter", width: 8.5, height: 11 },
    { label: "Legal", value: "Legal", width: 8.5, height: 14 },
    { label: "Tabloid", value: "Tabloid", width: 11, height: 17 },
  ],
} as const;

export const ALL_PAPER_PRESETS = Object.values(PAPER_PRESETS).flat();

export function getSelectedPaperPreset(paper: Pick<PaperSettings, "width" | "height">) {
  const matchingPreset = ALL_PAPER_PRESETS.find((preset) => {
    return preset.width === paper.width && preset.height === paper.height;
  });

  return matchingPreset?.value ?? "Custom";
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
