import { zipSync } from "fflate";
import picaFactory from "pica";
import { PDFDocument } from "pdf-lib";
import { computeInitialCrop, cropFromPercentages, cropToSourcePixels, getCropKey } from "./crop";
import type { CropCoordinates } from "./data";
import type { PackedImageBin, PackedImageRectangle } from "./layout";

const EXPORT_DPI = 300;
const JPEG_QUALITY = 0.94;
const pica = picaFactory();

interface PaperLayout {
  width: number;
  height: number;
  units: "in" | "mm";
}

interface DownloadImage {
  id: string;
  width: number;
  height: number;
  blob: Blob;
  type: string;
  crops: Record<string, CropCoordinates>;
}

interface DownloadPdfFromCurrentLayoutOptions {
  bins: PackedImageBin[];
  paper: PaperLayout;
  images: DownloadImage[];
}

interface DownloadPhotosFromCurrentLayoutOptions {
  bins: PackedImageBin[];
  paper: PaperLayout;
  images: DownloadImage[];
}

function toInches(value: number, units: PaperLayout["units"]) {
  return units === "mm" ? value / 25.4 : value;
}

function getOutputMimeType(image: DownloadImage) {
  return image.type === "image/png" || image.blob.type === "image/png" ? "image/png" : "image/jpeg";
}

function getPlacedCrop(image: DownloadImage, rect: PackedImageRectangle) {
  const savedCrop = image.crops?.[getCropKey(rect)];

  return savedCrop
    ? cropFromPercentages(savedCrop, image.width, image.height)
    : computeInitialCrop(image.width, image.height, rect);
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2dContext(canvas: HTMLCanvasElement, errorMessage: string) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(errorMessage);
  }

  return context;
}

async function renderImageForRect(
  image: DownloadImage,
  rect: PackedImageRectangle,
  targetWidthPx: number,
  targetHeightPx: number,
  resize: "pica" | "canvas" = "pica",
) {
  const sourceBitmap = await createImageBitmap(image.blob);

  try {
    const crop = getPlacedCrop(image, rect);
    const sourceCrop = cropToSourcePixels(crop, image.width, image.height);
    const cropX = Math.max(0, Math.min(image.width - 1, sourceCrop.x));
    const cropY = Math.max(0, Math.min(image.height - 1, sourceCrop.y));
    const cropWidth = Math.max(1, Math.min(image.width - cropX, sourceCrop.width));
    const cropHeight = Math.max(1, Math.min(image.height - cropY, sourceCrop.height));
    const preRotationWidth = rect.rot ? targetHeightPx : targetWidthPx;
    const preRotationHeight = rect.rot ? targetWidthPx : targetHeightPx;
    const croppedCanvas = createCanvas(
      Math.max(1, Math.round(cropWidth)),
      Math.max(1, Math.round(cropHeight)),
    );
    const croppedContext = get2dContext(croppedCanvas, "Failed to create cropped canvas context");

    croppedContext.drawImage(
      sourceBitmap,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      croppedCanvas.width,
      croppedCanvas.height,
    );

    const fittedCanvas = createCanvas(preRotationWidth, preRotationHeight);

    if (resize === "pica") {
      await pica.resize(croppedCanvas, fittedCanvas, {
        quality: 3,
        unsharpAmount: 80,
        unsharpRadius: 0.6,
        unsharpThreshold: 2,
      });
    } else {
      const fittedContext = get2dContext(fittedCanvas, "Failed to create fitted canvas context");

      fittedContext.imageSmoothingEnabled = true;
      fittedContext.imageSmoothingQuality = "high";
      fittedContext.drawImage(croppedCanvas, 0, 0, fittedCanvas.width, fittedCanvas.height);
    }

    if (!rect.rot) {
      return fittedCanvas;
    }

    const rotatedCanvas = createCanvas(targetWidthPx, targetHeightPx);
    const rotatedContext = get2dContext(rotatedCanvas, "Failed to create rotated canvas context");

    rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedContext.rotate(Math.PI / 2);
    rotatedContext.drawImage(fittedCanvas, -fittedCanvas.width / 2, -fittedCanvas.height / 2);

    return rotatedCanvas;
  } finally {
    sourceBitmap.close();
  }
}

async function embedCanvas(
  pdf: PDFDocument,
  canvas: HTMLCanvasElement,
  mimeType: "image/jpeg" | "image/png",
) {
  const blob = await pica.toBlob(
    canvas,
    mimeType,
    mimeType === "image/jpeg" ? JPEG_QUALITY : undefined,
  );
  const bytes = await blob.arrayBuffer();

  return mimeType === "image/png" ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

async function renderPageCanvas(
  bin: PackedImageBin,
  imagesById: Map<string, DownloadImage>,
  paper: PaperLayout,
) {
  const pageWidthPx = Math.max(1, Math.ceil(toInches(paper.width, paper.units) * EXPORT_DPI));
  const pageHeightPx = Math.max(1, Math.ceil(toInches(paper.height, paper.units) * EXPORT_DPI));
  const pageCanvas = createCanvas(pageWidthPx, pageHeightPx);
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
    const imageCanvas = await renderImageForRect(
      image,
      rect,
      targetWidthPx,
      targetHeightPx,
      "canvas",
    );
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
          JPEG_QUALITY,
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
  const output = new Blob([zipped], { type: "application/zip" });

  downloadBlob(output, "printable-photos.zip");
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
