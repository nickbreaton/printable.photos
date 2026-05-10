import type { JSX } from "@solidjs/web";

import { cn } from "../utils";

export function Button(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      class={cn(
        "inline-flex h-9 items-center justify-center border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        props.class,
      )}
    />
  );
}
