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
import { Effect } from "effect";
import { MaxRectsPacker } from "maxrects-packer";

import {
  database,
  DEFAULT_PROJECT_SETTINGS,
  type CropCoordinates,
  type ImageSettings,
  type PaperSettings,
  type Project,
  type ProjectImage,
} from "./data";
import type { PackedImageBin } from "./layout";
import { ImageImportService } from "./services/ImageImportService";

export const projects = createProjection((): Promise<Project[]> => {
  return Promise.resolve(database.table("projects").toArray());
}, []);

export const projectId = createMemo(() => {
  let selectedProject = projects[0];

  for (const candidateProject of projects) {
    if (!selectedProject || candidateProject.lastSelectedAt > selectedProject.lastSelectedAt) {
      selectedProject = candidateProject;
    }
  }

  return selectedProject?.id ?? "DEFAULT";
});

export const selectProject = action(function* (id: string) {
  const promisish = database.projects.update(id, {
    lastSelectedAt: Date.now(),
  });
  yield Promise.resolve(promisish);
  refresh(projects);
});

export const createProject = action(function* (name: string) {
  const id = crypto.randomUUID();
  const timestamp = Date.now();

  const promisish = database.projects.add({
    id,
    name,
    settings: structuredClone(DEFAULT_PROJECT_SETTINGS),
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSelectedAt: timestamp,
  });
  yield Promise.resolve(promisish);

  refresh(projects);
});

export const renameProject = action(function* (id: string, name: string) {
  const promisish = database.projects.update(id, { name });
  yield Promise.resolve(promisish);
  refresh(projects);
});

export const deleteProject = action(function* (id: string) {
  const promisish = database.projects.delete(id);
  yield Promise.resolve(promisish);
  refresh(projectImages);
  refresh(projects);
});

export const project = createMemo(() => {
  return projects.find((project) => project.id === projectId())!;
});

export const paper = createMemo(() => {
  return project().settings.paper;
});

export const setPaper = action(function* (newPaper: Partial<PaperSettings>) {
  const nestedUpdateEntries = Object.entries(newPaper).map(([key, value]) => [
    `settings.paper.${key}`,
    value,
  ]);
  const promisish = database
    .table("projects")
    .update(projectId(), Object.fromEntries(nestedUpdateEntries));
  yield Promise.resolve(promisish);
  refresh(projects);
});

export const imageConfig = createMemo(() => {
  return project().settings.image;
});

export const setImageConfig = action(function* (newImageConfig: Partial<ImageSettings>) {
  const nestedUpdateEntries = Object.entries(newImageConfig).map(([key, value]) => [
    `settings.image.${key}`,
    value,
  ]);
  const promisish = database
    .table("projects")
    .update(projectId(), Object.fromEntries(nestedUpdateEntries));
  yield Promise.resolve(promisish);
  refresh(projects);
});

interface ImageRef extends ProjectImage {
  objectUrl: string;
}

export const projectImages = createProjection(async (): Promise<ProjectImage[]> => {
  if (!project().id) {
    return [];
  }

  const images = await database.images.where("projectId").equals(project().id).sortBy("order");
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

export const addImages = action(function* (files: FileList) {
  yield Effect.runPromise(
    ImageImportService.use((service) =>
      service.addImages({
        files,
        projectId: snapshot(project().id),
        currentImages: snapshot(projectImages),
      }),
    ).pipe(
      Effect.provide(ImageImportService.layer),
    ),
  );
  refresh(projectImages);
  refresh(projects);
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
  refresh(projects);
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
