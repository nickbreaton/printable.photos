import { component$, useComputed$, useSignal, Signal, useVisibleTask$, useStore } from "@builder.io/qwik";
import { jsPDF } from "jspdf";
import { MaxRectsPacker, Rectangle } from "maxrects-packer";
import { getConnection } from "~/utils/data";
import exifreader from "exifreader";
import { css } from "~/panda/css";
import { center } from "~/panda/patterns";

type Config = {
  page: {
    width: number;
    height: number;
    margin: number;
    padding: number;
  };
  images: Array<{
    src: string;
    width: number;
    height: number;
  }>;
};

type BaseDocumentProps = {
  values: Config;
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
        marginBottom: "25px",
        marginTop: "25px",
      }}
    >
      {[{ imageLayouts: [] }, { imageLayouts: [] }, { imageLayouts: [] }, ...imageSheets].map(
        ({ imageLayouts }, index) => {
          return (
            <div
              key={imageLayouts.map((imageLayout) => imageLayout.src).join()}
              class={css({
                display: "inline-block",
                borderRadius: "sm",
                background: "white",
                boxShadow: "sm",
                position: "relative",
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
        }
      )}
    </div>
  );
});

export default component$(() => {
  const config: Config = useStore({
    page: {
      width: 8.5,
      height: 11,
      margin: 0.25,
      padding: 0.5,
    },
    images: [],
  });

  const pages = useSignal<HTMLElement[]>([]);
  const imageSheets = useImageSheets(config);
  // const storedImages = useSignal<string[]>([]);

  useVisibleTask$(({ cleanup }) => {
    getConnection().then(async ({ db, subscriber }) => {
      const read = async () => {
        const records = await db.getAll("images");
        config.images = await Promise.all(
          records.map(async (record) => {
            const src = URL.createObjectURL(record.blob);
            const ratio = await new Promise<number>((resolve) => {
              const img = document.createElement("img");
              img.onload = () => {
                resolve(img.height / img.width);
              };
              img.src = src;
            });
            return { src, width: 3, height: ratio * 3 };
          })
        );
      };
      cleanup(subscriber.subscribe(read));
      await read();
    });
  });

  return (
    <>
      <button
        class={css({ flexDir: "row" })}
        onClick$={async () => {
          const doc = new jsPDF({
            unit: "in",
            orientation: "p",
            format: [config.page.width, config.page.height],
          });

          doc.deletePage(1);

          for (const sheet of imageSheets.value) {
            doc.addPage();

            for (const image of sheet.imageLayouts) {
              console.log(image);

              // TODO: this probably is not effecient (can do blob.arrayBuffer() directly)
              const blob = await fetch(image.src).then((res) => res.blob());
              const data = exifreader.load(await blob.arrayBuffer());

              switch (data.Orientation?.value) {
                // TODO fill in more cases
                // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
                case 6:
                  doc.addImage(
                    image.src,
                    blob.type,
                    image.x,
                    image.y - image.width,
                    image.height,
                    image.width,
                    undefined,
                    undefined,
                    -90
                  );
                  break;
                default:
                  doc.addImage(image.src, blob.type, image.x, image.y, image.width, image.height);
                  break;
              }
            }
          }

          doc.save("canvas.pdf");
        }}
      >
        Download
      </button>
      <div class={css({ display: "flex", flexDir: "column", alignItems: "center" })}>
        <div
          // style={{ width: "70%", margin: "auto", maxWidth: "80vh", minWidth: "500px", display: "flex" }}
          class={css({ width: "xl", maxWidth: "11/12" })}
        >
          <Document values={config} imageSheets={imageSheets.value} pages={pages} />
          <div
            hidden={true /* TODO: show options */}
            style={{
              width: "400px",
              marginLeft: "30px",
              marginTop: "30px",
              background: "white",
              height: "500px",
              padding: "20px",
            }}
          >
            <h2>Images</h2>
            <form
              preventdefault:submit
              style={{ border: "1px solid #444", padding: "20px" }}
              onSubmit$={async (event) => {
                const { db, subscriber } = await getConnection();
                const file = new FormData(event.target as any).get("image") as File;

                db.add("images", {
                  id: Math.random() + "",
                  blob: new Blob([file], { type: file.type }),
                });
                subscriber.notify();

                // localForage.setItem("image:1", blob);
              }}
            >
              <input type="file" name="image" accept="image/*" />
              <button type="submit">Upload</button>
            </form>
            {config.images.map((image) => (
              <img key={image.src} src={image.src} alt="" width={100} height={100} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
});
