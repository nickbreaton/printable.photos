import { createEffect, createMemo, createSignal, For, resolve, Show } from "solid-js";
import type { JSX } from "@solidjs/web";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { ImagePreview } from "../ui/ImagePreview";
import { Trash2 } from "lucide-static";
import { computeInitialCrop, cropFromPercentages, cropToPercentages, getCropKey, getImageViewBoxWidth, type CropRect } from "../../crop";
import type { ProjectImage } from "../../data";
import type { PackedImageRectangle } from "../../layout";
import { deleteImage, images, paper, projectId, projectImages, saveImageCrop, bins } from "../../state";
import { AsyncImage } from "../ui/AsyncImage";

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

const cardSurfaceClass = "bg-background text-card-foreground shadow-sm ring-1 ring-foreground/10";

export function Pages() {
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
      <Show when={projectId()} keyed>
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
                      title="Edit image"
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
      </Show>
    </>
  );
}

