import { Context, Effect, Layer } from "effect";

import { ExportEncodeError, ExportMissingImageError } from "../schema";
import { WebGraphicsService } from "./WebGraphicsService";
import {
  exportBlob,
  EXPORT_DPI,
  type ExportFromCurrentLayoutOptions,
  getExportFilename,
  type ExportImage,
  ImageExportService,
  toInches,
} from "./ImageExportService";

function getOutputMimeType(image: ExportImage) {
  return image.type === "image/png" || image.blob.type === "image/png" ? "image/png" : "image/jpeg";
}

export class PdfExportService extends Context.Service<PdfExportService>()("PdfExportService", {
  make: Effect.gen(function* () {
    const webGraphicsService = yield* WebGraphicsService;
    const imageExportService = yield* ImageExportService;

    const exportPDF = Effect.fn("PdfExportService.exportPDF")(function* (options: ExportFromCurrentLayoutOptions) {
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
            return yield* new ExportMissingImageError({ imageId: rect.data.id });
          }

          const placedWidthInches = toInches(rect.width, options.paper.units);
          const placedHeightInches = toInches(rect.height, options.paper.units);
          const targetWidthPx = Math.max(1, Math.ceil(placedWidthInches * EXPORT_DPI));
          const targetHeightPx = Math.max(1, Math.ceil(placedHeightInches * EXPORT_DPI));
          const canvas = yield* imageExportService.renderImageForRect(image, rect, targetWidthPx, targetHeightPx);
          const mimeType = getOutputMimeType(image);
          const blob = yield* webGraphicsService
            .encodeCanvas(canvas, mimeType, 1)
            .pipe(Effect.mapError((cause) => new ExportEncodeError({ cause })));
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

      yield* exportBlob(output, getExportFilename(options.projectName, "pdf"));
    }, Effect.scoped);

    return { exportPDF };
  }),
}) {
  static readonly layer = Layer.effect(PdfExportService, PdfExportService.make).pipe(
    Layer.provide(ImageExportService.layer),
    Layer.provide(WebGraphicsService.layer),
  );
}
