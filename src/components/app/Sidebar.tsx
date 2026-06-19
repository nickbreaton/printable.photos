import { action, createMemo, createOptimistic, For, Show } from "solid-js";
import { ImageUp } from "lucide-static";

import { Checkbox } from "../ui/Checkbox";
import { FieldLabel } from "../ui/FieldLabel";
import { FileInput } from "../ui/FileInput";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import {
  ALL_PAPER_PRESETS,
  getSelectedPaperPreset,
  PAPER_PRESETS,
  type ImageShape,
} from "../../data";
import { addImages, imageConfig, paper, projectId, setImageConfig, setPaper } from "../../state";

const selectedPaperPreset = createMemo(() => getSelectedPaperPreset(paper()));

export function Sidebar() {
  const [saving, setSaving] = createOptimistic(false);

  return (
    <aside class="flex max-h-[calc(100vh-2.5rem)] w-80 shrink-0 flex-col">
      <div class="mx-5 border-t border-border" />
      <div class="flex min-h-0 flex-col gap-5 overflow-auto p-5">
        <fieldset class="grid grid-cols-2 gap-x-3 gap-y-5">
          <SectionHeader class="col-span-2">Page layout</SectionHeader>
          <FieldLabel class="col-span-2">
            Preset
            <Select
              value={selectedPaperPreset()}
              onChange={(event) => {
                const selectedPreset = ALL_PAPER_PRESETS.find((preset) => preset.value === event.target.value);

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
                    <For each={group[1]}>{(preset) => <option value={preset.value}>{preset.label}</option>}</For>
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
          <Show when={projectId()} keyed>
            <Checkbox
              class="col-span-2"
              checked={paper().allowRotation}
              description="Photos will only be rotated to reduce total number of pages"
              onChange={(event) => setPaper({ allowRotation: event.target.checked })}
            >
              Allow rotation
            </Checkbox>
          </Show>
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

              event.target.value = "";
            })}
          >
            Import photos
            <Icon icon={ImageUp} class="ml-2" />
          </FileInput>
        </fieldset>
        <div aria-hidden="true" class="h-0 shrink-0" />
      </div>
    </aside>
  );
}
