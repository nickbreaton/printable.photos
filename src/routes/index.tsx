import {
  component$,
  useComputed$,
  useSignal,
  useVisibleTask$,
  useStore,
  $,
  useResource$,
  QRL,
  noSerialize,
  NoSerialize,
} from "@builder.io/qwik";
import { jsPDF } from "jspdf";
import { MaxRectsPacker, Rectangle } from "maxrects-packer";
import exifreader from "exifreader";
import { css } from "~/panda/css";
import { MobileTabs } from "~/components/MobileTabs";
import { Preview } from "~/components/preview/Preview";
import { Photos } from "~/components/photos/Photos";
import { DataSource, Photo, photosSource } from "~/utils/data";
import { useHistoryState } from "~/hooks/useHistoryState";
import { Navigation } from "~/components/Navigation";
import slugify from "@sindresorhus/slugify";

export type Config = {
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

export type ImageSheet = ReturnType<typeof useImageSheets>["value"][number];

// upload pipeline
// -
// -

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

// function useFetcher<T>(fetcher: QRL<() => Promise<T>>) {
//   const data = useStore<
//     | { isLoading: true; isFetching: boolean; value: null }
//     | { isLoading: false; isFetching: boolean; value: NoSerialize<T> }
//   >({ isLoading: true, isFetching: true, value: null });

//   useVisibleTask$(() => {
//     fetcher().then((value) => {
//       data.value = noSerialize(value as any);
//       data.isFetching = false;
//       data.isLoading = false;
//     });
//   });

//   return data;
// }

function useDataSource<T>(getSource: QRL<() => DataSource<T>>) {
  const data = useStore<{ isLoading: true; value: null } | { isLoading: false; value: NoSerialize<T> }>({
    isLoading: true,
    value: null,
  });

  useVisibleTask$(({ cleanup }) => {
    getSource().then((source) => {
      cleanup(
        source.subscribe((next) => {
          data.isLoading = false;
          data.value = noSerialize(next as any);
        })
      );
    });
  });

  return data;
}

const Content = component$<{ photos: Photo[] }>(({ photos }) => {
  return <pre>{JSON.stringify(photos, null, 2)}</pre>;
});

export default component$(() => {
  const tab = useHistoryState<"Photos" | "Preview">("tab", "Preview");
  const projectName = "Lucy’s day at the beach";

  const photos = useDataSource($(() => photosSource));

  const config: Config = useStore({
    page: {
      width: 8.5,
      height: 11,
      margin: 0.25,
      padding: 0.5,
    },
    images: [
      // TODO: temp
      {
        width: 4,
        height: 4,
        src: "public/examples/pp.jpeg",
      },
      {
        width: 4,
        height: 5.326397919375813,
        src: "public/examples/cats.jpeg",
      },
      {
        width: 4,
        height: 5.326397919375813,
        src: "public/examples/breakfast.jpeg",
      },
    ],
  });

  const pages = useSignal<HTMLElement[]>([]);
  const imageSheets = useImageSheets(config);
  // const storedImages = useSignal<string[]>([]);

  // useVisibleTask$(({ cleanup }) => {
  //   getConnection().then(async ({ db, subscriber }) => {
  //     const read = async () => {
  //       const records = await db.getAll("images");
  //       config.images = await Promise.all(
  //         records.map(async (record) => {
  //           const src = URL.createObjectURL(record.blob);
  //           const ratio = await new Promise<number>((resolve) => {
  //             const img = document.createElement("img");
  //             img.onload = () => {
  //               resolve(img.height / img.width);
  //             };
  //             img.src = src;
  //           });
  //           return { src, width: 3, height: ratio * 3 };
  //         })
  //       );
  //     };
  //     cleanup(subscriber.subscribe(read));
  //     await read();
  //   });
  // });

  const download = $(async () => {
    const doc = new jsPDF({
      unit: "in",
      orientation: "p",
      format: [config.page.width, config.page.height],
    });

    doc.deletePage(1);

    for (const sheet of imageSheets.value) {
      doc.addPage();

      for (const image of sheet.imageLayouts) {
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

    doc.save(`${slugify(projectName, { customReplacements: [["’", ""]] })}.pdf`);
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
        {photos.isLoading ? null : <Content photos={photos.value} />}
        <div>
          {tab.value === "Photos" && <Photos config={config} />}
          {tab.value === "Preview" && <Preview values={config} imageSheets={imageSheets.value} pages={pages} />}
        </div>
      </div>
    </div>
  );
});
