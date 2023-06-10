import { Slot, component$ } from "@builder.io/qwik";

interface Props {
  heading: string;
}

export default component$<Props>(({ heading }) => {
  return (
    <div class="w-11/12 max-w-2xl space-y-4 text-center mt-24 mx-auto">
      <h1 class="font-serif font-bold text-4xl">{heading}</h1>
      <p class="text-gray-700">
        <Slot />
      </p>
    </div>
  );
});
