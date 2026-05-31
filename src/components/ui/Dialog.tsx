import { Loading, type JSX } from "@solidjs/web";

import { arrayify } from "../../classes";

export interface DialogProps {
  ref: (el: HTMLDialogElement) => void;
  children: JSX.Element;
  class?: string;
  onClose?: () => void;
  onKeyDown?: JSX.EventHandlerUnion<HTMLDialogElement, KeyboardEvent>;
}

export function Dialog(props: DialogProps) {
  let isBackdropPointerDown = false;

  function isBackdropPointerEvent(
    event: MouseEvent & { currentTarget: HTMLDialogElement },
  ) {
    const rect = event.currentTarget.getBoundingClientRect();

    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  }

  return (
    <Loading>
      <dialog
        ref={props.ref}
        class={[
          "m-auto grid max-h-[calc(100dvh-2.5rem)] gap-4 border bg-background p-6 shadow-lg backdrop:bg-black/80 sm:rounded-lg [&:not([open])]:hidden",
          ...arrayify(props.class),
        ]}
        onPointerDown={(event) => {
          isBackdropPointerDown = isBackdropPointerEvent(event);
        }}
        onClick={(event) => {
          if (
            isBackdropPointerDown &&
            event.target === event.currentTarget &&
            isBackdropPointerEvent(event)
          ) {
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
