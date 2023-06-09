import { component$, Slot, useSignal, useVisibleTask$ } from "@builder.io/qwik";

export default component$(() => {
  const render = useSignal(false);

  useVisibleTask$(() => {
    render.value = true;
  });

  if (!render.value) {
    return null;
  }

  return <Slot />;
});
