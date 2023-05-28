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

type BaseDocumentProps = {
  width: string;
  values: typeof mockValues;
  pages: Signal<HTMLElement[]>;
};

type DocumentProps = BaseDocumentProps;

const Document = component$(({ width, values, ...props }: DocumentProps) => {
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

  return (
    <div
      style={{
        width,
        margin: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "25px", // TODO: use inches
        marginBottom: "25px",
        marginTop: "25px",
      }}
    >
      {bins.value.map((bin, index) => {
        return (
          <div
            key={bin.rects.map((rect) => rect.data.src).join()}
            style={{
              display: "inline-block",
              width: "100%",
              aspectRatio: `${values.page.width} / ${values.page.height}`,
              background: "white",
              minHeight: 0,
              position: "relative",
            }}
            ref={(page) => {
              props.pages.value[index] = page as HTMLElement;
            }}
          >
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
      })}
    </div>
  );
});

export default component$(() => {
  const pages = useSignal<HTMLElement[]>([]);
  const values = useSignal<typeof mockValues>();

  useVisibleTask$(() => {
    // simulate adding on client
    values.value = mockValues;
  });

  return (
    <>
      <button
        onClick$={async () => {
          const doc = new jsPDF({
            unit: "in",
            orientation: "p",
            format: [8.5, 11],
          });
          doc.deletePage(1);
          for (const page of pages.value) {
            doc.addPage();
            const canvas = await html2canvas(page);
            doc.addImage(canvas, 0, 0, 8.5, 11);
          }
          doc.save("canvas.pdf");
        }}
      >
        Download
      </button>

      {values.value && (
        <div>
          <Document width="80%" values={mockValues} pages={pages} />
        </div>
      )}
    </>
  );
});
