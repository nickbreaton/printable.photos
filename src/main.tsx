import { render } from "@solidjs/web";
import type { JSX } from "@solidjs/web";

import "./style.css";
import { Checkbox } from "./components/Checkbox";
import { downloadPdfFromCurrentLayout } from "./download";
import { FieldLabel } from "./components/FieldLabel";
import { Dialog } from "./components/Dialog";
import { FileInput } from "./components/FileInput";
import { Input } from "./components/Input";
import { Select } from "./components/Select";
import { Trash2 } from "lucide-static";
import {
  action,
  createMemo,
  For,
  Loading,
  onCleanup,
  refresh,
  createOptimistic,
  createProjection,
  snapshot,
  mapArray,
} from "solid-js";
import { MaxRectsPacker, type Rectangle } from "maxrects-packer";
import {
  db,
  type ImageShape,
  type ImageSettings,
  type PaperSettings,
  type Project,
  type ProjectImage,
} from "./data";
import { createPreviewBlob } from "./utils";

const PREVIEW_DPI = 160;
const MAX_PREVIEW_EDGE_PX = 1600;

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

const project = createProjection((): Promise<Project> => {
  return db.table("projects").get("DEFAULT");
}, {} as Project);

const paper = createMemo(() => {
  return project.settings.paper;
});

const setPaper = action(function* (newPaper: Partial<PaperSettings>) {
  const nestedUpdateEntries = Object.entries(newPaper).map(([key, value]) => [
    `settings.paper.${key}`,
    value,
  ]);
  const promisish = db
    .table("projects")
    .update("DEFAULT", Object.fromEntries(nestedUpdateEntries));
  yield Promise.resolve(promisish);
  refresh(project);
});

const imageConfig = createMemo(() => {
  return project.settings.image;
});

const setImageConfig = action(function* (
  newImageConfig: Partial<ImageSettings>,
) {
  const nestedUpdateEntries = Object.entries(newImageConfig).map(
    ([key, value]) => [`settings.image.${key}`, value],
  );
  const promisish = db
    .table("projects")
    .update("DEFAULT", Object.fromEntries(nestedUpdateEntries));
  yield Promise.resolve(promisish);
  refresh(project);
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

interface ImageRef extends ProjectImage {
  url: string;
}

const projectImages = createProjection(async (): Promise<ProjectImage[]> => {
  if (!project.id) {
    return [];
  }

  return db.images.where("projectId").equals(project.id).sortBy("order");
}, []);

const images = mapArray<ProjectImage, ImageRef>(
  () => projectImages,
  (image) => {
    const blob = snapshot(image().previewBlob ?? image().blob);
    const blobUrl = URL.createObjectURL(blob);

    onCleanup(() => URL.revokeObjectURL(blobUrl));

    return { ...image(), url: blobUrl };
  },
  { keyed: (image) => image.id },
);

const addImages = action(function* (files: FileList) {
  const nextImages: ProjectImage[] = [];
  const currentProjectId = snapshot(project.id);
  const currentImages = snapshot(projectImages);
  const nextOrder =
    currentImages.reduce((maxOrder: number, image: ProjectImage) => {
      return Math.max(maxOrder, image.order);
    }, -1) + 1;
  const paperMaxInches =
    paper().units === "mm"
      ? Math.max(paper().width, paper().height) / 25.4
      : Math.max(paper().width, paper().height);
  const maxPreviewEdgePx = Math.min(
    MAX_PREVIEW_EDGE_PX,
    Math.ceil(paperMaxInches * PREVIEW_DPI),
  );

  for (const file of files) {
    const url = URL.createObjectURL(snapshot(file));
    const img = yield createImage(url);
    URL.revokeObjectURL(url);
    const previewBlob = yield createPreviewBlob(file, img, maxPreviewEdgePx);
    const now = Date.now();

    nextImages.push({
      id: crypto.randomUUID(),
      projectId: currentProjectId,
      order: nextOrder + nextImages.length,
      name: file.name,
      type: file.type,
      width: img.width,
      height: img.height,
      blob: file,
      previewBlob,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (nextImages.length === 0) {
    return;
  }

  const promisish = db.transaction("rw", db.projects, db.images, async () => {
    await db.images.bulkAdd(nextImages);
  });
  yield Promise.resolve(promisish);
  refresh(projectImages);
  refresh(project);
});

const deleteImage = action(function* (imageId: string) {
  const promisish = db.transaction("rw", db.projects, db.images, async () => {
    await db.images.delete(imageId);
  });
  yield Promise.resolve(promisish);
  refresh(projectImages);
  refresh(project);
});

function packImages(imageList: ImageRef[], allowRotation: boolean) {
  const packer = new MaxRectsPacker(
    paper().width,
    paper().height,
    paper().gap,
    {
      border: paper().margin,
      pot: false,
      square: false,
      allowRotation,
    },
  );

  for (const image of imageList) {
    const aspectRatio = image.height / image.width;
    const height =
      imageConfig().shape === "square"
        ? imageConfig().width
        : imageConfig().width * aspectRatio;
    packer.add(imageConfig().width, height, image);
  }

  return packer.bins;
}

const bins = createProjection(() => {
  const imageList = images();
  const unrotatedBins = packImages(imageList, false);

  if (!paper().allowRotation) {
    return unrotatedBins;
  }

  const rotatedBins = packImages(imageList, true);

  if (rotatedBins.length < unrotatedBins.length) {
    return rotatedBins;
  }

  return unrotatedBins;
}, []);

const selectedPaperPreset = createMemo(() => {
  const matchingPreset = ALL_PAPER_PRESETS.find((preset) => {
    return preset.width === paper().width && preset.height === paper().height;
  });

  return matchingPreset?.value ?? "Custom";
});

const Icon = (props: { icon: string; size?: number }) => {
  return (
    <span style={{ scale: props.size ?? 16 / 24 }} innerHTML={props.icon} />
  );
};

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
      <button
        type="button"
        class="border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        disabled={downloading()}
        onClick={action(function* () {
          setDownloading(true);
          yield downloadPdfFromCurrentLayout({
            bins: [...bins],
            paper: paper(),
          });
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
  let dialogRef: HTMLDialogElement;

  return (
    <>
      <Dialog ref={(el) => (dialogRef = el)}>
        <p class="text-sm text-muted-foreground">test</p>
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
                    class="group/photo block overflow-hidden border-0 bg-transparent p-0 outline-0 transition-[outline-color,outline-width,opacity] hover:outline-[4px] hover:outline-ring/50 hover:opacity-95 focus-visible:outline-[4px] focus-visible:outline-ring/50 focus-visible:opacity-95"
                    style={getPhotoStyle(rect(), paper())}
                    title="Open image dialog"
                    onClick={() => dialogRef.showModal()}
                  >
                    <AsyncImage
                      class="block size-full object-cover visible [dynamic-range-limit:standard] select-none"
                      src={rect().data.url}
                      draggable="false"
                    />
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
