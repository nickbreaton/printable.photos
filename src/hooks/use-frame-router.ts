import {
  $,
  useSignal,
  useVisibleTask$,
  createContextId,
  useContextProvider,
  Signal,
  useContext,
} from "@builder.io/qwik";

export type Frame = { type: "home" } | { type: "add-project" } | { type: "project"; id: string };

const context = createContextId<Signal<Frame>>("frame-router");

export function useFrameRouterContext(init: Frame) {
  const frame = useSignal<Frame>();

  useContextProvider(context, frame);

  useVisibleTask$(({ cleanup }) => {
    frame.value = window.history.state?.frame ?? init;
    const popstate = () => {
      frame.value = window.history.state?.frame ?? init;
    };
    window.addEventListener("popstate", popstate);
    cleanup(() => window.removeEventListener("popstate", popstate));
  });

  return frame;
}

export function useFrameRouter() {
  const frame = useContext(context);

  const push = $((next: Frame) => {
    frame.value = next;
    window.history.pushState({ frame: next }, "");
  });

  const back = $(() => {
    window.history.back();
  });

  return {
    frame: frame.value,
    push,
    back,
  };
}
