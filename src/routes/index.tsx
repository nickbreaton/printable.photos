import { component$, useComputed$, useSignal, useVisibleTask$, Signal } from "@builder.io/qwik";
import { jsPDF } from "jspdf";
import { MaxRectsPacker, Rectangle } from "maxrects-packer";

const mockValues = {
  page: {
    width: 8.5,
    height: 11,
    margin: 0.25,
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

type Config = typeof mockValues;

type BaseDocumentProps = {
  values: typeof mockValues;
  pages: Signal<HTMLElement[]>;
  imageSheets: ImageSheet[];
};

type DocumentProps = BaseDocumentProps;

type ImageSheet = ReturnType<typeof useImageSheets>["value"][number];

function useImageSheets(config: Config) {
  return useComputed$(() => {
    const packer = new MaxRectsPacker(config.page.width, config.page.height, config.page.margin, {
      allowRotation: false, // TODO: optimization
      smart: false,
      border: config.page.padding,
    });
    packer.addArray(
      config.images.map((image) => {
        const rect = new Rectangle(image.width, image.height);
        rect.data = image.src;
        return rect;
      })
    );
    return packer.bins.map((bin) => {
      return {
        imageLayouts: bin.rects.map((rect) => ({
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
          rotate: rect.rot,
          src: rect.data,
        })),
      };
    });
  });
}

const Document = component$(({ values, imageSheets, ...props }: DocumentProps) => {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "25px", // TODO: use inches
        marginBottom: "25px",
        marginTop: "25px",
      }}
    >
      {imageSheets.map(({ imageLayouts }, index) => {
        return (
          <div
            key={imageLayouts.map((imageLayout) => imageLayout.src).join()}
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

const App = component$(({ config }: { config: Config }) => {
  const pages = useSignal<HTMLElement[]>([]);
  const imageSheets = useImageSheets(config);

  return (
    <>
      <button
        onClick$={async () => {
          const doc = new jsPDF({
            unit: "in",
            orientation: "p",
            format: [config.page.width, config.page.height],
          });

          doc.deletePage(1);

          imageSheets.value.forEach((sheet) => {
            doc.addPage();

            sheet.imageLayouts.forEach((image) => {
              doc.addImage(image.src, "png", image.x, image.y, image.width, image.height);
            });
          });

          doc.save("canvas.pdf");
        }}
      >
        Download
      </button>

      <div style={{ width: "70%", margin: "auto", maxWidth: "80vh", minWidth: "500px" }}>
        <Document values={config} imageSheets={imageSheets.value} pages={pages} />
      </div>
    </>
  );
});

export default component$(() => {
  const values = useSignal<typeof mockValues>();

  useVisibleTask$(() => {
    // simulate adding on client
    values.value = mockValues;
  });

  return values.value ? <App config={values.value} /> : null;
});
