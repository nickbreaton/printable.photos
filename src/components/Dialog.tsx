import type { JSX } from "@solidjs/web";

import { cn } from "../utils";

export interface DialogProps {
  ref: (el: HTMLDialogElement) => void;
  children: JSX.Element;
  class?: string;
}

export function Dialog(props: DialogProps) {
  return (
    <dialog
      ref={props.ref}
      class={cn(
        "mx-auto mt-[10vh] grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg backdrop:bg-black/80 sm:rounded-lg",
        props.class,
      )}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLDialogElement).getBoundingClientRect();
        const clickedInDialog =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        if (!clickedInDialog) {
          (e.currentTarget as HTMLDialogElement).close();
        }
      }}
    >
      {props.children}
    </dialog>
  );
}
