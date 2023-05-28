import { component$, useComputed$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Signal } from "@builder.io/qwik";
import { MaxRectsPacker, PACKING_LOGIC, Rectangle } from "maxrects-packer";

const mockValues = {
  page: {
    width: 8.5,
    height: 11,
    padding: 0.5,
  },
  images: [
    {
      src: "/photo.png",
      width: 5,
      height: 5,
    },
    {
      src: "/photo2.png",
      width: 4,
      height: 4,
    },
    {
      src: "/photo2.png?a",
      width: 0.25,
      height: 0.25,
    },
    {
      src: "/photo2.png?b",
      width: 2,
      height: 2,
    },
    {
      src: "/photo2.png?c",
      width: 2,
      height: 2,
    },
    {
      src: "/photo2.png?d",
      width: 3,
      height: 3,
    },
    {
      src: "/photo2.png?e",
      width: 2,
      height: 2,
    },
    {
      src: "/photo.png?a",
      width: 7,
      height: 7,
    },
  ],
};

const Document = component$(
  ({ width, values, offscreen }: { width: string; values: typeof mockValues; offscreen?: Signal<HTMLElement> }) => {
    const offscreenStyle = {
      left: `-200vmax`,
      top: `-200vmax`,
      position: "absolute",
      pointerEvents: "none",
    };

    const offscreenAttributes = {
      "aria-hidden": true,
      ref: offscreen,
    };

    const bins = useComputed$(() => {
      const packer = new MaxRectsPacker(values.page.width, values.page.height, 0.25, {
        allowRotation: true,
        smart: false,
        border: 0.5,
      });
      packer.addArray(
        values.images.map((image) => {
          const rect = new Rectangle(image.width, image.height);
          rect.data = image;
          return rect;
        })
      );
      return packer.bins.map((bin) => {
        return {
          rects: bin.rects.map((rect) => ({
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
            rotate: rect.rot,
            data: rect.data,
          })),
        };
      });
    });

    useVisibleTask$(() => {
      console.log(bins.value);
    });

    return bins.value.map((bin, index) => {
      return (
        <div
          {...(offscreen ? offscreenAttributes : {})}
          key={index}
          style={{
            display: "inline-block",
            width,
            aspectRatio: `${values.page.width} / ${values.page.height}`,
            background: "white",
            minHeight: 0,
            position: "relative",
            ...(offscreen ? offscreenStyle : {}),
          }}
        >
          {/* TODO: add more pages */}
          {bin.rects.map((rect) => {
            return (
              // eslint-disable-next-line qwik/jsx-img
              <img
                key={rect.data.src}
                src={rect.data.src}
                style={{
                  position: "absolute",
                  left: `calc(${rect.x} / ${values.page.width} * 100%)`,
                  marginTop: `calc(${rect.y} / ${values.page.width} * 100%)`, // use margin for percentage of width
                  width: `calc(${rect.width} / ${values.page.width} * 100%)`,
                  aspectRatio: `${rect.width} / ${rect.height}`,
                }}
              />
            );
          })}
        </div>
      );
    });
  }
);

export default component$(() => {
  const content = useSignal<HTMLDivElement>(null!);
  // useVisibleTask$(() => {

  // });
  return (
    <>
      <button
        style="margin-bottom: 1rem;"
        onClick$={async () => {
          const doc = new jsPDF({
            unit: "in",
            orientation: "p",
            format: [8.5, 11],
          });
          const canvas = await html2canvas(content.value!);
          doc.addImage(canvas, 0, 0, 8.5, 11);
          doc.save("canvas.pdf");
        }}
      >
        Download
      </button>

      <div>
        <Document width="80%" values={mockValues} />
        <Document width="8.5in" values={mockValues} offscreen={content} />
      </div>
    </>
  );
});
