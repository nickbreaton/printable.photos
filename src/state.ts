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
  type CropCoordinates,
  type ImageSettings,
  type PaperSettings,
  type Project,
  type ProjectImage,
  type StoredProjectImage,
} from "./data";
import type { PackedImageBin } from "./layout";
import { runtime } from "./runtime";
import { ImageImportService } from "./services/ImageImportService";
import { ImageRepository } from "./repositories/ImageRepository";
import { ProjectRepository } from "./repositories/ProjectRepository";

export const projects = createProjection((): Promise<Project[]> => {
  return runtime.runPromise(ProjectRepository.use((repository) => repository.list()));
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
  yield runtime.runPromise(ProjectRepository.use((repository) => repository.select(id)));
  refresh(projects);
});

export const createProject = action(function* (name: string) {
  yield runtime.runPromise(ProjectRepository.use((repository) => repository.create(name)));

  refresh(projects);
});

export const renameProject = action(function* (id: string, name: string) {
  yield runtime.runPromise(ProjectRepository.use((repository) => repository.rename(id, name)));
  refresh(projects);
});

export const deleteProject = action(function* (id: string) {
  yield runtime.runPromise(ProjectRepository.use((repository) => repository.remove(id)));
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
  yield runtime.runPromise(
    ProjectRepository.use((repository) => repository.updatePaperSettings(projectId(), newPaper)),
  );
  refresh(projects);
});

export const imageConfig = createMemo(() => {
  return project().settings.image;
});

export const setImageConfig = action(function* (newImageConfig: Partial<ImageSettings>) {
  yield runtime.runPromise(
    ProjectRepository.use((repository) => repository.updateImageSettings(projectId(), newImageConfig)),
  );
  refresh(projects);
});

interface ImageRef extends ProjectImage {
  objectUrl: string;
}

export const projectImages = createProjection(async (): Promise<ProjectImage[]> => {
  if (!project().id) {
    return [];
  }

  return runtime.runPromise(ImageRepository.use((repository) => repository.listByProject(project().id)));
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

function importImages(files: FileList | readonly File[]): Promise<StoredProjectImage[]> {
  return runtime.runPromise(
    ImageImportService.use((service) =>
      service.addImages({
        files,
        projectId: snapshot(project().id),
        currentImages: snapshot(projectImages),
      }),
    ),
  );
}

export const addImageFiles = action(function* (files: readonly File[]) {
  const importedImages = yield importImages(files);
  refresh(projectImages);
  refresh(projects);

  return importedImages;
});

export const addImages = action(function* (files: FileList) {
  const importedImages = yield importImages(files);
  refresh(projectImages);
  refresh(projects);

  return importedImages;
});

export const deleteImage = action(function* (imageId: string) {
  yield runtime.runPromise(ImageRepository.use((repository) => repository.deleteImage(imageId)));
  refresh(projectImages);
  refresh(projects);
});

export const saveImageCrop = action(function* (
  imageId: string,
  cropKey: string,
  cropCoordinates: CropCoordinates,
) {
  yield runtime.runPromise(
    ImageRepository.use((repository) => repository.saveCrop(imageId, cropKey, cropCoordinates)),
  );
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
