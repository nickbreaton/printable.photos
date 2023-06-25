import { component$, useComputed$, useSignal, useStore, $ } from "@builder.io/qwik";
import { jsPDF } from "jspdf";
import { MaxRectsPacker, Rectangle } from "maxrects-packer";
import exifreader from "exifreader";
import { css } from "~/panda/css";
import { MobileTabs } from "~/components/MobileTabs";
import { Preview } from "~/components/preview/Preview";
import { Photos } from "~/components/photos/Photos";
import { Photo, getPhotosSource } from "~/data/sources/photo";
import { useHistoryState } from "~/hooks/useHistoryState";
import { Navigation } from "~/components/Navigation";
import slugify from "@sindresorhus/slugify";
import { useDataSource } from "~/data/datasource";
import { getSourceImageSource } from "~/data/sources/image";

export type Config = {
  page: {
    width: number;
    height: number;
    margin: number;
    padding: number;
  };
};

export type ImageSheet = ReturnType<typeof useImageSheets>["value"][number];

// upload pipeline
// -
// -

function useImageSheets(config: Config, photos: Photo[]) {
  // return useComputed$(() => {
  const packer = new MaxRectsPacker(config.page.width, config.page.height, config.page.margin, {
    allowRotation: false, // TODO: optimization
    smart: false,
    border: config.page.padding,
  });
  packer.addArray(
    photos.map((photo) => {
      const rect = new Rectangle(photo.width, photo.aspectRatio * photo.width);
      rect.data = photo;
      return rect;
    })
  );
  const value = packer.bins.map((bin) => {
    return {
      imageLayouts: bin.rects.map((rect) => ({
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        rotate: rect.rot,
        photo: rect.data as Photo,
      })),
    };
  });
  return { value };
  // });
}

const Content = component$<{ photos: Photo[] }>(({ photos }) => {
  const tab = useHistoryState<"Photos" | "Preview">("tab", "Preview");
  const projectName = "Lucy’s day at the beach";

  const config: Config = useStore({
    page: {
      width: 8.5,
      height: 11,
      margin: 0.25,
      padding: 0.5,
    },
  });

  const pages = useSignal<HTMLElement[]>([]);
  const imageSheets = useImageSheets(config, photos);

  const download = $(async () => {
    const objectUrlsToRevoke: string[] = [];

    const doc = new jsPDF({
      unit: "in",
      orientation: "p",
      format: [config.page.width, config.page.height],
    });

    doc.deletePage(1);

    for (const sheet of imageSheets.value) {
      doc.addPage();

      for (const image of sheet.imageLayouts) {
        const blob = await new Promise<Blob>((resolve) => {
          getSourceImageSource(image.photo.id).subscribe((image) => {
            resolve(image.blob);
          });
        });

        const data = exifreader.load(await blob.arrayBuffer());
        const src = URL.createObjectURL(blob);
        objectUrlsToRevoke.push(src);

        switch (data.Orientation?.value) {
          // TODO fill in more cases
          // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
          case 6:
            doc.addImage(
              src,
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
            doc.addImage(src, blob.type, image.x, image.y, image.width, image.height);
            break;
        }
      }
    }

    doc.save(`${slugify(projectName, { customReplacements: [["’", ""]] })}.pdf`);
    objectUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
  });

  return (
    <div class={css({ display: "flex", flexDir: "column", alignItems: "center" })}>
      <div
        class={css({
          bg: "white",
          pos: "sticky",
          top: "0",
          paddingBlock: "5",
          zIndex: 1,
          boxShadow: "xs",
          w: "full",
          display: "flex",
          flexDir: "column",
          alignItems: "center",
        })}
      >
        <div class={css({ width: "xl", maxWidth: "11/12", display: "grid", gridGap: "4" })}>
          <h1
            class={css({
              w: "full",
              fontSize: "2xl",
              fontWeight: "extrabold",
              outlineColor: "transparent",
              lineHeight: "tight",
            })}
          >
            {projectName}
          </h1>
          <MobileTabs activeTab={tab} />
        </div>
      </div>
      <div
        class={css({
          width: "xl",
          maxWidth: "11/12",
          marginBlockStart: "4",
          marginBlockEnd: "5",
          display: "grid",
          gap: "4",
        })}
      >
        <Navigation onDownload={download} />
        <div>
          <div hidden={tab.value !== "Photos"}>
            <Photos config={config} photos={photos} />
          </div>
          <div hidden={tab.value !== "Preview"}>
            <Preview values={config} imageSheets={imageSheets.value} pages={pages} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default component$(() => {
  const photos = useDataSource($(() => getPhotosSource()));

  if (photos.isLoading) {
    return <>Loading...</>;
  }

  return <Content photos={photos.value} />;
});
