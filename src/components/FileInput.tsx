import type { JSX } from "@solidjs/web";

import { cn } from "../utils";
import { Input } from "./Input";

export function FileInput(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      type="file"
      class={cn(
        "file:mr-3 file:h-7 file:rounded-none file:border-0 file:bg-transparent file:px-0 file:text-sm file:font-medium file:text-foreground",
        props.class,
      )}
    />
  );
}
