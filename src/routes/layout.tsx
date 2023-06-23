import { component$, Slot, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { isServer } from "@builder.io/qwik/build";
import Error from "~/components/Error";
import { usePointerDown } from "~/hooks/usePointerDown";

export default component$(() => {
  const render = useSignal(false);

  useVisibleTask$(() => {
    render.value = true;
  });

  usePointerDown();

  return (
    <div>
      {isServer && (
        <noscript>
          <Error heading="JavaScript Required">
            This application runs locally in the browser to keep your photos, <em class="italic">your</em> photos. If
            you’d like to enable JavaScript, you can rest assured there are no pesky trackers.
          </Error>
          <style dangerouslySetInnerHTML="#app { display: none; }" />
        </noscript>
      )}
      {/* TODO: improve message in future */}
      <div id="app">{render.value && <Slot />}</div>
    </div>
  );
});
