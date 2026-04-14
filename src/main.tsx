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

const [paper, setPaper] = createStore({
  width: 8.5,
  height: 11,
  margin: 0.25,
  gap: 0.25,
  units: "in",
});

const [imageConfig, setImageConfig] = createStore({
  width: 3,
});

const PAPER_PRESETS = [
  { label: "4x6", value: "4x6", width: 4, height: 6 },
  { label: "5x7", value: "5x7", width: 5, height: 7 },
  { label: "8x10", value: "8x10", width: 8, height: 10 },
  { label: "Letter", value: "Letter", width: 8.5, height: 11 },
  { label: "Legal", value: "Legal", width: 8.5, height: 14 },
  { label: "Tabloid", value: "Tabloid", width: 11, height: 17 },
] as const;

const image1 = createImage("/fixtures/image1.jpg");
const image2 = createImage("/fixtures/image2.jpg");
const image3 = createImage("/fixtures/image3.jpg");

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

const selectedPaperPreset = createMemo(() => {
  const matchingPreset = PAPER_PRESETS.find((preset) => {
    return preset.width === paper.width && preset.height === paper.height;
  });

  return matchingPreset?.value ?? "Custom";
});

function Sidebar() {
  return (
    <>
      <fieldset>
        <label>
          Paper:{" "}
          <select
            value={selectedPaperPreset()}
            onChange={(e) => {
              const selectedPreset = PAPER_PRESETS.find(
                (preset) => preset.value === e.target.value,
              );

              if (!selectedPreset) {
                return;
              }

              setPaper((paper) => {
                paper.width = selectedPreset.width;
                paper.height = selectedPreset.height;
              });
            }}
          >
            <option value="Custom">Custom</option>
            <For each={PAPER_PRESETS}>
              {(preset) => (
                <option value={preset().value}>{preset().label}</option>
              )}
            </For>
          </select>
        </label>
        <label>
          Width:{" "}
          <input
            type="number"
            step={1}
            value={paper.width}
            onChange={(e) =>
              setPaper((paper) => void (paper.width = e.target.valueAsNumber))
            }
          />
        </label>
        <label>
          Height:{" "}
          <input
            type="number"
            step={1}
            value={paper.height}
            onChange={(e) =>
              setPaper((paper) => void (paper.height = e.target.valueAsNumber))
            }
          />
        </label>
        <label>
          Margin:{" "}
          <input
            type="number"
            step={0.25}
            value={paper.margin}
            onChange={(e) =>
              setPaper((paper) => void (paper.margin = e.target.valueAsNumber))
            }
          />
        </label>
        <label>
          Gap:{" "}
          <input
            type="number"
            step={0.25}
            value={paper.gap}
            onChange={(e) =>
              setPaper((paper) => void (paper.gap = e.target.valueAsNumber))
            }
          />
        </label>
        <label>
          Units:{" "}
          <select
            value={paper.units}
            onChange={(e) =>
              setPaper(
                (paper) => void (paper.units = e.target.value as "in" | "mm"),
              )
            }
            disabled={
              true /* keep as inches until doing something smart for keeping same size but different units on selection */
            }
          >
            <option value="in">Inches</option>
            <option value="mm">Millimeters</option>
          </select>
        </label>
      </fieldset>
      <fieldset>
        <label>
          Image width:{" "}
          <input
            type="number"
            step={1}
            value={imageConfig.width}
            onChange={(e) =>
              setImageConfig(
                (imageConfig) =>
                  void (imageConfig.width = e.target.valueAsNumber),
              )
            }
          />
        </label>
      </fieldset>
    </>
  );
}

function Pages() {
  return (
    <div class="pages">
      <For each={bins()}>
        {(bin) => (
          <div
            class="page"
            style={{
              "aspect-ratio": paper.width / paper.height,
              "--page-width": paper.width + paper.units,
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
  );
}

function App() {
  return (
    <Loading>
      <style>
        {
          /* css */ `
          @page {
            size: ${paper.width}${paper.units} ${paper.height}${paper.units};
            margin: 0;
          }`
        }
      </style>
      <Sidebar />
      <Pages />
    </Loading>
  );
}

render(() => <App />, document.getElementById("root")!);
