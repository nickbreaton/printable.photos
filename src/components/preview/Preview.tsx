import { Signal, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { getSourceImage } from "~/database/sources/image";
import { css } from "~/panda/css";
import { Config, ImageSheet } from "~/routes";

type PreviewProps = {
  values: Config;
  pages: Signal<HTMLElement[]>;
  imageSheets: ImageSheet[];
};

const PreviewImage = component$<{ values: Config; imageLayout: ImageSheet["imageLayouts"][number] }>(
  ({ values, imageLayout }) => {
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
          left: `calc(${imageLayout.x} / ${values.page.width} * 100%)`,
          marginTop: `calc(${imageLayout.y} / ${values.page.width} * 100%)`, // use margin for percentage of width
          width: `calc(${imageLayout.width} / ${values.page.width} * 100%)`,
          aspectRatio: `${imageLayout.width} / ${imageLayout.height}`,
        }}
      />
    );
  }
);

export const Preview = component$(({ values, imageSheets, ...props }: PreviewProps) => {
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
              aspectRatio: `${values.page.width} / ${values.page.height}`,
              minHeight: 0,
              position: "relative",
              marginTop: index > 0 ? `calc(0.5 / ${values.page.width} * 100%)` : "0", // use margin to simulate inches based off width (margin-top is based off width)
            }}
            ref={(page) => {
              props.pages.value[index] = page as HTMLElement;
            }}
          >
            {imageLayouts.map((imageLayout) => {
              return <PreviewImage key={imageLayout.photo.id} values={values} imageLayout={imageLayout} />;
            })}
          </div>
        );
      })}
    </div>
  );
});
