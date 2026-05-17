import { createMemo, createUniqueId, For, Show } from "solid-js";
import { Check, ChevronsUpDown } from "lucide-static";

import { Icon } from "./Icon";

export interface DropdownOption {
  label: string;
  value: string;
}

export interface DropdownAction {
  icon: string;
  label: string;
  onClick: () => void;
}

export interface DropdownProps {
  options: DropdownOption[];
  actions: DropdownAction[];
  value: string;
  onSelect: (value: string) => void;
}

export function Dropdown(props: DropdownProps) {
  const popoverId = createUniqueId();
  const anchorName = `--dropdown-${popoverId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const selectedOption = createMemo(() => {
    return props.options.find((option) => option.value === props.value);
  });

  return (
    <div class="relative inline-flex">
      <button
        type="button"
        popovertarget={popoverId}
        style={{ "anchor-name": anchorName }}
        class="inline-flex h-9 min-w-48 items-center justify-between gap-2 border border-input bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/10 dark:hover:bg-input/50"
      >
        {selectedOption()?.label ?? props.value}
        <Icon icon={ChevronsUpDown} />
      </button>
      <div
        id={popoverId}
        popover="auto"
        style={{
          "position-anchor": anchorName,
          top: "calc(anchor(bottom) + 0.25rem)",
          left: "anchor(left)",
        }}
        class="absolute m-0 min-w-48 border border-border bg-popover p-1 text-popover-foreground shadow-md backdrop:bg-transparent"
      >
        <For each={props.options}>
          {(option) => (
            <button
              type="button"
              popovertarget={popoverId}
              popovertargetaction="hide"
              class="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-sm outline-none transition-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              onClick={() => props.onSelect(option.value)}
            >
              <span>{option.label}</span>
              {option.value === props.value && <Icon icon={Check} />}
            </button>
          )}
        </For>
        <Show when={props.actions.length > 0}>
          <div class="my-1 border-t border-border" />
          <For each={props.actions}>
            {(action) => (
              <button
                type="button"
                popovertarget={popoverId}
                popovertargetaction="hide"
                class="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm outline-none transition-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                onClick={() => action.onClick()}
              >
                <Icon icon={action.icon} />
                <span>{action.label}</span>
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
