import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { getSourceImage } from "~/database/tables/image";
import { Project } from "~/database/tables/project";
import { css } from "~/panda/css";
import { ImageSheet } from "~/routes";

type PreviewProps = {
  project: Project;
  imageSheets: ImageSheet[];
};

const PreviewImage = component$<{ project: Project; imageLayout: ImageSheet["imageLayouts"][number] }>(
  ({ project, imageLayout }) => {
    const src = useSignal<string | null>(null);

    useVisibleTask$(({ cleanup }) => {
      getSourceImage(imageLayout.photo.id).then((url) => {
        src.value = url.src;
        cleanup(() => URL.revokeObjectURL(url.src));
      });
    });

    return (
      // eslint-disable-next-line qwik/jsx-img
      <img
        src={src.value!}
        style={{
          opacity: src.value ? 1 : 0,
          position: "absolute",
          left: `calc(${imageLayout.x} / ${project.width} * 100%)`,
          marginTop: `calc(${imageLayout.y} / ${project.width} * 100%)`, // use margin for percentage of width
          width: `calc(${imageLayout.width} / ${project.width} * 100%)`,
          aspectRatio: `${imageLayout.width} / ${imageLayout.height}`,
        }}
      />
    );
  }
);

export const Preview = component$(({ project, imageSheets }: PreviewProps) => {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {imageSheets.map(({ imageLayouts }, index) => {
        return (
          <div
            key={imageLayouts.map((imageLayout) => imageLayout.photo.id).join()}
            class={css({
              display: "inline-block",
              borderRadius: "sm",
              background: "white",
              boxShadow: "sm",
              position: "relative",
              pointerEvents: "none",
            })}
            style={{
              display: "inline-block",
              width: "100%",
              aspectRatio: `${project.width} / ${project.height}`,
              minHeight: 0,
              position: "relative",
              marginTop: index > 0 ? `calc(0.5 / ${project.width} * 100%)` : "0", // use margin to simulate inches based off width (margin-top is based off width)
            }}
          >
            {imageLayouts.map((imageLayout) => {
              return <PreviewImage key={imageLayout.photo.id} project={project} imageLayout={imageLayout} />;
            })}
          </div>
        );
      })}
    </div>
  );
});
