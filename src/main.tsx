import { render } from "@solidjs/web";

import "./style.css";
import { createMemo, createStore, For, Loading } from "solid-js";
import { MaxRectsPacker } from "maxrects-packer";

function createImage(src: string) {
  return createMemo(() => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = src;
    });
  });
}

function App() {
  const image1 = createImage("/fixtures/image1.jpg");
  const image2 = createImage("/fixtures/image2.jpg");
  const image3 = createImage("/fixtures/image3.jpg");

  const [paper] = createStore({
    width: 8.5,
    height: 11,
    units: "inches",
  });

  const [imageConfig] = createStore({
    width: 4,
    units: "inches",
  });

  const bins = createMemo(() => {
    const packer = new MaxRectsPacker(paper.width, paper.height, 0, {
      // allowRotation: true,
    });
    const image = image1();
    const aspectRatio = image.height / image.width;
    const proportionalHeight = imageConfig.width * aspectRatio;
    packer.add(imageConfig.width, proportionalHeight, null);
    packer.add(imageConfig.width, proportionalHeight, null);
    packer.add(imageConfig.width, proportionalHeight, null);
    return packer.bins;
  });

  return (
    <Loading>
      {console.log(bins()) ?? ""}
      <div class="pages">
        <For each={bins()}>
          {(bin) => (
            <div
              class="page"
              style={{ "aspect-ratio": paper.width / paper.height }}
            >
              <For each={bin().rects}>
                {(rect) => (
                  <img
                    src={image1().src}
                    style={{
                      top: (rect().y / paper.height) * 100 + "%",
                      left: (rect().x / paper.width) * 100 + "%",
                      width: (rect().width / paper.width) * 100 + "%",
                      height: (rect().height / paper.height) * 100 + "%",
                    }}
                  />
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </Loading>
  );
}

render(() => <App />, document.getElementById("root")!);
