import Home from "~/frames/home";
import AddProject from "~/frames/add-project";
import Project from "~/frames/project";
import { Component, component$ } from "@builder.io/qwik";
import { Frame, useFrameRouterContext } from "~/hooks/use-frame-router";

const frames: Record<Frame["type"], Component<{}>> = {
  home: Home,
  "add-project": AddProject,
  project: Project,
};

export default component$(() => {
  const frame = useFrameRouterContext({ type: "home" });

  if (!frame.value) {
    return null;
  }

  const Frame = frames[frame.value.type];

  return (
    <div>
      <Frame />
    </div>
  );
});
