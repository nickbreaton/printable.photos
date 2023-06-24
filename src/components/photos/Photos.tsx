import { component$ } from "@builder.io/qwik";
import { Config } from "~/routes";
import { css } from "~/panda/css";
import { Photo, PhotoId, addPhoto } from "~/data/sources/photo";
import { addImage } from "~/data/sources/image";

export const Photos = component$<{ config: Config; photos: Photo[] }>(({ photos }) => {
  return (
    <div class={css({ background: "white" })}>
      <h2>Images</h2>
      <form
        preventdefault:submit
        style={{ border: "1px solid #444", padding: "20px" }}
        onSubmit$={async (event) => {
          const file = new FormData(event.target as any).get("image") as File;
          const blob = new Blob([file], { type: file.type });

          const aspectRatio = await new Promise<number>((resolve) => {
            const img = document.createElement("img");
            img.onload = () => {
              resolve(img.height / img.width);
              URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(blob);
          });

          const photoId: PhotoId = `photo-${crypto.randomUUID()}`;

          // TODO: parallelize, use same transaction

          await addPhoto({
            id: photoId,
            name: file.name,
            aspectRatio,
            width: 4,
            unit: "inches",
            createdAt: new Date(),
          });

          await addImage({
            type: "source",
            id: `image-${crypto.randomUUID()}`,
            blob,
            photoId,
          });
        }}
      >
        <input type="file" name="image" accept="image/*" class={css({ w: "full" })} />
        <button type="submit">Upload</button>
      </form>
      {photos.map((photo) => (
        <span key={photo.id}>{photo.name}</span>
      ))}
    </div>
  );
});
