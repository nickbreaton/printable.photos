import type { JSX } from "@solidjs/web";

import { cn } from "../utils";
import { omit } from "solid-js";

type CheckboxProps = JSX.InputHTMLAttributes<HTMLInputElement> & {
  children: JSX.Element;
  description?: JSX.Element;
};

export function Checkbox(props: CheckboxProps) {
  return (
    <label
      class={cn(
        "group flex w-full flex-row gap-3 text-sm font-medium leading-snug has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        props.class,
      )}
    >
      <span class="flex flex-1 flex-col leading-snug">
        <span class="select-none uppercase text-xs font-semibold tracking-tight">
          {props.children}
        </span>
        {props.description && (
          <span class="mt-1 font-normal leading-normal text-muted-foreground text-pretty">
            {props.description}
          </span>
        )}
      </span>
      <input
        {...omit(props, "children", "class", "description")}
        type="checkbox"
        class="peer sr-only"
      />
      <span
        aria-hidden="true"
        class="relative inline-flex h-5 w-9 shrink-0 items-center border border-input bg-input p-px transition-colors peer-checked:bg-primary peer-focus-visible:outline-none peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      >
        <span class="block size-4 bg-primary shadow-sm transition-transform group-has-[:checked]:translate-x-4 group-has-[:checked]:bg-primary-foreground" />
      </span>
    </label>
  );
}
