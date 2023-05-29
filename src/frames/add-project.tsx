import { component$ } from "@builder.io/qwik";
import { useFrameRouter } from "~/hooks/use-frame-router";

export default component$(() => {
  const router = useFrameRouter();

  return (
    <div>
      <h1>Add Project</h1>
      <button
        onClick$={() => {
          router.push({ type: "project", id: "" });
        }}
      >
        Create
      </button>
    </div>
  );
});
