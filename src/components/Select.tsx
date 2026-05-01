import type { JSX } from "@solidjs/web";

import { cn } from "../utils";

export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      class={cn(
        "mt-1 flex h-9 w-full min-w-0 rounded-none border border-input bg-input/30 px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        props.class,
      )}
    />
  );
}
