import type { JSX } from "@solidjs/web";

import { cn } from "../utils";

export function SectionHeader(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...props}
      class={cn("text-sm font-semibold uppercase leading-none tracking-tight", props.class)}
    />
  );
}
