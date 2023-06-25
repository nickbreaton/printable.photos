import { component$ } from "@builder.io/qwik";
import { css } from "~/panda/css";
import { Photo, PhotoId } from "~/database/tables/photo";
import { db } from "~/database/main";
import { Project } from "~/database/tables/project";

export const Photos = component$<{ project: Project; photos: Photo[] }>(({ project, photos }) => {
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

          await db.transaction("rw", db.photos, db.images, async () => {
            const photoAddition = db.photos.add({
              id: photoId,
              projectId: project.id,
              name: file.name,
              aspectRatio,
              width: 4,
              unit: "in",
              createdAt: new Date(),
            });

            const imageAddition = db.images.add({
              type: "source",
              id: `image-${crypto.randomUUID()}`,
              blob,
              photoId,
            });

            return Promise.all([photoAddition, imageAddition]);
          });
        }}
      >
        <input type="file" name="image" accept="image/png, image/gif, image/jpeg" class={css({ w: "full" })} />
        <button type="submit">Upload</button>
      </form>
      <div class={css({ display: "grid", gap: "2", padding: "3" })}>
        <h2>Photos</h2>
        {photos.map((photo) => (
          <div key={photo.id}>
            <h3>{photo.name}</h3>
            <input
              type="text"
              placeholder="width"
              value={photo.width}
              onInput$={(event: any) => {
                const width = parseFloat(event.target.value);

                if (isNaN(width)) {
                  return;
                }

                db.photos.where({ id: photo.id }).modify({ width });
              }}
            />
            <button onClick$={() => db.photos.delete(photo.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
});
