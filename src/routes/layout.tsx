import { component$, Slot, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { isServer } from "@builder.io/qwik/build";
import Error from "~/components/Error";

export default component$(() => {
  const render = useSignal(false);

  useVisibleTask$(() => {
    render.value = true;
  });

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
      <div id="print" class="hidden">
        {/* TODO: improve message in future */}
        <Error heading="Print Error">
          It looks like you’re trying to print this application rather than your project.
          <br />
          Click the “Download” button inside your project to generate a printable PDF.
        </Error>
      </div>
      <div id="app">{render.value && <Slot />}</div>
    </div>
  );
});
