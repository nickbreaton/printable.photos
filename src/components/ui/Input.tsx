import type { JSX } from "@solidjs/web";

import { arrayify } from "../../classes";

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      class={[
        "mt-1 flex h-9 w-full min-w-0 rounded-none border border-input bg-input/30 px-3 py-1 text-sm font-normal normal-case tracking-normal shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        ...arrayify(props.class),
      ]}
    />
  );
}
