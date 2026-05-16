import { PDFDocument } from "pdf-lib";
import type { PackedImageBin } from "../layout";
import {
  canvasToBlob,
  downloadBlob,
  EXPORT_DPI,
  JPEG_QUALITY,
  renderImageForRect,
  toInches,
  type DownloadImage,
  type PaperLayout,
} from "./common";

interface DownloadPdfFromCurrentLayoutOptions {
  bins: PackedImageBin[];
  paper: PaperLayout;
  images: DownloadImage[];
}

function getOutputMimeType(image: DownloadImage) {
  return image.type === "image/png" || image.blob.type === "image/png" ? "image/png" : "image/jpeg";
}

async function embedCanvas(
  pdf: PDFDocument,
  canvas: HTMLCanvasElement,
  mimeType: "image/jpeg" | "image/png",
) {
  const blob = await canvasToBlob(
    canvas,
    mimeType,
    mimeType === "image/jpeg" ? JPEG_QUALITY : undefined,
  );
  const bytes = await blob.arrayBuffer();

  return mimeType === "image/png" ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

export async function downloadPdfFromCurrentLayout(options: DownloadPdfFromCurrentLayoutOptions) {
  const pdf = await PDFDocument.create();
  const imagesById = new Map(options.images.map((image) => [image.id, image]));
  const pageWidthPt = toInches(options.paper.width, options.paper.units) * 72;
  const pageHeightPt = toInches(options.paper.height, options.paper.units) * 72;

  for (const packedBin of options.bins) {
    const page = pdf.addPage([pageWidthPt, pageHeightPt]);

    for (const rect of packedBin.rects) {
      const image = imagesById.get(rect.data.id);

      if (!image) {
        throw new Error(`Missing image for packed rectangle: ${rect.data.id}`);
      }

      const placedWidthInches = toInches(rect.width, options.paper.units);
      const placedHeightInches = toInches(rect.height, options.paper.units);
      const targetWidthPx = Math.max(1, Math.ceil(placedWidthInches * EXPORT_DPI));
      const targetHeightPx = Math.max(1, Math.ceil(placedHeightInches * EXPORT_DPI));
      const canvas = await renderImageForRect(image, rect, targetWidthPx, targetHeightPx);
      const embeddedImage = await embedCanvas(pdf, canvas, getOutputMimeType(image));
      const rectXPt = toInches(rect.x, options.paper.units) * 72;
      const rectYPt =
        pageHeightPt - (toInches(rect.y, options.paper.units) + placedHeightInches) * 72;
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

  const bytes = await pdf.save();
  const output = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });

  downloadBlob(output, "printable-photos.pdf");
}
