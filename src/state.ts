import {
  action,
  createMemo,
  createProjection,
  createSignal,
  mapArray,
  merge,
  onCleanup,
  refresh,
  snapshot,
} from "solid-js";
import { MaxRectsPacker } from "maxrects-packer";

import {
  database,
  type CropCoordinates,
  type ImageSettings,
  type PaperSettings,
  type Project,
  type ProjectImage,
  type OriginalProjectImage,
  type StoredProjectImage,
} from "./data";
import type { PackedImageBin } from "./layout";
import { createImportImageBlobs } from "./imageResize";

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export const projects = createProjection((): Promise<Project[]> => {
  return Promise.resolve(database.table("projects").toArray());
}, []);

export const [projectId, setProjectId] = createSignal("DEFAULT");

export const project = createProjection((): Promise<Project> => {
  return database.table("projects").get(projectId());
}, {} as Project);

export const paper = createMemo(() => {
  return project.settings.paper;
});

export const setPaper = action(function* (newPaper: Partial<PaperSettings>) {
  const nestedUpdateEntries = Object.entries(newPaper).map(([key, value]) => [
    `settings.paper.${key}`,
    value,
  ]);
  const promisish = database
    .table("projects")
    .update("DEFAULT", Object.fromEntries(nestedUpdateEntries));
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
  const promisish = database
    .table("projects")
    .update("DEFAULT", Object.fromEntries(nestedUpdateEntries));
  yield Promise.resolve(promisish);
  refresh(project);
});

interface ImageRef extends ProjectImage {
  objectUrl: string;
}

export const projectImages = createProjection(async (): Promise<ProjectImage[]> => {
  if (!project.id) {
    return [];
  }

  const images = await database.images.where("projectId").equals(project.id).sortBy("order");
  const projectImages = await Promise.all(
    images.map(async (image): Promise<ProjectImage | undefined> => {
      const originalImage = image.optimizedBlob
        ? undefined
        : await database.originalImages.get(image.id);

      const blob = image.optimizedBlob ?? originalImage?.blob;

      return blob ? merge(image, { blob }) : undefined;
    }),
  );

  return projectImages.filter((image): image is ProjectImage => Boolean(image));
}, []);

export const images = mapArray(
  () => projectImages,
  (image): ImageRef => {
    const blob = snapshot(image().blob);
    const objectUrl = URL.createObjectURL(blob);

    onCleanup(() => URL.revokeObjectURL(objectUrl));

    return merge(image, { objectUrl: objectUrl });
  },
  { keyed: (image) => image.id },
);

function createByteLimiter(maxBytes: number) {
  let activeBytes = 0;
  const queue: Array<{
    bytes: number;
    run: () => void;
  }> = [];

  function flushQueue() {
    const next = queue[0];

    if (!next || (activeBytes > 0 && activeBytes + next.bytes > maxBytes)) {
      return;
    }

    queue.shift();
    activeBytes += next.bytes;
    next.run();
    flushQueue();
  }

  return async function limitByBytes<T>(bytes: number, task: () => Promise<T>): Promise<T> {
    const reservedBytes = Math.min(bytes, maxBytes);

    await new Promise<void>((resolve) => {
      queue.push({ bytes: reservedBytes, run: resolve });
      flushQueue();
    });

    try {
      return await task();
    } finally {
      activeBytes -= reservedBytes;
      flushQueue();
    }
  };
}

interface ImportedImage {
  image: StoredProjectImage;
  originalImage: OriginalProjectImage;
}

async function createProjectImageFromFile(options: {
  file: File;
  projectId: string;
  order: number;
}): Promise<ImportedImage> {
  const bitmap = await createImageBitmap(snapshot(options.file));

  try {
    const imageBlobs = await createImportImageBlobs({
      blob: options.file,
      bitmap,
    });
    const timestamp = Date.now();
    const imageId = crypto.randomUUID();

    return {
      image: {
        id: imageId,
        projectId: options.projectId,
        order: options.order,
        name: options.file.name,
        type: options.file.type,
        width: imageBlobs.optimizedDimensions.width,
        height: imageBlobs.optimizedDimensions.height,
        optimizedBlob: imageBlobs.optimizedBlob,
        crops: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      originalImage: { imageId, blob: options.file },
    };
  } finally {
    bitmap.close();
  }
}

export const addImages = action(function* (files: FileList) {
  const currentProjectId = snapshot(project.id);
  const currentImages = snapshot(projectImages);
  const nextOrder =
    currentImages.reduce((maxOrder: number, image: ProjectImage) => {
      return Math.max(maxOrder, image.order);
    }, -1) + 1;
  const limitByBytes = createByteLimiter(MAX_IMPORT_BYTES);
  const importedImages = (yield Promise.all(
    Array.from(files, (file, index) =>
      limitByBytes(file.size, () =>
        createProjectImageFromFile({
          file,
          projectId: currentProjectId,
          order: nextOrder + index,
        }),
      ),
    ),
  )) as ImportedImage[];

  if (importedImages.length === 0) {
    return;
  }

  const promisish = database.transaction(
    "rw",
    database.projects,
    database.images,
    database.originalImages,
    async () => {
      await database.images.bulkAdd(importedImages.map((importedImage) => importedImage.image));
      await database.originalImages.bulkAdd(
        importedImages.map((importedImage) => importedImage.originalImage),
      );
    },
  );
  yield Promise.resolve(promisish);
  refresh(projectImages);
  refresh(project);
});

export const deleteImage = action(function* (imageId: string) {
  const promisish = database.transaction(
    "rw",
    database.projects,
    database.images,
    database.originalImages,
    async () => {
      await database.images.delete(imageId);
    },
  );
  yield Promise.resolve(promisish);
  refresh(projectImages);
  refresh(project);
});

export const saveImageCrop = action(function* (
  imageId: string,
  cropKey: string,
  cropCoordinates: CropCoordinates,
) {
  const promisish = database.transaction("rw", database.projects, database.images, async () => {
    const image = await database.images.get(imageId);

    if (!image) {
      return;
    }

    await database.images.update(imageId, {
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
    smart: false, // size can expand beyond paper bounds if `true` ¯\_(ツ)_/¯
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
