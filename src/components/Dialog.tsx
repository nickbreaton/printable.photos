import { Loading, type JSX } from "@solidjs/web";
import { cn } from "../utils";

export interface DialogProps {
  ref: (el: HTMLDialogElement) => void;
  children: JSX.Element;
  class?: string;
  onClose?: () => void;
}

export function Dialog(props: DialogProps) {
  return (
    <Loading>
      <dialog
        ref={props.ref}
        class={cn(
          "mx-auto mt-[10vh] grid gap-4 border bg-background p-6 shadow-lg backdrop:bg-black/80 sm:rounded-lg",
          props.class,
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        onClose={props.onClose}
      >
        {props.children}
      </dialog>
    </Loading>
  );
}
