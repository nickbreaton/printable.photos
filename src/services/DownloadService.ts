import { Context, Effect, Layer } from "effect";

import { computeInitialCrop, cropFromPercentages, cropToSourcePixels, getCropKey } from "../crop";
import { database, type CropCoordinates } from "../data";
import type { PackedImageBin, PackedImageRectangle } from "../layout";
import { DownloadEncodeError, DownloadMissingImageError } from "../schema";
import { WebGraphicsService } from "./WebGraphicsService";

const EXPORT_DPI = 300;

export interface PaperLayout {
  width: number;
  height: number;
  units: "in" | "mm";
}

export interface DownloadImage {
  id: string;
  width: number;
  height: number;
  blob: Blob;
  type: string;
  crops: Record<string, CropCoordinates>;
}

interface DownloadFromCurrentLayoutOptions {
  bins: PackedImageBin[];
  paper: PaperLayout;
  images: DownloadImage[];
  projectName: string;
}

function toInches(value: number, units: PaperLayout["units"]) {
  return units === "mm" ? value / 25.4 : value;
}

function getPlacedCrop(image: DownloadImage, rect: PackedImageRectangle, source: { width: number; height: number }) {
  const savedCrop = image.crops?.[getCropKey(rect)];

  return savedCrop
    ? cropFromPercentages(savedCrop, source.width, source.height)
    : computeInitialCrop(source.width, source.height, rect);
}

function getSourceCropBounds(
  image: DownloadImage,
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
  image: DownloadImage,
  rect: PackedImageRectangle,
  preRotationWidth: number,
  preRotationHeight: number,
) {
  const crop = getSourceCropBounds(image, rect, image);

  return crop.cropWidth >= preRotationWidth && crop.cropHeight >= preRotationHeight;
}

function getDownloadFilename(projectName: string, extension: string) {
  const safeName = projectName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+|[.\s-]+$/g, "");

  return `${safeName || "printable-photos"}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string) {
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

function getOutputMimeType(image: DownloadImage) {
  return image.type === "image/png" || image.blob.type === "image/png" ? "image/png" : "image/jpeg";
}

export class DownloadService extends Context.Service<DownloadService>()("DownloadService", {
  make: Effect.gen(function* () {
    const webGraphicsService = yield* WebGraphicsService;

    const renderImageForRect = Effect.fn("DownloadService.renderImageForRect")(function* (
      image: DownloadImage,
      rect: PackedImageRectangle,
      targetWidthPx: number,
      targetHeightPx: number,
    ) {
      const preRotationWidth = rect.rot ? targetHeightPx : targetWidthPx;
      const preRotationHeight = rect.rot ? targetWidthPx : targetHeightPx;
      const originalImage = imageMeetsExportDpi(image, rect, preRotationWidth, preRotationHeight)
        ? undefined
        : yield* Effect.promise(() => database.originalImages.get(image.id));
      const sourceBlob = originalImage?.blob ?? image.blob;
      const sourceBitmap = yield* Effect.acquireRelease(
        webGraphicsService
          .createImageBitmap(sourceBlob)
          .pipe(Effect.mapError((cause) => new DownloadEncodeError({ cause }))),
        (bitmap) => Effect.sync(() => bitmap.close()),
      );
      const { cropX, cropY, cropWidth, cropHeight } = getSourceCropBounds(image, rect, sourceBitmap);
      const { canvas: fittedCanvas, context: fittedContext } = yield* webGraphicsService
        .createCanvas(preRotationWidth, preRotationHeight)
        .pipe(Effect.mapError((cause) => new DownloadEncodeError({ cause })));

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
        .pipe(Effect.mapError((cause) => new DownloadEncodeError({ cause })));

      rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      rotatedContext.rotate(Math.PI / 2);
      rotatedContext.drawImage(fittedCanvas, -fittedCanvas.width / 2, -fittedCanvas.height / 2);

      return rotatedCanvas;
    }, Effect.scoped);

    const renderPageCanvas = Effect.fn("DownloadService.renderPageCanvas")(function* (
      bin: PackedImageBin,
      imagesById: Map<string, DownloadImage>,
      paper: PaperLayout,
    ) {
      const pageWidthPx = Math.max(1, Math.ceil(toInches(paper.width, paper.units) * EXPORT_DPI));
      const pageHeightPx = Math.max(1, Math.ceil(toInches(paper.height, paper.units) * EXPORT_DPI));
      const { canvas: pageCanvas, context: pageContext } = yield* webGraphicsService
        .createCanvas(pageWidthPx, pageHeightPx)
        .pipe(Effect.mapError((cause) => new DownloadEncodeError({ cause })));

      pageContext.fillStyle = "#ffffff";
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      for (const rect of bin.rects) {
        const image = imagesById.get(rect.data.id);

        if (!image) {
          return yield* new DownloadMissingImageError({ imageId: rect.data.id });
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

    const downloadPhotoZip = Effect.fn("DownloadService.downloadPhotoZip")(function* (
      options: DownloadFromCurrentLayoutOptions,
    ) {
      const { zipSync } = yield* Effect.promise(() => import("fflate"));
      const imagesById = new Map(options.images.map((image) => [image.id, image]));
      const blobs = yield* Effect.all(
        options.bins.map((bin) =>
          Effect.gen(function* () {
            const canvas = yield* renderPageCanvas(bin, imagesById, options.paper);
            return yield* webGraphicsService
              .encodeCanvas(canvas, "image/jpeg", 1)
              .pipe(Effect.mapError((cause) => new DownloadEncodeError({ cause })));
          }),
        ),
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
        ),
      );
      const zipped = zipSync(files, { level: 0 });
      const output = new Blob([toArrayBuffer(zipped)], { type: "application/zip" });

      yield* downloadBlob(output, getDownloadFilename(options.projectName, "zip"));
    });

    const downloadPDF = Effect.fn("DownloadService.downloadPDF")(function* (options: DownloadFromCurrentLayoutOptions) {
      const { PDFDocument } = yield* Effect.promise(() => import("pdf-lib"));
      const pdf = yield* Effect.promise(() => PDFDocument.create());
      const imagesById = new Map(options.images.map((image) => [image.id, image]));
      const pageWidthPt = toInches(options.paper.width, options.paper.units) * 72;
      const pageHeightPt = toInches(options.paper.height, options.paper.units) * 72;

      for (const packedBin of options.bins) {
        const page = pdf.addPage([pageWidthPt, pageHeightPt]);

        for (const rect of packedBin.rects) {
          const image = imagesById.get(rect.data.id);

          if (!image) {
            return yield* new DownloadMissingImageError({ imageId: rect.data.id });
          }

          const placedWidthInches = toInches(rect.width, options.paper.units);
          const placedHeightInches = toInches(rect.height, options.paper.units);
          const targetWidthPx = Math.max(1, Math.ceil(placedWidthInches * EXPORT_DPI));
          const targetHeightPx = Math.max(1, Math.ceil(placedHeightInches * EXPORT_DPI));
          const canvas = yield* renderImageForRect(image, rect, targetWidthPx, targetHeightPx);
          const mimeType = getOutputMimeType(image);
          const blob = yield* webGraphicsService
            .encodeCanvas(canvas, mimeType, 1)
            .pipe(Effect.mapError((cause) => new DownloadEncodeError({ cause })));
          const bytes = yield* Effect.promise(() => blob.arrayBuffer());
          const embeddedImage = yield* Effect.promise(() =>
            mimeType === "image/png" ? pdf.embedPng(bytes) : pdf.embedJpg(bytes),
          );
          const rectXPt = toInches(rect.x, options.paper.units) * 72;
          const rectYPt = pageHeightPt - (toInches(rect.y, options.paper.units) + placedHeightInches) * 72;
          const rectWidthPt = placedWidthInches * 72;
          const rectHeightPt = placedHeightInches * 72;

          page.drawImage(embeddedImage, {
            x: rectXPt,
            y: rectYPt,
            width: rectWidthPt,
            height: rectHeightPt,
          });
        }
      }

      const bytes = yield* Effect.promise(() => pdf.save());
      const output = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });

      yield* downloadBlob(output, getDownloadFilename(options.projectName, "pdf"));
    });

    return { downloadPhotoZip, downloadPDF };
  }),
}) {
  static readonly layer = Layer.effect(DownloadService, DownloadService.make).pipe(
    Layer.provide(WebGraphicsService.layer),
  );
}
