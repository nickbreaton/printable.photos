import { createMemo } from "solid-js";
import type { JSX } from "@solidjs/web";

export function AsyncImage(props: JSX.ImgHTMLAttributes<HTMLImageElement>) {
  const source = createMemo(async () => {
    return new Promise<string>((resolve, reject) => {
      const imageElement = new Image();
      imageElement.onload = () => {
        resolve(imageElement.src);
        imageElement.remove();
      };
      imageElement.onerror = reject;
      if (props.src) imageElement.src = props.src;
      imageElement.hidden = true;
      document.head.append(imageElement);
    });
  });

  return <img {...props} src={source()} />;
}

