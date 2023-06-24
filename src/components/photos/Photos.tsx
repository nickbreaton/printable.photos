import { component$ } from "@builder.io/qwik";
import { Config } from "~/routes";
import { css } from "~/panda/css";
import { addPhoto } from "~/utils/data";

export const Photos = component$<{ config: Config }>(({ config }) => {
  return (
    <div class={css({ background: "white" })}>
      <h2>Images</h2>
      <form
        preventdefault:submit
        style={{ border: "1px solid #444", padding: "20px" }}
        onSubmit$={async (event) => {
          const file = new FormData(event.target as any).get("image") as File;

          await addPhoto({
            id: `photo-${crypto.randomUUID()}`,
            name: file.name,
            aspectRatio: 0,
            width: 0,
            unit: "inches",
            blob: new Blob([file], { type: file.type }),
          });
        }}
      >
        <input type="file" name="image" accept="image/*" class={css({ w: "full" })} />
        <button type="submit">Upload</button>
      </form>
      {config.images.map((image) => (
        <img key={image.src} src={image.src} alt="" width={100} height={100} />
      ))}
    </div>
  );
});
