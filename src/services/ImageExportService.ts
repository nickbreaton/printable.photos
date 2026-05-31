import { Context, Effect, Layer } from "effect";

import { computeInitialCrop, cropFromPercentages, cropToSourcePixels, getCropKey } from "../crop";
import type { CropCoordinates } from "../data";
import type { PackedImageBin, PackedImageRectangle } from "../layout";
import { ImageRepository } from "../repositories/ImageRepository";
import { ExportEncodeError, ExportMissingImageError } from "../schema";
import { WebGraphicsService } from "./WebGraphicsService";

export const EXPORT_DPI = 300;

export interface PaperLayout {
  width: number;
  height: number;
  units: "in" | "mm";
}

export interface ExportImage {
  id: string;
  width: number;
  height: number;
  blob: Blob;
  type: string;
  crops: Record<string, CropCoordinates>;
}

export interface ExportFromCurrentLayoutOptions {
  bins: PackedImageBin[];
  paper: PaperLayout;
  images: ExportImage[];
  projectName: string;
}

export function toInches(value: number, units: PaperLayout["units"]) {
  return units === "mm" ? value / 25.4 : value;
}

function getPlacedCrop(image: ExportImage, rect: PackedImageRectangle, source: { width: number; height: number }) {
  const savedCrop = image.crops?.[getCropKey(rect)];

  return savedCrop
    ? cropFromPercentages(savedCrop, source.width, source.height)
    : computeInitialCrop(source.width, source.height, rect);
}

function getSourceCropBounds(
  image: ExportImage,
  rect: PackedImageRectangle,
  source: { width: number; height: number },
) {
  const crop = getPlacedCrop(image, rect, source);
  const sourceCrop = cropToSourcePixels(crop, source.width, source.height);
  const cropX = Math.max(0, Math.min(source.width - 1, Math.round(sourceCrop.x)));
  const cropY = Math.max(0, Math.min(source.height - 1, Math.round(sourceCrop.y)));
  const cropWidth = Math.max(1, Math.min(source.width - cropX, Math.round(sourceCrop.width)));
  const cropHeight = Math.max(1, Math.min(source.height - cropY, Math.round(sourceCrop.height)));

  return { cropX, cropY, cropWidth, cropHeight };
}

function imageMeetsExportDpi(
  image: ExportImage,
  rect: PackedImageRectangle,
  preRotationWidth: number,
  preRotationHeight: number,
) {
  const crop = getSourceCropBounds(image, rect, image);

  return crop.cropWidth >= preRotationWidth && crop.cropHeight >= preRotationHeight;
}

export function getExportFilename(projectName: string, extension: string) {
  const safeName = projectName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+|[.\s-]+$/g, "");

  return `${safeName || "printable-photos"}.${extension}`;
}

export function exportBlob(blob: Blob, filename: string) {
  return Effect.sync(() => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  });
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export class ImageExportService extends Context.Service<ImageExportService>()("ImageExportService", {
  make: Effect.gen(function* () {
    const webGraphicsService = yield* WebGraphicsService;
    const imageRepository = yield* ImageRepository;

    const renderImageForRect = Effect.fn("ImageExportService.renderImageForRect")(function* (
      image: ExportImage,
      rect: PackedImageRectangle,
      targetWidthPx: number,
      targetHeightPx: number,
    ) {
      const preRotationWidth = rect.rot ? targetHeightPx : targetWidthPx;
      const preRotationHeight = rect.rot ? targetWidthPx : targetHeightPx;
      const originalImage = imageMeetsExportDpi(image, rect, preRotationWidth, preRotationHeight)
        ? undefined
        : yield* imageRepository.getOriginalImage(image.id);
      const sourceBlob = originalImage?.blob ?? image.blob;
      const sourceBitmap = yield* webGraphicsService
        .createImageBitmap(sourceBlob)
        .pipe(Effect.mapError((cause) => new ExportEncodeError({ cause })));
      const { cropX, cropY, cropWidth, cropHeight } = getSourceCropBounds(image, rect, sourceBitmap);
      const { canvas: fittedCanvas, context: fittedContext } = yield* webGraphicsService
        .createCanvas(preRotationWidth, preRotationHeight)
        .pipe(Effect.mapError((cause) => new ExportEncodeError({ cause })));

      fittedContext.imageSmoothingEnabled = true;
      fittedContext.imageSmoothingQuality = "high";
      fittedContext.drawImage(
        sourceBitmap,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        fittedCanvas.width,
        fittedCanvas.height,
      );

      if (!rect.rot) {
        return fittedCanvas;
      }

      const { canvas: rotatedCanvas, context: rotatedContext } = yield* webGraphicsService
        .createCanvas(targetWidthPx, targetHeightPx)
        .pipe(Effect.mapError((cause) => new ExportEncodeError({ cause })));

      rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      rotatedContext.rotate(Math.PI / 2);
      rotatedContext.drawImage(fittedCanvas, -fittedCanvas.width / 2, -fittedCanvas.height / 2);

      return rotatedCanvas;
    });

    const renderPageCanvas = Effect.fn("ImageExportService.renderPageCanvas")(function* (
      bin: PackedImageBin,
      imagesById: Map<string, ExportImage>,
      paper: PaperLayout,
    ) {
      const pageWidthPx = Math.max(1, Math.ceil(toInches(paper.width, paper.units) * EXPORT_DPI));
      const pageHeightPx = Math.max(1, Math.ceil(toInches(paper.height, paper.units) * EXPORT_DPI));
      const { canvas: pageCanvas, context: pageContext } = yield* webGraphicsService
        .createCanvas(pageWidthPx, pageHeightPx)
        .pipe(Effect.mapError((cause) => new ExportEncodeError({ cause })));

      pageContext.fillStyle = "#ffffff";
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      for (const rect of bin.rects) {
        const image = imagesById.get(rect.data.id);

        if (!image) {
          return yield* new ExportMissingImageError({ imageId: rect.data.id });
        }

        const placedWidthInches = toInches(rect.width, paper.units);
        const placedHeightInches = toInches(rect.height, paper.units);
        const targetWidthPx = Math.max(1, Math.ceil(placedWidthInches * EXPORT_DPI));
        const targetHeightPx = Math.max(1, Math.ceil(placedHeightInches * EXPORT_DPI));
        const imageCanvas = yield* renderImageForRect(image, rect, targetWidthPx, targetHeightPx);
        const rectXPx = Math.round(toInches(rect.x, paper.units) * EXPORT_DPI);
        const rectYPx = Math.round(toInches(rect.y, paper.units) * EXPORT_DPI);

        pageContext.drawImage(imageCanvas, rectXPx, rectYPx, targetWidthPx, targetHeightPx);
      }

      return pageCanvas;
    });

    const exportImageZip = Effect.fn("ImageExportService.exportImageZip")(function* (
      options: ExportFromCurrentLayoutOptions,
    ) {
      const { zipSync } = yield* Effect.promise(() => import("fflate"));
      const imagesById = new Map(options.images.map((image) => [image.id, image]));
      const blobs = yield* Effect.all(
        options.bins.map((bin) =>
          Effect.gen(function* () {
            const canvas = yield* renderPageCanvas(bin, imagesById, options.paper);
            return yield* webGraphicsService
              .encodeCanvas(canvas, "image/jpeg", 1)
              .pipe(Effect.mapError((cause) => new ExportEncodeError({ cause })));
          }),
        ),
        { concurrency: "unbounded" },
      );
      const files = Object.fromEntries(
        yield* Effect.all(
          blobs.map((blob, index) =>
            Effect.gen(function* () {
              const pageNumber = String(index + 1).padStart(3, "0");
              const bytes = new Uint8Array(yield* Effect.promise(() => blob.arrayBuffer()));

              return [`page-${pageNumber}.jpg`, bytes] as const;
            }),
          ),
          { concurrency: "unbounded" },
        ),
      );
      const zipped = zipSync(files, { level: 0 });
      const output = new Blob([toArrayBuffer(zipped)], { type: "application/zip" });

      yield* exportBlob(output, getExportFilename(options.projectName, "zip"));
    }, Effect.scoped);

    return { exportImageZip, renderImageForRect, renderPageCanvas };
  }),
}) {
  static readonly layer = Layer.effect(ImageExportService, ImageExportService.make).pipe(
    Layer.provide(WebGraphicsService.layer),
    Layer.provide(ImageRepository.layer),
  );
}
