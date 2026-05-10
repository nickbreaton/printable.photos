import { Loading, type JSX } from "@solidjs/web";
import { cn } from "../utils";

export interface DialogProps {
  ref: (el: HTMLDialogElement) => void;
  children: JSX.Element;
  class?: string;
  onClose?: () => void;
  onKeyDown?: JSX.EventHandlerUnion<HTMLDialogElement, KeyboardEvent>;
}

export function Dialog(props: DialogProps) {
  let isBackdropPointerDown = false;

  return (
    <Loading>
      <dialog
        ref={props.ref}
        class={cn(
          "m-auto grid max-h-[calc(100dvh-2.5rem)] gap-4 border bg-background p-6 shadow-lg backdrop:bg-black/80 sm:rounded-lg",
          props.class,
        )}
        onPointerDown={(event) => {
          isBackdropPointerDown = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (isBackdropPointerDown && event.target === event.currentTarget) {
            event.currentTarget.close();
          }

          isBackdropPointerDown = false;
        }}
        onClose={props.onClose}
        onKeyDown={props.onKeyDown}
      >
        {props.children}
      </dialog>
    </Loading>
  );
}
