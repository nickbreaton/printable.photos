import { Signal, component$ } from "@builder.io/qwik";
import { css } from "~/panda/css";
import { Config, ImageSheet } from "~/routes";

type PreviewProps = {
  values: Config;
  pages: Signal<HTMLElement[]>;
  imageSheets: ImageSheet[];
};

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
            key={imageLayouts.map((imageLayout) => imageLayout.src).join()}
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
              return (
                // eslint-disable-next-line qwik/jsx-img
                <img
                  key={imageLayout.src}
                  src={imageLayout.src}
                  style={{
                    position: "absolute",
                    left: `calc(${imageLayout.x} / ${values.page.width} * 100%)`,
                    marginTop: `calc(${imageLayout.y} / ${values.page.width} * 100%)`, // use margin for percentage of width
                    width: `calc(${imageLayout.width} / ${values.page.width} * 100%)`,
                    aspectRatio: `${imageLayout.width} / ${imageLayout.height}`,
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
});
