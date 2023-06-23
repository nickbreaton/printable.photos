import { useVisibleTask$ } from "@builder.io/qwik";
import { radEventListener } from "rad-event-listener";

/**
 * Adds the `data-pointerdown` attribute to the currently active element and its parents.
 * This allows for attribute selection via CSS, which seems a tad faster that `:active`.
 */
export const usePointerDown = () => {
  useVisibleTask$(({ cleanup }) => {
    const attr = "pointerdown";

    const onPointerDown = (event: PointerEvent) => {
      let element = event.target as HTMLElement | null;
      while (element) {
        element.dataset[attr] = "";
        element = element.parentElement;
      }
    };

    const onPointerUp = () => {
      document.querySelectorAll(`[data-${attr}]`).forEach((element) => {
        delete (element as HTMLElement).dataset[attr];
      });
    };

    cleanup(radEventListener(document, "pointerdown", onPointerDown));
    cleanup(radEventListener(document, "pointerup", onPointerUp));
    cleanup(radEventListener(document, "pointercancel", onPointerUp));
  });
};
