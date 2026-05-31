import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";

import { arrayify } from "../../classes";
import { labelTextClass } from "./FieldLabel";

type CheckboxProps = JSX.InputHTMLAttributes<HTMLInputElement> & {
  children: JSX.Element;
  description?: JSX.Element;
};

export function Checkbox(props: CheckboxProps) {
  return (
    <label
      class={[
        "group grid w-full grid-cols-[1fr_max-content] items-center gap-x-3 gap-y-1 text-sm font-medium leading-snug has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        ...arrayify(props.class),
      ]}
    >
      <span class={["select-none", labelTextClass]}>{props.children}</span>
      {props.description && (
        <span class="col-start-1 row-start-2 font-normal leading-normal text-muted-foreground text-pretty">
          {props.description}
        </span>
      )}
      <input
        {...omit(props, "children", "class", "description")}
        type="checkbox"
        class="peer sr-only"
      />
      <span
        aria-hidden="true"
        class="relative col-start-2 row-start-1 inline-flex h-5 w-9 shrink-0 items-center border border-input bg-input p-px transition-colors peer-checked:bg-primary peer-focus-visible:outline-none peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      >
        <span class="block size-4 bg-primary shadow-sm transition-transform group-has-[:checked]:translate-x-4 group-has-[:checked]:bg-primary-foreground" />
      </span>
    </label>
  );
}
