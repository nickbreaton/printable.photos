import { render } from "@solidjs/web";
import localforage from "localforage";
import picaFactory from "pica";
import { PDFDocument } from "pdf-lib";

import "./style.css";
import { Checkbox } from "./components/Checkbox";
import { FieldLabel } from "./components/FieldLabel";
import { FileInput } from "./components/FileInput";
import { Input } from "./components/Input";
import { Select } from "./components/Select";
import {
  action,
  createMemo,
  createStore,
  For,
  isPending,
  Loading,
  onCleanup,
  refresh,
  createOptimistic,
  type JSX,
  createProjection,
} from "solid-js";
import { MaxRectsPacker, type Rectangle } from "maxrects-packer";

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
  return await localforage.keys();
});

interface StoredImage {
  file: File;
  width: number;
  height: number;
  name: string;
}

interface ImageRef {
  url: string;
  width: number;
  height: number;
  name: string;
}

const imageBlobs = createMemo<StoredImage[]>(async () => {
  const promises = imageKeys().map((key) => {
    return localforage.getItem<StoredImage>(key);
  });
  const storedImages = await Promise.all(promises);

  return storedImages.filter((image): image is StoredImage => image !== null);
});

const images = createMemo<ImageRef[]>(() => {
  return imageBlobs().map((image) => {
    const { file, ...props } = image;
    const blobUrl = URL.createObjectURL(file);

    onCleanup(() => URL.revokeObjectURL(blobUrl));

    return { url: blobUrl, ...props };
  });
});

function packImages(imageList: ImageRef[], allowRotation: boolean) {
  const packer = new MaxRectsPacker(paper.width, paper.height, paper.gap, {
    border: paper.margin,
    smart: false,
    pot: false,
    square: false,
    allowRotation,
  });

  for (const image of imageList) {
    const aspectRatio = image.height / image.width;
    const proportionalHeight = imageConfig.width * aspectRatio;
    packer.add(imageConfig.width, proportionalHeight, image);
  }

  return packer.bins;
}

const bins = createProjection(async () => {
  const imageList = images();
  const unrotatedBins = packImages(imageList, false);

  if (!paper.allowRotation) {
    return unrotatedBins;
  }

  const rotatedBins = packImages(imageList, true);

  if (rotatedBins.length < unrotatedBins.length) {
    return rotatedBins;
  }

  return unrotatedBins;
}, []);

async function downloadPdfFromCurrentLayout() {
  const toInches = (value: number) => {
    if (paper.units === "mm") {
      return value / 25.4;
    }

    return value;
  };

  const pdf = await PDFDocument.create();
  const pica = picaFactory();

  for (const bin of bins) {
    const pageWidthPt = toInches(paper.width) * 72;
    const pageHeightPt = toInches(paper.height) * 72;
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

const selectedPaperPreset = createMemo(() => {
  const matchingPreset = ALL_PAPER_PRESETS.find((preset) => {
    return preset.width === paper.width && preset.height === paper.height;
  });

  return matchingPreset?.value ?? "Custom";
});

const cardSurfaceClass =
  "bg-card text-card-foreground shadow-sm ring-1 ring-foreground/10";

function Sidebar() {
  const [saving, setSaving] = createOptimistic(false);
  const [downloading, setDownloading] = createOptimistic(false);

  return (
    <aside
      class={`sticky top-5 flex max-h-[calc(100vh-2.5rem)] w-72 shrink-0 flex-col gap-5 overflow-auto p-5 ${cardSurfaceClass}`}
    >
      <fieldset class="flex flex-col gap-3">
        <FieldLabel>
          Paper
          <Select
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
          </Select>
        </FieldLabel>
        <FieldLabel>
          Width
          <Input
            type="number"
            step={1}
            value={paper.width}
            onChange={(e) =>
              setPaper((paper) => void (paper.width = e.target.valueAsNumber))
            }
          />
        </FieldLabel>
        <FieldLabel>
          Height
          <Input
            type="number"
            step={1}
            value={paper.height}
            onChange={(e) =>
              setPaper((paper) => void (paper.height = e.target.valueAsNumber))
            }
          />
        </FieldLabel>
        <FieldLabel>
          Margin
          <Input
            type="number"
            step={0.25}
            value={paper.margin}
            onChange={(e) =>
              setPaper((paper) => void (paper.margin = e.target.valueAsNumber))
            }
          />
        </FieldLabel>
        <FieldLabel>
          Gap
          <Input
            type="number"
            step={0.25}
            value={paper.gap}
            onChange={(e) =>
              setPaper((paper) => void (paper.gap = e.target.valueAsNumber))
            }
          />
        </FieldLabel>
        <FieldLabel>
          Units
          <Select
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
          </Select>
        </FieldLabel>
        <label class="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={paper.allowRotation}
            onChange={(e) =>
              setPaper((paper) => void (paper.allowRotation = e.target.checked))
            }
          />
          Allow rotation
        </label>
      </fieldset>
      <fieldset class="flex flex-col gap-3 border-t border-border pt-5">
        <FieldLabel>
          Image width
          <Input
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
        </FieldLabel>
      </fieldset>
      <fieldset class="border-t border-border pt-5">
        <FileInput
          multiple
          disabled={isPending(imageKeys) || saving()}
          onChange={action(function* (event) {
            setSaving(true);

            const files = event.target.files ?? [];

            // TODO: concurrency
            for (const file of files) {
              const url = URL.createObjectURL(file);
              const img = yield createImage(url);
              const width = img.width;
              const height = img.height;
              const name = file.name;
              yield localforage.setItem<StoredImage>(crypto.randomUUID(), {
                file,
                width,
                height,
                name,
              });
            }

            refresh(imageKeys);

            // Hold until fully refreshed so UI doesnt tear resetting DOM directly
            // yield resolve(() => Object.keys(bins));
            event.target.value = "";
          })}
        />
      </fieldset>
      <button
        type="button"
        class="border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        disabled={downloading()}
        onClick={action(function* () {
          setDownloading(true);
          yield downloadPdfFromCurrentLayout();
        })}
      >
        Download PDF
      </button>
    </aside>
  );
}

function AsyncImage(props: JSX.ImgHTMLAttributes<HTMLImageElement>) {
  const src = createMemo(async () => {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve(img.src);
        img.remove();
      };
      img.onerror = reject;
      if (props.src) img.src = props.src;
      img.hidden = true;
      document.head.append(img);
    });
  });

  return <img {...props} src={src()} />;
}

function Pages() {
  return (
    <div class="flex flex-col gap-5">
      <For each={bins}>
        {(bin) => (
          <div
            class={`relative mx-auto w-full overflow-hidden ${cardSurfaceClass}`}
            style={{
              "aspect-ratio": paper.width / paper.height,
              "max-width": `${paper.width}${paper.units}`,
            }}
          >
            <For each={bin().rects}>
              {(rect) => (
                <AsyncImage
                  class="block object-cover visible [dynamic-range-limit:standard]"
                  src={rect().data.url}
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
      <div class="pointer-events-none fixed inset-0 bg-muted" />
      <style>
        {
          /* css */ `
          @page {
            size: ${paper.width}${paper.units} ${paper.height}${paper.units};
            margin: 0;
          }`
        }
      </style>
      <div class="relative z-0 flex items-start gap-5">
        <Sidebar />
        <main class="min-w-0 flex-1">
          <Pages />
        </main>
      </div>
    </Loading>
  );
}

render(() => <App />, document.getElementById("root")!);
