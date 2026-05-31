import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { ChevronDown } from "lucide-static";

import { arrayify } from "../classes";
import { Icon } from "./Icon";

export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span class="relative mt-1 flex w-full min-w-0">
      <select
        {...omit(props, "class")}
        class={[
          "flex h-9 w-full min-w-0 appearance-none rounded-none border border-input bg-input/30 px-3 py-2 pr-8 text-sm font-normal normal-case tracking-normal shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          ...arrayify(props.class),
        ]}
      />
      <Icon
        icon={ChevronDown}
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}
