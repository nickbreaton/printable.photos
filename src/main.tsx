import { render } from "@solidjs/web";
import type { JSX } from "@solidjs/web";

import "./style.css";
import { Button } from "./components/Button";
import { Checkbox } from "./components/Checkbox";
import { downloadPdfFromCurrentLayout } from "./download/pdf";
import { downloadPhotosFromCurrentLayout } from "./download/photos";
import { FieldLabel } from "./components/FieldLabel";
import { Dialog } from "./components/Dialog";
import { Dropdown } from "./components/Dropdown";
import { FileInput } from "./components/FileInput";
import { Input } from "./components/Input";
import { Select } from "./components/Select";
import { SectionHeader } from "./components/SectionHeader";
import { ImagePreview } from "./components/ImagePreview";
import { Icon } from "./components/Icon";
import { FileSpreadsheet, Plus, Settings, Trash2 } from "lucide-static";
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
import { type ImageShape, type ProjectImage } from "./data";
import type { PackedImageRectangle } from "./layout";
import {
  addImages,
  bins,
  imageConfig,
  images,
  paper,
  project,
  projectImages,
  projects,
  createProject,
  deleteImage,
  deleteProject,
  renameProject,
  saveImageCrop,
  setImageConfig,
  setPaper,
  projectId,
  selectProject,
} from "./state";
import { Fonts } from "./components/Fonts";

function toPercent(value: number, total: number) {
  return (value / total) * 100 + "%";
}

function getPhotoStyle(
  packedRect: PackedImageRectangle,
  paper: { width: number; height: number },
): JSX.CSSProperties {
  if (!packedRect.rot) {
    return {
      position: "absolute",
      top: toPercent(packedRect.y, paper.height),
      left: toPercent(packedRect.x, paper.width),
      width: toPercent(packedRect.width, paper.width),
      height: toPercent(packedRect.height, paper.height),
    };
  }

  return {
    position: "absolute",
    top: toPercent(packedRect.y + packedRect.height / 2, paper.height),
    left: toPercent(packedRect.x + packedRect.width / 2, paper.width),
    width: toPercent(packedRect.height, paper.width),
    height: toPercent(packedRect.width, paper.height),
    transform: "translate(-50%, -50%) rotate(90deg)",
    "transform-origin": "center",
  };
}

function getCroppedImageStyle(
  image: ProjectImage,
  packedRect: PackedImageRectangle,
): JSX.CSSProperties {
  const cropKey = getCropKey(packedRect);
  const savedCrop = image.crops?.[cropKey];
  const crop = savedCrop
    ? cropFromPercentages(savedCrop, image.width, image.height)
    : computeInitialCrop(image.width, image.height, packedRect);
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

const cardSurfaceClass = "bg-background text-card-foreground shadow-sm ring-1 ring-foreground/10";

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function Sidebar() {
  const [saving, setSaving] = createOptimistic(false);

  return (
    <aside class="flex max-h-[calc(100vh-2.5rem)] w-80 shrink-0 flex-col gap-5 overflow-auto p-5 pt-0">
      <fieldset class="grid grid-cols-2 gap-x-3 gap-y-5 border-t border-border pt-5">
        <SectionHeader class="col-span-2">Page layout</SectionHeader>
        <FieldLabel class="col-span-2">
          Preset
          <Select
            value={selectedPaperPreset()}
            onChange={(event) => {
              const selectedPreset = ALL_PAPER_PRESETS.find(
                (preset) => preset.value === event.target.value,
              );

              if (!selectedPreset) {
                return;
              }

              void setPaper({
                width: selectedPreset.width,
                height: selectedPreset.height,
              });
            }}
          >
            <option value="Custom">Custom</option>
            <For each={Object.entries(PAPER_PRESETS)}>
              {(group) => (
                <optgroup label={group[0]}>
                  <For each={group[1]}>
                    {(preset) => <option value={preset.value}>{preset.label}</option>}
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
            onChange={(event) => setPaper({ width: event.target.valueAsNumber })}
          />
        </FieldLabel>
        <FieldLabel>
          Height
          <Input
            type="number"
            step={1}
            value={paper().height}
            onChange={(event) => setPaper({ height: event.target.valueAsNumber })}
          />
        </FieldLabel>
        <FieldLabel>
          Margin
          <Input
            type="number"
            step={0.25}
            value={paper().margin}
            onChange={(event) => setPaper({ margin: event.target.valueAsNumber })}
          />
        </FieldLabel>
        <FieldLabel>
          Gap
          <Input
            type="number"
            step={0.25}
            value={paper().gap}
            onChange={(event) => setPaper({ gap: event.target.valueAsNumber })}
          />
        </FieldLabel>
      </fieldset>
      <fieldset class="grid grid-cols-2 gap-x-3 gap-y-5 border-t border-border pt-5">
        <SectionHeader class="col-span-2">Image options</SectionHeader>
        <FieldLabel>
          Crop
          <Select
            value={imageConfig().shape}
            onChange={(event) => setImageConfig({ shape: event.target.value as ImageShape })}
          >
            <option value="original">Original</option>
            <option value="square">Square</option>
          </Select>
        </FieldLabel>
        <FieldLabel>
          Width
          <Input
            type="number"
            step={1}
            value={imageConfig().width}
            onChange={(event) => setImageConfig({ width: event.target.valueAsNumber })}
          />
        </FieldLabel>
        {/* Key by project ID so the switch remounts without animating on project changes. */}
        <For each={[projectId()]}>
          {() => (
            <Checkbox
              class="col-span-2"
              checked={paper().allowRotation}
              description="Photos will only be rotated to reduce total number of pages"
              onChange={(event) => setPaper({ allowRotation: event.target.checked })}
            >
              Allow rotation
            </Checkbox>
          )}
        </For>
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
    </aside>
  );
}

function ProjectSettingsDialog(props: {
  ref: (element: HTMLDialogElement) => void;
  open: boolean;
  mode: "create" | "settings";
  onClose: () => void;
}) {
  const [name, setName] = createSignal(() => (props.mode === "create" ? "" : project().name));
  const canDeleteProject = createMemo(() => projects.length > 1);

  async function saveProjectName() {
    const nextName = name().trim();

    if (!nextName) return;

    if (props.mode === "create") {
      await createProject(nextName);
    } else {
      await renameProject(project().id, nextName);
    }

    props.onClose();
  }

  async function deleteCurrentProject() {
    if (!canDeleteProject()) return;
    if (!window.confirm(`Delete “${project().name}”? This cannot be undone.`)) return;

    await deleteProject(project().id);
    props.onClose();
  }

  return (
    <Dialog ref={props.ref} class="w-[calc(100vw-2.5rem)] max-w-md" onClose={props.onClose}>
      <form
        class="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void saveProjectName();
        }}
      >
        <h2 class="text-xl font-semibold">
          {props.mode === "create" ? "Create project" : "Project settings"}
        </h2>
        <div class="min-h-24">
          <FieldLabel>
            Project name
            <Input
              value={name()}
              autofocus
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </FieldLabel>
        </div>
        <div class="flex items-center justify-end gap-3">
          <Show when={props.mode === "settings"}>
            <Button
              type="button"
              variant="secondary"
              class="mr-auto gap-2"
              disabled={!canDeleteProject()}
              onClick={deleteCurrentProject}
            >
              <Icon icon={Trash2} />
              Delete project
            </Button>
          </Show>
          <Button type="button" variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name().trim()}>
            {props.mode === "create" ? "Create" : "Rename"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function HeaderProjectDropdown() {
  const [settingsDialogRef, setSettingsDialogRef] = createSignal<HTMLDialogElement>();
  const [settingsMode, setSettingsMode] = createSignal<"create" | "settings" | null>(null);
  const options = createMemo(() => {
    return projects.map((project) => ({ label: project.name, value: project.id }));
  });

  createEffect(
    () => {
      if (!settingsMode()) return undefined;

      return settingsDialogRef();
    },
    (dialog) => {
      if (!dialog || dialog.open) return;

      dialog.showModal();
    },
  );

  return (
    <div class="flex items-center gap-2">
      <Dropdown
        options={options()}
        actions={[
          {
            icon: Plus,
            label: "Create new project",
            onClick: () => setSettingsMode("create"),
          },
        ]}
        value={projectId()}
        onSelect={(id) => selectProject(id)}
      />
      <Button
        type="button"
        variant="secondary"
        activeTransform={false}
        class="min-w-0 w-9 px-0"
        aria-label="Project settings"
        onClick={() => setSettingsMode("settings")}
      >
        <Icon icon={Settings} />
      </Button>
      <ProjectSettingsDialog
        ref={setSettingsDialogRef}
        open={Boolean(settingsMode())}
        mode={settingsMode() ?? "settings"}
        onClose={() => {
          setSettingsMode(null);
          if (settingsDialogRef()?.open) settingsDialogRef()?.close();
        }}
      />
    </div>
  );
}

function DownloadControls() {
  const [downloading, setDownloading] = createOptimistic(false);

  return (
    <div class="flex items-center gap-2">
      <span class="mr-2 text-sm font-medium tabular-nums text-foreground/70">
        {bins.length} {pluralize(bins.length, "page", "pages")} / {projectImages.length}{" "}
        {pluralize(projectImages.length, "photo", "photos")}
      </span>
      <Button
        type="button"
        variant="secondary"
        disabled={downloading()}
        onClick={action(function* () {
          setDownloading(true);
          yield downloadPhotosFromCurrentLayout({
            bins: [...bins],
            paper: paper(),
            images: [...snapshot(projectImages)],
            projectName: project().name,
          });
        })}
      >
        Download Photos
      </Button>
      <Button
        type="button"
        disabled={downloading()}
        onClick={action(function* () {
          setDownloading(true);
          yield downloadPdfFromCurrentLayout({
            bins: [...bins],
            paper: paper(),
            images: [...snapshot(projectImages)],
            projectName: project().name,
          });
        })}
      >
        Download PDF
      </Button>
    </div>
  );
}

function AsyncImage(props: JSX.ImgHTMLAttributes<HTMLImageElement>) {
  const source = createMemo(async () => {
    return new Promise<string>((resolve, reject) => {
      const imageElement = new Image();
      imageElement.onload = () => {
        resolve(imageElement.src);
        imageElement.remove();
      };
      imageElement.onerror = reject;
      if (props.src) imageElement.src = props.src;
      imageElement.hidden = true;
      document.head.append(imageElement);
    });
  });

  return <img {...props} src={source()} />;
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

  function openCropDialog(selectedCropRectangle: PackedImageRectangle) {
    const imageElement = projectImages.find((image) => image.id === selectedCropRectangle.data.id);

    if (!imageElement) return;

    const cropKey = getCropKey(selectedCropRectangle);
    const savedCrop = imageElement.crops?.[cropKey];
    const nextCrop = savedCrop
      ? cropFromPercentages(savedCrop, imageElement.width, imageElement.height)
      : computeInitialCrop(imageElement.width, imageElement.height, selectedCropRectangle);

    setCrop(nextCrop);
    setSelectedCrop(selectedCropRectangle);
  }

  async function saveSelectedCrop() {
    const selectedCropRectangle = selectedCrop();
    const currentCropValue = crop();
    const image = selectedImage();

    if (!selectedCropRectangle || !currentCropValue || !image) return;

    await saveImageCrop(
      image.id,
      getCropKey(selectedCropRectangle),
      cropToPercentages(currentCropValue, image.width, image.height),
    );
    await resolve(() => projectImages.find((image) => image.id));
    dialogRef()?.close();
  }

  async function deleteSelectedImage() {
    const image = selectedImage();

    if (!image) return;
    if (!window.confirm("Delete this image?")) return;

    await deleteImage(image.id);
    await resolve(() => projectImages.length);
    dialogRef()?.close();
  }

  createEffect(
    () => {
      const selectedCropRectangle = selectedCrop();
      const dialog = dialogRef();

      if (!selectedCropRectangle || !dialog) return undefined;

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
        class="h-[calc(100dvh-2.5rem)] w-[calc(100vw-2.5rem)] max-w-fit grid-rows-[minmax(0,1fr)_auto_auto] gap-0"
        onKeyDown={(event) => {
          if (event.key !== "Backspace") return;

          event.preventDefault();
          void deleteSelectedImage();
        }}
        onClose={() => {
          setSelectedCrop();
          setCrop();
        }}
      >
        <Show when={selectedCrop()}>
          {(selectedCropRectangle) => (
            <Show when={selectedImage()}>
              {(image) => (
                <Show when={crop()}>
                  {(currentCropValue) => (
                    <>
                      <div class="-mx-2 grid min-h-0 min-w-0 place-items-center overflow-visible p-2">
                        <ImagePreview
                          image={image()}
                          currentCrop={selectedCropRectangle()}
                          crop={currentCropValue()}
                          onCropChange={setCrop}
                          onCropDone={saveSelectedCrop}
                        />
                      </div>
                      <div class="py-4">
                        <div class="border-t -mt-1" />
                      </div>
                      <div class="flex items-center justify-end gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          class="mr-auto gap-2"
                          onClick={deleteSelectedImage}
                        >
                          <Icon icon={Trash2} />
                          Delete
                        </Button>
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
      <div
        class="grid gap-5 justify-center p-8 overflow-y-auto h-full auto-rows-max w-full [scrollbar-gutter:stable]"
        style={{
          "grid-template-columns":
            bins.length > 1 ? `repeat(auto-fill, ${paper().width}${paper().units})` : "1fr",
        }}
      >
        <For each={bins}>
          {(packedBin) => (
            <div
              class={["relative mx-auto w-full overflow-hidden min-w-3xs", cardSurfaceClass]}
              style={{
                "aspect-ratio": paper().width / paper().height,
                "max-width": `${paper().width}${paper().units}`,
              }}
            >
              <For each={packedBin.rects}>
                {(packedRect) => (
                  <button
                    type="button"
                    class="group/photo relative block overflow-hidden border-0 bg-transparent p-0 outline-0 hover:brightness-90 dark:hover:opacity-85 dark:hover:brightness-100 focus-visible:outline-[4px] focus-visible:outline-ring/50 focus-visible:opacity-95"
                    style={getPhotoStyle(packedRect, paper())}
                    title="Edit image crop"
                    onClick={() => openCropDialog(packedRect)}
                  >
                    <Show when={images().find((image) => image.id === packedRect.data.id)}>
                      {(image) => (
                        <AsyncImage
                          class="block max-w-none object-cover visible [dynamic-range-limit:standard] select-none"
                          style={getCroppedImageStyle(image(), packedRect)}
                          src={image().objectUrl}
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

function RootApplication() {
  return (
    <Loading>
      <Fonts />
      <header class="px-5 py-3 grid grid-cols-subgrid col-span-2">
        <span class="font-semibold tracking-tight text-xl flex gap-2 items-center">
          <Icon icon={FileSpreadsheet} class="scale-150" />
          printable.photos
        </span>
        <div class="flex items-center justify-between gap-3">
          <HeaderProjectDropdown />
          <DownloadControls />
        </div>
      </header>
      <Sidebar />
      <main class="h-full contain-size bg-muted border-l-[1px] border-t-[1px] border-foreground/13 inset-shadow-xs/[3%] ">
        <Pages />
      </main>
    </Loading>
  );
}

render(() => <RootApplication />, document.getElementById("root")!);
