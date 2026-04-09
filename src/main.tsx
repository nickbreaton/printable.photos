import { render } from "@solidjs/web";

import "./style.css";
import { createMemo, createStore, For, Loading, type JSX } from "solid-js";
import { MaxRectsPacker, type Rectangle } from "maxrects-packer";

function toPercent(value: number, total: number) {
  return (value / total) * 100 + "%";
}

function getPhotoStyle(
  rect: Rectangle,
  paper: { width: number; height: number },
): JSX.CSSProperties {
  if (!rect.rot) {
    return {
      position: "absolute",
      top: toPercent(rect.y, paper.height),
      left: toPercent(rect.x, paper.width),
      width: toPercent(rect.width, paper.width),
      height: toPercent(rect.height, paper.height),
    };
  }

  return {
    position: "absolute",
    top: toPercent(rect.y + rect.height / 2, paper.height),
    left: toPercent(rect.x + rect.width / 2, paper.width),
    width: toPercent(rect.height, paper.width),
    height: toPercent(rect.width, paper.height),
    transform: "translate(-50%, -50%) rotate(90deg)",
    "transform-origin": "center",
  };
}

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
    width: 5,
    height: 7,
    margin: 0.25,
    gap: 0.25,
    units: "in",
  });

  const [imageConfig] = createStore({
    width: 1.5,
    units: "in",
  });

  const bins = createMemo(() => {
    const packer = new MaxRectsPacker(paper.width, paper.height, paper.gap, {
      border: paper.margin,
      smart: false,
      pot: false,
      square: false,
      allowRotation: false,
    });

    const addImage = (image: HTMLImageElement) => {
      const aspectRatio = image.height / image.width;
      const proportionalHeight = imageConfig.width * aspectRatio;
      packer.add(imageConfig.width, proportionalHeight, { src: image.src });
    };

    addImage(image1());
    addImage(image2());
    addImage(image3());

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
              style={{
                "aspect-ratio": paper.width / paper.height,
                "max-width": paper.width + paper.units,
              }}
            >
              <For each={bin().rects}>
                {(rect) => (
                  <img
                    class="photo"
                    src={rect().data.src}
                    style={getPhotoStyle(rect(), paper)}
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
