import { zipSync } from "fflate";
import type { PackedImageBin } from "../layout";
import {
  downloadBlob,
  EXPORT_DPI,
  getDownloadFilename,
  get2dContext,
  renderImageForRect,
  toArrayBuffer,
  toInches,
  type DownloadImage,
  type PaperLayout,
} from "./common";

interface DownloadPhotosFromCurrentLayoutOptions {
  bins: PackedImageBin[];
  paper: PaperLayout;
  images: DownloadImage[];
  projectName: string;
}

async function renderPageCanvas(
  bin: PackedImageBin,
  imagesById: Map<string, DownloadImage>,
  paper: PaperLayout,
) {
  const pageWidthPx = Math.max(1, Math.ceil(toInches(paper.width, paper.units) * EXPORT_DPI));
  const pageHeightPx = Math.max(1, Math.ceil(toInches(paper.height, paper.units) * EXPORT_DPI));
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = pageWidthPx;
  pageCanvas.height = pageHeightPx;
  const pageContext = get2dContext(pageCanvas, "Failed to create page canvas context");

  pageContext.fillStyle = "#ffffff";
  pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

  for (const rect of bin.rects) {
    const image = imagesById.get(rect.data.id);

    if (!image) {
      throw new Error(`Missing image for packed rectangle: ${rect.data.id}`);
    }

    const placedWidthInches = toInches(rect.width, paper.units);
    const placedHeightInches = toInches(rect.height, paper.units);
    const targetWidthPx = Math.max(1, Math.ceil(placedWidthInches * EXPORT_DPI));
    const targetHeightPx = Math.max(1, Math.ceil(placedHeightInches * EXPORT_DPI));
    const imageCanvas = await renderImageForRect(image, rect, targetWidthPx, targetHeightPx);
    const rectXPx = Math.round(toInches(rect.x, paper.units) * EXPORT_DPI);
    const rectYPx = Math.round(toInches(rect.y, paper.units) * EXPORT_DPI);

    pageContext.drawImage(imageCanvas, rectXPx, rectYPx, targetWidthPx, targetHeightPx);
  }

  return pageCanvas;
}

export async function downloadPhotosFromCurrentLayout(
  options: DownloadPhotosFromCurrentLayoutOptions,
) {
  const imagesById = new Map(options.images.map((image) => [image.id, image]));
  const blobs = await Promise.all(
    options.bins.map(async (bin) => {
      const canvas = await renderPageCanvas(bin, imagesById, options.paper);

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (output) => {
            if (output) {
              resolve(output);
            } else {
              reject(new Error("Failed to encode page canvas"));
            }
          },
          "image/jpeg",
          1,
        );
      });
    }),
  );
  const files = Object.fromEntries(
    await Promise.all(
      blobs.map(async (blob, index) => {
        const pageNumber = String(index + 1).padStart(3, "0");
        const bytes = new Uint8Array(await blob.arrayBuffer());

        return [`page-${pageNumber}.jpg`, bytes];
      }),
    ),
  );
  const zipped = zipSync(files, { level: 0 });
  const output = new Blob([toArrayBuffer(zipped)], { type: "application/zip" });

  downloadBlob(output, getDownloadFilename(options.projectName, "zip"));
}
