import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";

export interface FileInputProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class"> {
  children?: JSX.Element;
}

export function FileInput(props: FileInputProps) {
  const inputProps = omit(props, "children");

  return (
    <label class="relative inline-flex h-9 w-full min-w-24 select-none items-center justify-center border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground outline-none has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 has-[:disabled]:pointer-events-none has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      {props.children}
      <input
        {...inputProps}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif"
        class="absolute inset-0 opacity-0 appearance-none"
      />
    </label>
  );
}
