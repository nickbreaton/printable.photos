import type { JSX } from "@solidjs/web";

import { cn } from "../utils";

export function FieldLabel(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label {...props} class={cn("block text-sm font-medium", props.class)} />
  );
}
