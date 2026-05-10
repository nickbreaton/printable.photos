import { render } from "@solidjs/web";
import type { JSX } from "@solidjs/web";

import "./style.css";
import { Button } from "./components/Button";
import { Checkbox } from "./components/Checkbox";
import { downloadPdfFromCurrentLayout } from "./download";
import { FieldLabel } from "./components/FieldLabel";
import { Dialog } from "./components/Dialog";
import { FileInput } from "./components/FileInput";
import { Input } from "./components/Input";
import { Select } from "./components/Select";
import { ImagePreview } from "./components/ImagePreview";
import {
  computeInitialCrop,
  cropFromPercentages,
  getCropKey,
  getImageViewBoxWidth,
  cropToPercentages,
  type CropRect,
} from "./crop";
import {
  action,
  createMemo,
  For,
  Loading,
  createOptimistic,
  createSignal,
  Show,
  createEffect,
  snapshot,
  resolve,
} from "solid-js";
import { type ImageShape, type PaperSettings, type ProjectImage } from "./data";
import type { PackedImageRectangle } from "./layout";
import {
  addImages,
  bins,
  imageConfig,
  images,
  paper,
  projectImages,
  saveImageCrop,
  setImageConfig,
  setPaper,
} from "./state";

function toPercent(value: number, total: number) {
  return (value / total) * 100 + "%";
}

function getPhotoStyle(
  rect: PackedImageRectangle,
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

function getCroppedImageStyle(
  image: ProjectImage,
  rect: PackedImageRectangle,
): JSX.CSSProperties {
  const cropKey = getCropKey(rect);
  const savedCrop = image.crops?.[cropKey];
  const crop = savedCrop
    ? cropFromPercentages(savedCrop, image.width, image.height)
    : computeInitialCrop(image.width, image.height, rect);
  const viewBoxWidth = getImageViewBoxWidth(image.width, image.height);

  return {
    position: "absolute",
    top: `${(-crop.y / crop.height) * 100}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    width: `${(viewBoxWidth / crop.width) * 100}%`,
    height: `${(100 / crop.height) * 100}%`,
  };
}

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

const selectedPaperPreset = createMemo(() => {
  const matchingPreset = ALL_PAPER_PRESETS.find((preset) => {
    return preset.width === paper().width && preset.height === paper().height;
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

              setPaper({
                width: selectedPreset.width,
                height: selectedPreset.height,
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
            value={paper().width}
            onChange={(e) => setPaper({ width: e.target.valueAsNumber })}
          />
        </FieldLabel>
        <FieldLabel>
          Height
          <Input
            type="number"
            step={1}
            value={paper().height}
            onChange={(e) => setPaper({ height: e.target.valueAsNumber })}
          />
        </FieldLabel>
        <FieldLabel>
          Margin
          <Input
            type="number"
            step={0.25}
            value={paper().margin}
            onChange={(e) => setPaper({ margin: e.target.valueAsNumber })}
          />
        </FieldLabel>
        <FieldLabel>
          Gap
          <Input
            type="number"
            step={0.25}
            value={paper().gap}
            onChange={(e) => setPaper({ gap: e.target.valueAsNumber })}
          />
        </FieldLabel>
        <FieldLabel>
          Units
          <Select
            value={paper().units}
            onChange={(e) =>
              setPaper({ units: e.target.value as PaperSettings["units"] })
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
            checked={paper().allowRotation}
            onChange={(e) => setPaper({ allowRotation: e.target.checked })}
          />
          Allow rotation
        </label>
      </fieldset>
      <fieldset class="flex flex-col gap-3 border-t border-border pt-5">
        <FieldLabel>
          Image shape
          <Select
            value={imageConfig().shape}
            onChange={(e) =>
              setImageConfig({ shape: e.target.value as ImageShape })
            }
          >
            <option value="original">Original</option>
            <option value="square">Square</option>
          </Select>
        </FieldLabel>
        <FieldLabel>
          Image width
          <Input
            type="number"
            step={1}
            value={imageConfig().width}
            onChange={(e) => setImageConfig({ width: e.target.valueAsNumber })}
          />
        </FieldLabel>
      </fieldset>
      <fieldset class="border-t border-border pt-5">
        <FileInput
          multiple
          disabled={saving()}
          onChange={action(function* (event) {
            setSaving(true);

            const files = event.target.files;
            if (!files) {
              return;
            }
            yield addImages(files);

            // Hold until fully refreshed so UI doesnt tear resetting DOM directly
            // yield resolve(() => Object.keys(bins));
            event.target.value = "";
          })}
        />
      </fieldset>
      <Button
        type="button"
        disabled={downloading()}
        onClick={action(function* () {
          setDownloading(true);
          yield downloadPdfFromCurrentLayout({
            bins: [...bins],
            paper: paper(),
            images: [...snapshot(projectImages)],
          });
        })}
      >
        Download PDF
      </Button>
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
  const [dialogRef, setDialogRef] = createSignal<HTMLDialogElement>();
  const [selectedCrop, setSelectedCrop] = createSignal<PackedImageRectangle>();
  const [crop, setCrop] = createSignal<CropRect>();
  const selectedImage = createMemo(() => {
    const imageId = selectedCrop()?.data.id;

    if (!imageId) return undefined;

    return projectImages.find((image) => image.id === imageId);
  });

  function openCropDialog(sc: PackedImageRectangle) {
    const img = projectImages.find((image) => image.id === sc.data.id);

    if (!img) return;

    const cropKey = getCropKey(sc);
    const savedCrop = img.crops?.[cropKey];
    const nextCrop = savedCrop
      ? cropFromPercentages(savedCrop, img.width, img.height)
      : computeInitialCrop(img.width, img.height, sc);

    setCrop(nextCrop);
    setSelectedCrop(sc);
  }

  async function saveSelectedCrop() {
    const sc = selectedCrop();
    const c = crop();
    const image = selectedImage();

    if (!sc || !c || !image) return;

    await saveImageCrop(
      image.id,
      getCropKey(sc),
      cropToPercentages(c, image.width, image.height),
    );
    await resolve(() => projectImages.find((image) => image.id));
    dialogRef()?.close();
  }

  createEffect(
    () => {
      const sc = selectedCrop();
      const dialog = dialogRef();

      if (!sc || !dialog) return undefined;

      return dialog;
    },
    (dialog) => {
      if (!dialog || dialog.open) return;

      dialog.showModal();
    },
  );

  return (
    <>
      <Dialog
        ref={setDialogRef}
        class="h-[calc(100dvh-2.5rem)] w-[calc(100vw-2.5rem)] max-w-fit grid-rows-[minmax(0,1fr)_auto]"
        onClose={() => {
          setSelectedCrop();
          setCrop();
        }}
      >
        <Show when={selectedCrop()}>
          {(sc) => (
            <Show when={selectedImage()}>
              {(image) => (
                <Show when={crop()}>
                  {(c) => (
                    <>
                      <div class="grid min-h-0 min-w-0 place-items-center overflow-visible p-2">
                        <ImagePreview
                          image={image()}
                          currentCrop={sc()}
                          crop={c()}
                          onCropChange={setCrop}
                          onCropDone={saveSelectedCrop}
                        />
                      </div>
                      <div class="flex items-center justify-end gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => dialogRef()?.close()}
                        >
                          Cancel
                        </Button>
                        <Button type="button" onClick={saveSelectedCrop}>
                          Done
                        </Button>
                      </div>
                    </>
                  )}
                </Show>
              )}
            </Show>
          )}
        </Show>
      </Dialog>
      <div class="flex flex-col gap-5">
        <For each={bins}>
          {(bin) => (
            <div
              class={`relative mx-auto w-full overflow-hidden min-w-3xs ${cardSurfaceClass}`}
              style={{
                "aspect-ratio": paper().width / paper().height,
                "max-width": `${paper().width}${paper().units}`,
              }}
            >
              <For each={bin().rects}>
                {(rect) => (
                  <button
                    type="button"
                    class="group/photo relative block overflow-hidden border-0 bg-transparent p-0 outline-0 hover:opacity-80 dark:hover:opacity-70 focus-visible:outline-[4px] focus-visible:outline-ring/50 focus-visible:opacity-95"
                    style={getPhotoStyle(rect(), paper())}
                    title="Open image dialog"
                    onClick={() => openCropDialog(rect())}
                  >
                    <Show
                      when={images().find(
                        (image) => image.id === rect().data.id,
                      )}
                    >
                      {(image) => (
                        <AsyncImage
                          class="block max-w-none visible [dynamic-range-limit:standard] select-none"
                          style={getCroppedImageStyle(image(), rect())}
                          src={image().url}
                          draggable="false"
                        />
                      )}
                    </Show>
                  </button>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </>
  );
}

function App() {
  return (
    <>
      <Loading>
        <div class="relative z-0 flex items-start gap-5">
          <Sidebar />
          <main class="min-w-0 flex-1">
            <Pages />
          </main>
        </div>
      </Loading>
    </>
  );
}

render(() => <App />, document.getElementById("root")!);
