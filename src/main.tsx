import { render } from "@solidjs/web";
import picaFactory from "pica";
import { PDFDocument } from "pdf-lib";

import "./style.css";
import { createMemo, createStore, For, Loading, type JSX } from "solid-js";
import { MaxRectsPacker, type Rectangle } from "maxrects-packer";

// @ts-ignore
const lf: any = window.localforage;

function toPercent(value: number, total: number) {
  return (value / total) * 100 + "%";
}

function getPhotoStyle(
  rect: Rectangle,
  paper: { width: number; height: number },
): JSX.CSSProperties {
  if (!rect.rot) {
    return {
      position: "absolute",
      top: toPercent(rect.y, paper.height),
      left: toPercent(rect.x, paper.width),
      width: toPercent(rect.width, paper.width),
      height: toPercent(rect.height, paper.height),
    };
  }

  return {
    position: "absolute",
    top: toPercent(rect.y + rect.height / 2, paper.height),
    left: toPercent(rect.x + rect.width / 2, paper.width),
    width: toPercent(rect.height, paper.width),
    height: toPercent(rect.width, paper.height),
    transform: "translate(-50%, -50%) rotate(90deg)",
    "transform-origin": "center",
  };
}

function createImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

const [paper, setPaper] = createStore({
  width: 8.5,
  height: 11,
  margin: 0.25,
  gap: 0.25,
  units: "in",
  allowRotation: false,
});

const [imageConfig, setImageConfig] = createStore({
  width: 3,
});

const PAPER_PRESETS = {
  Photos: [
    { label: "4x6", value: "4x6", width: 4, height: 6 },
    { label: "5x7", value: "5x7", width: 5, height: 7 },
    { label: "8x10", value: "8x10", width: 8, height: 10 },
  ],
  Paper: [
    { label: "Letter", value: "Letter", width: 8.5, height: 11 },
    { label: "Legal", value: "Legal", width: 8.5, height: 14 },
    { label: "Tabloid", value: "Tabloid", width: 11, height: 17 },
  ],
} as const;

const ALL_PAPER_PRESETS = Object.values(PAPER_PRESETS).flat();

const imageKeys = createMemo<string[]>(async () => {
  return await lf.keys();
});

const images = createMemo<{ file: File }[]>(async () => {
  const promises = imageKeys().map((key) => {
    return lf.getItem(key);
  });
  return Promise.all(promises);
});

const bins = createMemo(async () => {
  const packer = new MaxRectsPacker(paper.width, paper.height, paper.gap, {
    border: paper.margin,
    smart: false,
    pot: false,
    square: false,
    // TODO: when config has allowRotation run both paths and see if page count is still the same.
    // If so prefer the path without rotation.
    allowRotation: paper.allowRotation,
  });

  const addImage = (image: HTMLImageElement) => {
    const aspectRatio = image.height / image.width;
    const proportionalHeight = imageConfig.width * aspectRatio;
    packer.add(imageConfig.width, proportionalHeight, { src: image.src });
  };

  for (const image of images()) {
    // TODO: probably creat ethe html element somewhere else / pass in limited props
    const url = URL.createObjectURL(image.file);
    const element = await createImage(url);
    addImage(element);
  }

  return packer.bins;
});

async function downloadPdfFromCurrentLayout() {
  const toInches = (value: number) => {
    if (paper.units === "mm") {
      return value / 25.4;
    }

    return value;
  };

  const pdf = await PDFDocument.create();
  const pica = picaFactory();

  for (const bin of bins()) {
    const pageWidthPt = toInches(paper.width) * 72;
    const pageHeightPt = toInches(paper.height) * 72;
    const page = pdf.addPage([pageWidthPt, pageHeightPt]);

    for (const rect of bin.rects) {
      const src = rect.data.src as string;

      const response = await fetch(src);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${src}`);
      }

      const placedWidthInches = toInches(rect.width);
      const placedHeightInches = toInches(rect.height);
      const targetPxW = Math.max(1, Math.ceil(placedWidthInches * 300));
      const targetPxH = Math.max(1, Math.ceil(placedHeightInches * 300));

      const blob = await response.blob();
      const sourceBitmap = await createImageBitmap(blob);

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

      const mimeType = blob.type === "image/png" ? "image/png" : "image/jpeg";
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

  URL.revokeObjectURL(url);
}

const selectedPaperPreset = createMemo(() => {
  const matchingPreset = ALL_PAPER_PRESETS.find((preset) => {
    return preset.width === paper.width && preset.height === paper.height;
  });

  return matchingPreset?.value ?? "Custom";
});

function Sidebar() {
  return (
    <>
      <fieldset>
        <label>
          Paper:{" "}
          <select
            value={selectedPaperPreset()}
            onChange={(e) => {
              const selectedPreset = ALL_PAPER_PRESETS.find(
                (preset) => preset.value === e.target.value,
              );

              if (!selectedPreset) {
                return;
              }

              setPaper((paper) => {
                paper.width = selectedPreset.width;
                paper.height = selectedPreset.height;
              });
            }}
          >
            <option value="Custom">Custom</option>
            <For each={Object.entries(PAPER_PRESETS)}>
              {(group) => (
                <optgroup label={group()[0]}>
                  <For each={group()[1]}>
                    {(preset) => (
                      <option value={preset().value}>{preset().label}</option>
                    )}
                  </For>
                </optgroup>
              )}
            </For>
          </select>
        </label>
        <label>
          Width:{" "}
          <input
            type="number"
            step={1}
            value={paper.width}
            onChange={(e) =>
              setPaper((paper) => void (paper.width = e.target.valueAsNumber))
            }
          />
        </label>
        <label>
          Height:{" "}
          <input
            type="number"
            step={1}
            value={paper.height}
            onChange={(e) =>
              setPaper((paper) => void (paper.height = e.target.valueAsNumber))
            }
          />
        </label>
        <label>
          Margin:{" "}
          <input
            type="number"
            step={0.25}
            value={paper.margin}
            onChange={(e) =>
              setPaper((paper) => void (paper.margin = e.target.valueAsNumber))
            }
          />
        </label>
        <label>
          Gap:{" "}
          <input
            type="number"
            step={0.25}
            value={paper.gap}
            onChange={(e) =>
              setPaper((paper) => void (paper.gap = e.target.valueAsNumber))
            }
          />
        </label>
        <label>
          Units:{" "}
          <select
            value={paper.units}
            onChange={(e) =>
              setPaper(
                (paper) => void (paper.units = e.target.value as "in" | "mm"),
              )
            }
            disabled={
              true /* keep as inches until doing something smart for keeping same size but different units on selection */
            }
          >
            <option value="in">Inches</option>
            <option value="mm">Millimeters</option>
          </select>
        </label>
        <label style={{ "white-space": "nowrap" }}>
          <input
            type="checkbox"
            checked={paper.allowRotation}
            onChange={(e) =>
              setPaper((paper) => void (paper.allowRotation = e.target.checked))
            }
          />
          Allow rotation
        </label>
      </fieldset>
      <fieldset>
        <label>
          Image width:{" "}
          <input
            type="number"
            step={1}
            value={imageConfig.width}
            onChange={(e) =>
              setImageConfig(
                (imageConfig) =>
                  void (imageConfig.width = e.target.valueAsNumber),
              )
            }
          />
        </label>
      </fieldset>
      <fieldset>
        <input
          type="file"
          onChange={async (event) => {
            const file = event.target.files?.[0];

            if (file) {
              await lf.setItem(crypto.randomUUID(), { file });
            }

            event.target.value = "";
          }}
        />
      </fieldset>
      <button
        type="button"
        class="download-button"
        onClick={() => {
          void downloadPdfFromCurrentLayout().catch((error: unknown) => {
            console.error("PDF export failed", error);
          });
        }}
      >
        Download PDF
      </button>
    </>
  );
}

function Pages() {
  return (
    <div class="pages">
      <For each={bins()}>
        {(bin) => (
          <div
            class="page"
            style={{
              "aspect-ratio": paper.width / paper.height,
              "max-width": paper.width + paper.units,
            }}
          >
            <For each={bin().rects}>
              {(rect) => (
                <img
                  class="photo"
                  src={rect().data.src}
                  style={getPhotoStyle(rect(), paper)}
                />
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}

function App() {
  return (
    <Loading>
      <style>
        {
          /* css */ `
          @page {
            size: ${paper.width}${paper.units} ${paper.height}${paper.units};
            margin: 0;
          }`
        }
      </style>
      <Sidebar />
      <Pages />
    </Loading>
  );
}

render(() => <App />, document.getElementById("root")!);
