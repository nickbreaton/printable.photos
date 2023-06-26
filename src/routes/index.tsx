import { component$, useSignal, $, useComputed$, Signal, useVisibleTask$ } from "@builder.io/qwik";
import { jsPDF } from "jspdf";
import { MaxRectsPacker, Rectangle } from "maxrects-packer";
import exifreader from "exifreader";
import { css } from "~/panda/css";
import { MobileTabs } from "~/components/MobileTabs";
import { Preview } from "~/components/preview/Preview";
import { Photos } from "~/components/photos/Photos";
import { Photo } from "~/database/tables/photo";
import { useHistoryState } from "~/hooks/useHistoryState";
import { Navigation } from "~/components/Navigation";
import slugify from "@sindresorhus/slugify";
import { db } from "~/database/main";
import { useLiveQuery$ } from "~/database/hooks";
import { getSourceImage } from "~/database/tables/image";
import { Project } from "~/database/tables/project";
import { EditableHeading } from "~/components/Heading";

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

function useImageSheets(project: Signal<Project>, photos: Signal<Photo[]>) {
  return useComputed$(() => {
    const packer = new MaxRectsPacker(project.value.width, project.value.height, project.value.gap, {
      allowRotation: false, // TODO: optimization
      smart: false,
      border: project.value.margin,
    });

    packer.addArray(
      photos.value.map((photo) => {
        const rect = new Rectangle(photo.width, photo.aspectRatio * photo.width);
        rect.data = photo;
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
          photo: rect.data as Photo,
        })),
      };
    });
  });
}

const Content = component$<{ project: Project; photos: Photo[] }>(({ project, photos }) => {
  const tab = useHistoryState<"Photos" | "Preview">("tab", "Preview");

  // const config: Config = useStore({
  //   page: {
  //     width: 8.5,
  //     height: 11,
  //     margin: 0.25,
  //     padding: 0.5,
  //   },
  // });

  const imageSheets = useImageSheets(
    // it seems a signal is needed to rerun use computed here?
    useComputed$(() => project),
    useComputed$(() => photos)
  );

  const download = $(async () => {
    const objectUrlsToRevoke: string[] = [];

    const doc = new jsPDF({
      unit: "in",
      orientation: "p",
      format: [project.width, project.height],
    });

    doc.deletePage(1);

    for (const sheet of imageSheets.value) {
      doc.addPage();

      for (const image of sheet.imageLayouts) {
        const { blob, src } = await getSourceImage(image.photo.id);

        const data = exifreader.load(await blob.arrayBuffer());
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

    doc.save(`${slugify(project.name, { customReplacements: [["’", ""]] })}.pdf`);
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
          <EditableHeading project={project} />
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
            <Photos project={project} photos={photos} />
          </div>
          <div hidden={tab.value !== "Preview"}>
            <Preview project={project} imageSheets={imageSheets.value} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default component$(() => {
  // use project id from query param or something to fetch both of the following
  const id = `project-0`;

  useVisibleTask$(() => {
    db.projects.count().then((count) => {
      if (count === 0) {
        db.projects.add({
          id,
          width: 8.5,
          height: 11,
          margin: 0.5,
          gap: 0.25,
          createdAt: new Date(),
          name: "Test",
          unit: "in",
        });
      }
    });
  });

  const project = useLiveQuery$(() => () => db.projects.where({ id }).first());
  const photos = useLiveQuery$(() => () => db.photos.where({ projectId: id }).toArray());

  if (photos.isLoading || project.isLoading) {
    return null; // TODO: handle this better
  }

  return <Content photos={photos.value} project={project.value!} />;
});
