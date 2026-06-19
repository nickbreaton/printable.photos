/**
 * Note: this file was vibe coded. Here be dragons.
 *
 * The WebMCP surface is intentionally isolated here and delegates to the app's
 * existing Solid actions/state so normal data flow stays in charge. Those
 * global actions made this routing layer very convenient.
 */
import { onSettled, resolve, snapshot } from "solid-js";

import {
  ALL_PAPER_PRESETS,
  getSelectedPaperPreset,
  type ImageSettings,
  type PaperSettings,
  type Project,
  type ProjectImage,
  type StoredProjectImage,
} from "./data";
import {
  addImageFiles,
  createProject,
  deleteImage,
  project,
  projectImages,
  projects,
  renameProject,
  selectProject,
  setImageConfig,
  setPaper,
} from "./state";

// Primary reference: https://github.com/webmachinelearning/webmcp
// WebMCP is intentionally client-side: this page registers browser-discoverable tools.
type JsonSchema = Record<string, unknown>;

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  execute: (input: unknown) => unknown | Promise<unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
};

type WebMcpModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

const PAPER_PRESET_VALUES = ALL_PAPER_PRESETS.map((preset) => preset.value);
const IMAGE_CROP_VALUES = ["original", "square"] as const;
const NO_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} satisfies JsonSchema;

function getModelContext(): WebMcpModelContext | undefined {
  return (
    (document as Document & { modelContext?: WebMcpModelContext }).modelContext ??
    (navigator as Navigator & { modelContext?: WebMcpModelContext }).modelContext
  );
}

function toIso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function serializeSettings(settings: Project["settings"]) {
  return {
    pagePreset: getSelectedPaperPreset(settings.paper),
    pageWidth: settings.paper.width,
    pageHeight: settings.paper.height,
    pageMargin: settings.paper.margin,
    pageGap: settings.paper.gap,
    allowRotation: settings.paper.allowRotation,
    imageCrop: settings.image.shape,
    imageWidth: settings.image.width,
  };
}

function serializeProjectSummary(currentProject: Project) {
  return {
    name: currentProject.name,
    current: currentProject.id === project().id,
    createdAt: toIso(currentProject.createdAt),
    updatedAt: toIso(currentProject.updatedAt),
  };
}

function serializeImage(
  image: Pick<ProjectImage, "id" | "name" | "type" | "width" | "height" | "createdAt" | "updatedAt">,
) {
  return {
    imageId: image.id,
    name: image.name,
    type: image.type,
    width: image.width,
    height: image.height,
    createdAt: toIso(image.createdAt),
    updatedAt: toIso(image.updatedAt),
  };
}

function serializeCurrentProject() {
  const currentProject = snapshot(project());

  return {
    project: {
      name: currentProject.name,
      createdAt: toIso(currentProject.createdAt),
      updatedAt: toIso(currentProject.updatedAt),
      settings: serializeSettings(currentProject.settings),
      images: projectImages.map(serializeImage),
    },
  };
}

function requireObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Tool input must be an object.");
  }

  return input as Record<string, unknown>;
}

function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`“${key}” must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`“${key}” must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`“${key}” must be a boolean when provided.`);
  }

  return value;
}

function optionalNumber(
  input: Record<string, unknown>,
  key: string,
  options: { min: number; exclusiveMin?: boolean },
): number | undefined {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`“${key}” must be a finite number when provided.`);
  }

  const valid = options.exclusiveMin ? value > options.min : value >= options.min;
  if (!valid) {
    throw new Error(`“${key}” must be ${options.exclusiveMin ? "greater than" : "at least"} ${options.min}.`);
  }

  return value;
}

function optionalEnum<const T extends readonly string[]>(
  input: Record<string, unknown>,
  key: string,
  values: T,
): T[number] | undefined {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`“${key}” must be one of: ${values.join(", ")}.`);
  }

  return value;
}

function listProjects() {
  return {
    projects: snapshot(projects).map(serializeProjectSummary),
  };
}

async function createNamedProject(input: unknown) {
  const args = requireObject(input);
  const name = requireString(args, "name");

  await createProject(name);
  await resolve(() => project());

  return serializeCurrentProject();
}

async function switchProject(input: unknown) {
  const args = requireObject(input);
  const name = requireString(args, "name");
  const matches = projects.filter((candidateProject) => candidateProject.name === name);

  if (matches.length === 0) {
    throw new Error(`No project named “${name}” exists. Use list_projects to see available projects.`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple projects are named “${name}”. Rename one in the UI before switching by name.`);
  }

  await selectProject(matches[0].id);
  await resolve(() => project());

  return serializeCurrentProject();
}

async function renameCurrentProject(input: unknown) {
  const args = requireObject(input);
  const name = requireString(args, "name");
  const currentProject = snapshot(project());

  await renameProject(currentProject.id, name);
  await resolve(() => project().name === name);

  return serializeCurrentProject();
}

async function updateCurrentProjectSettings(input: unknown) {
  const args = requireObject(input);
  const paperUpdate: Partial<PaperSettings> = {};
  const imageUpdate: Partial<ImageSettings> = {};
  const pagePreset = optionalEnum(args, "pagePreset", PAPER_PRESET_VALUES);

  if (pagePreset) {
    const preset = ALL_PAPER_PRESETS.find((candidatePreset) => candidatePreset.value === pagePreset);

    if (preset) {
      paperUpdate.width = preset.width;
      paperUpdate.height = preset.height;
    }
  }

  const pageWidth = optionalNumber(args, "pageWidth", { min: 0, exclusiveMin: true });
  const pageHeight = optionalNumber(args, "pageHeight", { min: 0, exclusiveMin: true });
  const pageMargin = optionalNumber(args, "pageMargin", { min: 0 });
  const pageGap = optionalNumber(args, "pageGap", { min: 0 });
  const allowRotation = optionalBoolean(args, "allowRotation");
  const imageCrop = optionalEnum(args, "imageCrop", IMAGE_CROP_VALUES);
  const imageWidth = optionalNumber(args, "imageWidth", { min: 0, exclusiveMin: true });

  if (pageWidth !== undefined) paperUpdate.width = pageWidth;
  if (pageHeight !== undefined) paperUpdate.height = pageHeight;
  if (pageMargin !== undefined) paperUpdate.margin = pageMargin;
  if (pageGap !== undefined) paperUpdate.gap = pageGap;
  if (allowRotation !== undefined) paperUpdate.allowRotation = allowRotation;
  if (imageCrop !== undefined) imageUpdate.shape = imageCrop;
  if (imageWidth !== undefined) imageUpdate.width = imageWidth;

  if (Object.keys(paperUpdate).length > 0) {
    await setPaper(paperUpdate);
  }

  if (Object.keys(imageUpdate).length > 0) {
    await setImageConfig(imageUpdate);
  }

  await resolve(() => project());

  return serializeCurrentProject();
}

function getFileExtension(type: string): string {
  switch (type.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

function safeFileName(name: string | undefined, fallback: string): string {
  return (name?.trim() || fallback).replace(/[\\/]/g, "-").replaceAll("\0", "-");
}

function withExtension(name: string, type: string): string {
  if (/\.[a-z0-9]{2,5}$/i.test(name)) {
    return name;
  }

  return `${name}.${getFileExtension(type)}`;
}

async function downloadImageSource(source: string): Promise<{ blob: Blob; type: string; fallbackName: string }> {
  if (source.startsWith("data:")) {
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(source)) {
      throw new Error("Base64 uploads must be image data URLs, such as data:image/png;base64,...");
    }

    const response = await fetch(source);
    const blob = await response.blob();

    if (!blob.type.toLowerCase().startsWith("image/")) {
      throw new Error("The data URL did not decode to an image.");
    }

    return { blob, type: blob.type, fallbackName: `webmcp-upload-${Date.now()}` };
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("Image source must be an absolute http(s) URL or a base64 image data URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("External image URLs must use http or https.");
  }

  let response: Response;
  try {
    response = await fetch(url, { mode: "cors" });
  } catch {
    throw new Error(
      `Could not read the image URL. Servers used with this WebMCP tool should send CORS headers, such as Access-Control-Allow-Origin: ${location.origin}, so this page can download the image.`,
    );
  }

  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}.`);
  }

  const blob = await response.blob();
  const contentType = (blob.type || response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error("The downloaded URL did not return an image content type.");
  }

  const pathName = url.pathname.split("/").filter(Boolean).at(-1);
  const fallbackName = pathName ? decodeURIComponent(pathName) : `webmcp-upload-${Date.now()}`;

  return { blob, type: contentType, fallbackName };
}

async function uploadImage(input: unknown) {
  const args = requireObject(input);
  const source = requireString(args, "source");
  const requestedName = optionalString(args, "name");
  const { blob, fallbackName, type } = await downloadImageSource(source);
  const fileName = withExtension(safeFileName(requestedName, fallbackName), type);
  const file = new File([blob], fileName, { type });
  const importedImages = (await addImageFiles([file])) as StoredProjectImage[];
  const importedImage = importedImages[0];

  await resolve(() => projectImages.find((image) => image.id === importedImage.id));

  return {
    project: serializeCurrentProject().project.name,
    image: serializeImage(importedImage),
  };
}

async function deleteCurrentProjectImage(input: unknown) {
  const args = requireObject(input);
  const imageId = requireString(args, "imageId");
  const image = projectImages.find((candidateImage) => candidateImage.id === imageId);

  if (!image) {
    throw new Error("Image not found in the currently selected project.");
  }

  await deleteImage(image.id);
  await resolve(() => !projectImages.some((candidateImage) => candidateImage.id === image.id));

  return {
    deletedImage: serializeImage(image),
    project: serializeCurrentProject().project,
  };
}

function getTools(): WebMcpTool[] {
  return [
    {
      name: "list_projects",
      title: "List printable.photos projects",
      description:
        "List the projects available in printable.photos. Project IDs are intentionally not exposed; use project names with switch_project.",
      inputSchema: NO_INPUT_SCHEMA,
      execute: listProjects,
      annotations: { readOnlyHint: true },
    },
    {
      name: "create_project",
      title: "Create printable.photos project",
      description: "Create a new printable.photos project by name. The new project becomes the current project.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name for the new project." },
        },
        required: ["name"],
        additionalProperties: false,
      },
      execute: createNamedProject,
    },
    {
      name: "switch_project",
      title: "Switch printable.photos project",
      description: "Switch the UI to an existing project by exact project name. Project IDs are not accepted.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Exact name of the project to make current." },
        },
        required: ["name"],
        additionalProperties: false,
      },
      execute: switchProject,
    },
    {
      name: "rename_project",
      title: "Rename current printable.photos project",
      description: "Rename the currently selected printable.photos project. Project IDs are not accepted.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "New name for the current project." },
        },
        required: ["name"],
        additionalProperties: false,
      },
      execute: renameCurrentProject,
    },
    {
      name: "get_current_project",
      title: "Get current printable.photos project",
      description:
        "Get the currently selected project, UI-configurable settings, and current project images. Internal unit settings are intentionally omitted.",
      inputSchema: NO_INPUT_SCHEMA,
      execute: serializeCurrentProject,
      annotations: { readOnlyHint: true },
    },
    {
      name: "update_settings",
      title: "Update printable.photos settings",
      description:
        "Update settings available in the UI for the current project: page preset or custom page size, page margin, page gap, image crop, image width, and rotation. Internal unit settings are intentionally not exposed. Explicit pageWidth/pageHeight values override pagePreset dimensions.",
      inputSchema: {
        type: "object",
        properties: {
          pagePreset: {
            type: "string",
            enum: PAPER_PRESET_VALUES,
            description: "Optional UI page preset to apply.",
          },
          pageWidth: { type: "number", description: "Custom page width using the same numeric value shown in the UI." },
          pageHeight: {
            type: "number",
            description: "Custom page height using the same numeric value shown in the UI.",
          },
          pageMargin: { type: "number", description: "Page margin value shown in the UI. Must be zero or greater." },
          pageGap: { type: "number", description: "Gap between images shown in the UI. Must be zero or greater." },
          imageCrop: {
            type: "string",
            enum: IMAGE_CROP_VALUES,
            description: "Image crop option shown in the UI.",
          },
          imageWidth: { type: "number", description: "Image width value shown in the UI. Must be greater than zero." },
          allowRotation: { type: "boolean", description: "Whether photos may be rotated to reduce total page count." },
        },
        additionalProperties: false,
      },
      execute: updateCurrentProjectSettings,
    },
    {
      name: "upload_image",
      title: "Upload image to current printable.photos project",
      description: `Upload one image into the currently selected project. The source can be a base64 image data URL or an external http(s) URL. For external URLs, the server should allow cross-origin reads from ${location.origin} with CORS headers, otherwise the image cannot be read by this page.`,
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description:
              "A base64 image data URL, or an absolute http(s) URL for an image that permits CORS reads from this page.",
          },
          name: { type: "string", description: "Optional file name to use in the project." },
        },
        required: ["source"],
        additionalProperties: false,
      },
      execute: uploadImage,
    },
    {
      name: "delete_image",
      title: "Delete image from current printable.photos project",
      description:
        "Delete an image from the currently selected project by imageId as returned by get_current_project or upload_image. Images outside the current project are not affected.",
      inputSchema: {
        type: "object",
        properties: {
          imageId: { type: "string", description: "Image ID from the currently selected project." },
        },
        required: ["imageId"],
        additionalProperties: false,
      },
      execute: deleteCurrentProjectImage,
    },
  ];
}

function ignoreAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function registerPrintablePhotosWebMcp(): () => void {
  const modelContext = getModelContext();

  if (!modelContext) {
    return () => {};
  }

  const controller = new AbortController();

  for (const tool of getTools()) {
    const registration = modelContext.registerTool(tool, { signal: controller.signal });

    void Promise.resolve(registration).catch((error) => {
      if (ignoreAbort(error)) return;

      console.warn(`Could not register WebMCP tool “${tool.name}”.`, error);
    });
  }

  return () => controller.abort();
}

export function WebMcpTools() {
  onSettled(registerPrintablePhotosWebMcp);

  return null;
}
