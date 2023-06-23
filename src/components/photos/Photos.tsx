import { component$ } from "@builder.io/qwik";
import { Config } from "~/routes";
import { getConnection } from "~/utils/data";
import { css } from "~/panda/css";

export const Photos = component$<{ config: Config }>(({ config }) => {
  return (
    <div class={css({ background: "white" })}>
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
