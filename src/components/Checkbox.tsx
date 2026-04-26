import type { JSX } from "solid-js";

import { cn } from "../utils";

export function Checkbox(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="checkbox"
      class={cn(
        "size-4 shrink-0 rounded-none border border-input bg-input/30 accent-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        props.class,
      )}
    />
  );
}
