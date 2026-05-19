import type { JSX } from "@solidjs/web";

import { cn } from "../utils";

export const labelTextClass = "text-xs font-semibold uppercase tracking-tight";

export function FieldLabel(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} class={cn("block", labelTextClass, props.class)} />;
}
