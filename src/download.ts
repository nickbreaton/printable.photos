import type { MaxRectsBin, Rectangle } from "maxrects-packer";
import picaFactory from "pica";
import { PDFDocument } from "pdf-lib";

export interface StoredImage {
  file: File;
  width: number;
  height: number;
  name: string;
}

interface PaperLayout {
  width: number;
  height: number;
  units: "in" | "mm";
}

interface DownloadPdfFromCurrentLayoutOptions {
  bins: MaxRectsBin<Rectangle>[];
  paper: PaperLayout;
}

export async function downloadPdfFromCurrentLayout(
  options: DownloadPdfFromCurrentLayoutOptions,
) {
  const toInches = (value: number) => {
    if (options.paper.units === "mm") {
      return value / 25.4;
    }

    return value;
  };

  const pdf = await PDFDocument.create();
  const pica = picaFactory();

  for (const bin of options.bins) {
    const pageWidthPt = toInches(options.paper.width) * 72;
    const pageHeightPt = toInches(options.paper.height) * 72;
    const page = pdf.addPage([pageWidthPt, pageHeightPt]);

    for (const rect of bin.rects) {
      const { file } = rect.data as StoredImage;

      const placedWidthInches = toInches(rect.width);
      const placedHeightInches = toInches(rect.height);
      const targetPxW = Math.max(1, Math.ceil(placedWidthInches * 300));
      const targetPxH = Math.max(1, Math.ceil(placedHeightInches * 300));

      const sourceBitmap = await createImageBitmap(file);

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = sourceBitmap.width;
      sourceCanvas.height = sourceBitmap.height;
      const sourceContext = sourceCanvas.getContext("2d");
      if (!sourceContext) {
        sourceBitmap.close();
        throw new Error("Failed to create source canvas context");
      }
      sourceContext.drawImage(sourceBitmap, 0, 0);
      sourceBitmap.close();

      const fitTargetPxW = rect.rot ? targetPxH : targetPxW;
      const fitTargetPxH = rect.rot ? targetPxW : targetPxH;
      const coverScale = Math.max(
        fitTargetPxW / sourceCanvas.width,
        fitTargetPxH / sourceCanvas.height,
      );
      const cropPxW = Math.max(
        1,
        Math.min(sourceCanvas.width, Math.round(fitTargetPxW / coverScale)),
      );
      const cropPxH = Math.max(
        1,
        Math.min(sourceCanvas.height, Math.round(fitTargetPxH / coverScale)),
      );
      const cropOffsetX = Math.floor((sourceCanvas.width - cropPxW) / 2);
      const cropOffsetY = Math.floor((sourceCanvas.height - cropPxH) / 2);

      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropPxW;
      croppedCanvas.height = cropPxH;
      const croppedContext = croppedCanvas.getContext("2d");
      if (!croppedContext) {
        throw new Error("Failed to create cropped canvas context");
      }
      croppedContext.drawImage(
        sourceCanvas,
        cropOffsetX,
        cropOffsetY,
        cropPxW,
        cropPxH,
        0,
        0,
        cropPxW,
        cropPxH,
      );

      const fitPxW = Math.max(1, Math.min(cropPxW, fitTargetPxW));
      const fitPxH = Math.max(1, Math.min(cropPxH, fitTargetPxH));
      const fitCanvas = document.createElement("canvas");
      fitCanvas.width = fitPxW;
      fitCanvas.height = fitPxH;

      await pica.resize(croppedCanvas, fitCanvas, {
        quality: 3,
        unsharpAmount: 80,
        unsharpRadius: 0.6,
        unsharpThreshold: 2,
      });

      let pdfImageCanvas = fitCanvas;
      if (rect.rot) {
        const rotatedCanvas = document.createElement("canvas");
        rotatedCanvas.width = fitCanvas.height;
        rotatedCanvas.height = fitCanvas.width;
        const rotatedContext = rotatedCanvas.getContext("2d");
        if (!rotatedContext) {
          throw new Error("Failed to create rotated canvas context");
        }

        rotatedContext.translate(
          rotatedCanvas.width / 2,
          rotatedCanvas.height / 2,
        );
        rotatedContext.rotate(Math.PI / 2);
        rotatedContext.drawImage(
          fitCanvas,
          -fitCanvas.width / 2,
          -fitCanvas.height / 2,
        );
        pdfImageCanvas = rotatedCanvas;
      }

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const resizedBlob = await pica.toBlob(
        pdfImageCanvas,
        mimeType,
        mimeType === "image/jpeg" ? 0.92 : undefined,
      );
      const resizedBytes = await resizedBlob.arrayBuffer();
      const embeddedImage =
        mimeType === "image/png"
          ? await pdf.embedPng(resizedBytes)
          : await pdf.embedJpg(resizedBytes);

      const rectXPt = toInches(rect.x) * 72;
      const rectYPt =
        pageHeightPt - (toInches(rect.y) + placedHeightInches) * 72;
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

  const url = URL.createObjectURL(output);

  window.open(url, "_blank");
}
