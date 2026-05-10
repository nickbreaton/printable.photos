import {
  action,
  createMemo,
  createProjection,
  mapArray,
  merge,
  onCleanup,
  refresh,
  snapshot,
} from "solid-js";
import { MaxRectsPacker } from "maxrects-packer";

import {
  db,
  type CropCoordinates,
  type ImageSettings,
  type PaperSettings,
  type Project,
  type ProjectImage,
} from "./data";
import type { PackedImageBin } from "./layout";
import { createPreviewBlob } from "./utils";

const PREVIEW_DPI = 160;
const MAX_PREVIEW_EDGE_PX = 1600;

export const project = createProjection((): Promise<Project> => {
  return db.table("projects").get("DEFAULT");
}, {} as Project);

export const paper = createMemo(() => {
  return project.settings.paper;
});

export const setPaper = action(function* (newPaper: Partial<PaperSettings>) {
  const nestedUpdateEntries = Object.entries(newPaper).map(([key, value]) => [
    `settings.paper.${key}`,
    value,
  ]);
  const promisish = db.table("projects").update("DEFAULT", Object.fromEntries(nestedUpdateEntries));
  yield Promise.resolve(promisish);
  refresh(project);
});

export const imageConfig = createMemo(() => {
  return project.settings.image;
});

export const setImageConfig = action(function* (newImageConfig: Partial<ImageSettings>) {
  const nestedUpdateEntries = Object.entries(newImageConfig).map(([key, value]) => [
    `settings.image.${key}`,
    value,
  ]);
  const promisish = db.table("projects").update("DEFAULT", Object.fromEntries(nestedUpdateEntries));
  yield Promise.resolve(promisish);
  refresh(project);
});

interface ImageRef extends ProjectImage {
  url: string;
}

export const projectImages = createProjection(async (): Promise<ProjectImage[]> => {
  if (!project.id) {
    return [];
  }

  return db.images.where("projectId").equals(project.id).sortBy("order");
}, []);

export const images = mapArray(
  () => projectImages,
  (image): ImageRef => {
    const blob = snapshot(image().previewBlob ?? image().blob);
    const blobUrl = URL.createObjectURL(blob);

    onCleanup(() => URL.revokeObjectURL(blobUrl));

    return merge(image, { url: blobUrl });
  },
  { keyed: (image) => image.id },
);

export const addImages = action(function* (files: FileList) {
  const nextImages: ProjectImage[] = [];
  const currentProjectId = snapshot(project.id);
  const currentImages = snapshot(projectImages);
  const nextOrder =
    currentImages.reduce((maxOrder: number, image: ProjectImage) => {
      return Math.max(maxOrder, image.order);
    }, -1) + 1;
  const paperMaxInches =
    paper().units === "mm"
      ? Math.max(paper().width, paper().height) / 25.4
      : Math.max(paper().width, paper().height);
  const maxPreviewEdgePx = Math.min(MAX_PREVIEW_EDGE_PX, Math.ceil(paperMaxInches * PREVIEW_DPI));

  for (const file of files) {
    const bitmap = yield createImageBitmap(snapshot(file));
    try {
      const previewBlob = yield createPreviewBlob(file, bitmap, maxPreviewEdgePx);
      const now = Date.now();

      nextImages.push({
        id: crypto.randomUUID(),
        projectId: currentProjectId,
        order: nextOrder + nextImages.length,
        name: file.name,
        type: file.type,
        width: bitmap.width,
        height: bitmap.height,
        blob: file,
        previewBlob,
        crops: {},
        createdAt: now,
        updatedAt: now,
      });
    } finally {
      bitmap.close();
    }
  }

  if (nextImages.length === 0) {
    return;
  }

  const promisish = db.transaction("rw", db.projects, db.images, async () => {
    await db.images.bulkAdd(nextImages);
  });
  yield Promise.resolve(promisish);
  refresh(projectImages);
  refresh(project);
});

export const deleteImage = action(function* (imageId: string) {
  const promisish = db.transaction("rw", db.projects, db.images, async () => {
    await db.images.delete(imageId);
  });
  yield Promise.resolve(promisish);
  refresh(projectImages);
  refresh(project);
});

export const saveImageCrop = action(function* (
  imageId: string,
  cropKey: string,
  cropCoordinates: CropCoordinates,
) {
  const promisish = db.transaction("rw", db.projects, db.images, async () => {
    const image = await db.images.get(imageId);

    if (!image) {
      return;
    }

    await db.images.update(imageId, {
      crops: {
        ...image.crops,
        [cropKey]: cropCoordinates,
      },
    });
  });
  yield Promise.resolve(promisish);
  refresh(projectImages);
});

function packImages(imageList: ImageRef[], allowRotation: boolean): PackedImageBin[] {
  const packer = new MaxRectsPacker(paper().width, paper().height, paper().gap, {
    border: paper().margin,
    pot: false,
    square: false,
    allowRotation,
  });

  for (const image of imageList) {
    const aspectRatio = image.height / image.width;
    // The selected Image shape controls the packed rect's aspect ratio, which
    // is later used as the crop persistence key.
    const height =
      imageConfig().shape === "square" ? imageConfig().width : imageConfig().width * aspectRatio;
    packer.add(imageConfig().width, height, { id: image.id });
  }

  return packer.bins as PackedImageBin[];
}

export const bins = createProjection(() => {
  const imageList = images();
  const unrotatedBins = packImages(imageList, false);

  if (!paper().allowRotation) {
    return unrotatedBins;
  }

  const rotatedBins = packImages(imageList, true);

  if (rotatedBins.length < unrotatedBins.length) {
    return rotatedBins;
  }

  return unrotatedBins;
}, []);
