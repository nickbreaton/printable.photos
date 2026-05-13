import type { JSX } from "@solidjs/web";

import { cn } from "../utils";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button(props: ButtonProps) {
  return (
    <button
      {...props}
      class={cn(
        "inline-flex h-9 min-w-24 select-none items-center justify-center border px-3 py-2 text-sm font-medium outline-none active:translate-y-px focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        props.variant === "secondary"
          ? "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/10 dark:hover:bg-input/50"
          : "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        props.class,
      )}
    />
  );
}
