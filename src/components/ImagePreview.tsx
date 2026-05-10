import {
  createMemo,
  createRenderEffect,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  snapshot,
} from "solid-js";
import type { Rectangle } from "maxrects-packer";

import type { ProjectImage } from "../data";
import { cn } from "../utils";
import {
  getCropAspectRatio,
  getImageViewBoxWidth,
  type CropRect,
} from "../crop";

const MIN_CROP_SCREEN_PX = 100;

const cropFrameConfig = {
  outerOpacity: 0.4,
  grabberLength: 4,
  sideGrabberLength: 6,
  grabberStrokeWidth: 0.75,
  frameStrokeWidth: 1,
  handleHitStrokeWidth: 8,
};

const CROP_FRAME_HANDLES = [
  "top",
  "right",
  "bottom",
  "left",
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
] as const;

function isSafariBrowser() {
  return (
    navigator.vendor.includes("Apple") &&
    /safari/i.test(navigator.userAgent) &&
    !/chrome|chromium|crios|fxios|edgios|android/i.test(navigator.userAgent)
  );
}

type CropFrameHandle = (typeof CROP_FRAME_HANDLES)[number];

function getCropFrameHandleCursor(handle: CropFrameHandle) {
  if (handle === "top" || handle === "bottom") {
    return "cursor-ns-resize";
  }

  if (handle === "left" || handle === "right") {
    return "cursor-ew-resize";
  }

  if (handle === "top-left" || handle === "bottom-right") {
    return "cursor-nwse-resize";
  }

  return "cursor-nesw-resize";
}

function clientToSVG(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const svgPoint = point.matrixTransform(ctm.inverse());
  return { x: svgPoint.x, y: svgPoint.y };
}

type DragType = "move" | CropFrameHandle;

interface DragState {
  type: DragType;
  startPointer: { x: number; y: number };
  startCrop: CropRect;
}

function PreviewCanvas(props: { source: ImageBitmap }) {
  let canvas: HTMLCanvasElement | undefined;

  createRenderEffect(
    () => props.source,
    (image) => {
      if (!canvas) return;

      const width = image.width;
      const height = image.height;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
    },
  );

  return (
    <canvas
      ref={(element) => {
        canvas = element;
      }}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
      }}
    />
  );
}

function computeResize(
  handle: CropFrameHandle,
  dx: number,
  dy: number,
  startCrop: CropRect,
  aspectRatio: number,
  minDim: number,
): CropRect {
  const sc = startCrop;

  switch (handle) {
    case "bottom-right": {
      const newWidth = Math.max(minDim, sc.width + dx);
      const newHeight = newWidth / aspectRatio;
      return { x: sc.x, y: sc.y, width: newWidth, height: newHeight };
    }
    case "top-left": {
      const newWidth = Math.max(minDim, sc.width - dx);
      const newHeight = newWidth / aspectRatio;
      return {
        x: sc.x + sc.width - newWidth,
        y: sc.y + sc.height - newHeight,
        width: newWidth,
        height: newHeight,
      };
    }
    case "top-right": {
      const newWidth = Math.max(minDim, sc.width + dx);
      const newHeight = newWidth / aspectRatio;
      return {
        x: sc.x,
        y: sc.y + sc.height - newHeight,
        width: newWidth,
        height: newHeight,
      };
    }
    case "bottom-left": {
      const newWidth = Math.max(minDim, sc.width - dx);
      const newHeight = newWidth / aspectRatio;
      return {
        x: sc.x + sc.width - newWidth,
        y: sc.y,
        width: newWidth,
        height: newHeight,
      };
    }
    case "right": {
      const newWidth = Math.max(minDim, sc.width + dx);
      const newHeight = newWidth / aspectRatio;
      const yShift = (newHeight - sc.height) / 2;
      return { x: sc.x, y: sc.y - yShift, width: newWidth, height: newHeight };
    }
    case "left": {
      const newWidth = Math.max(minDim, sc.width - dx);
      const newHeight = newWidth / aspectRatio;
      const yShift = (newHeight - sc.height) / 2;
      return {
        x: sc.x + sc.width - newWidth,
        y: sc.y - yShift,
        width: newWidth,
        height: newHeight,
      };
    }
    case "top": {
      const newHeight = Math.max(minDim, sc.height - dy);
      const newWidth = newHeight * aspectRatio;
      const xShift = (newWidth - sc.width) / 2;
      return {
        x: sc.x - xShift,
        y: sc.y + sc.height - newHeight,
        width: newWidth,
        height: newHeight,
      };
    }
    case "bottom": {
      const newHeight = Math.max(minDim, sc.height + dy);
      const newWidth = newHeight * aspectRatio;
      const xShift = (newWidth - sc.width) / 2;
      return {
        x: sc.x - xShift,
        y: sc.y,
        width: newWidth,
        height: newHeight,
      };
    }
  }
}

function constrainCrop(
  crop: CropRect,
  viewBoxWidth: number,
  viewBoxHeight: number,
  aspectRatio: number,
  minDim: number,
): CropRect {
  let { x, y, width, height } = crop;

  height = width / aspectRatio;

  if (width > viewBoxWidth) {
    width = viewBoxWidth;
    height = width / aspectRatio;
  }
  if (height > viewBoxHeight) {
    height = viewBoxHeight;
    width = height * aspectRatio;
  }

  if (width < minDim) {
    width = minDim;
    height = width / aspectRatio;
  }
  if (height < minDim) {
    height = minDim;
    width = height * aspectRatio;
  }

  x = Math.max(0, Math.min(x, viewBoxWidth - width));
  y = Math.max(0, Math.min(y, viewBoxHeight - height));

  return { x, y, width, height };
}

export function ImagePreview(props: {
  image: ProjectImage & { url?: string };
  currentCrop: Rectangle;
  crop: CropRect;
  class?: string;
  onCropChange: (crop: CropRect) => void;
  onCropDone?: () => void;
}) {
  const cropAspectRatio = createMemo(() => {
    return getCropAspectRatio(props.currentCrop);
  });

  const previewImage = createMemo(async () => {
    let bitmap: ImageBitmap | undefined;
    onCleanup(() => bitmap?.close());
    bitmap = await createImageBitmap(snapshot(props.image.blob));
    return bitmap;
  });

  const previewUrl = createMemo(() => {
    const url = URL.createObjectURL(
      snapshot(props.image.previewBlob ?? props.image.blob),
    );
    onCleanup(() => URL.revokeObjectURL(url));
    return new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(url);
      image.onerror = reject;
      image.src = url;
    });
  });

  const maskId = encodeURIComponent(createUniqueId());
  const imageAspectRatio = () => props.image.width / props.image.height;
  const viewBoxHeight = 100;
  const viewBoxWidth = createMemo(() => {
    return getImageViewBoxWidth(props.image.width, props.image.height);
  });

  const cropFrameRect = createMemo(() => props.crop);
  const cropFrameGrabberLength = createMemo(() => {
    return Math.min(
      cropFrameConfig.grabberLength,
      cropFrameRect().width / 4,
      cropFrameRect().height / 4,
    );
  });
  const cropFrameSideGrabberLength = createMemo(() => {
    return Math.min(
      cropFrameConfig.sideGrabberLength,
      cropFrameRect().width / 3,
      cropFrameRect().height / 3,
    );
  });
  const cropFrameGrabberOffset = createMemo(() => {
    return cropFrameConfig.grabberStrokeWidth / 2;
  });
  const getCropFrameHandlePath = (handle: CropFrameHandle) => {
    const rect = cropFrameRect();
    const cornerLength = cropFrameGrabberLength();
    const sideLength = cropFrameSideGrabberLength();
    const offset = cropFrameGrabberOffset();

    switch (handle) {
      case "top":
        return [
          `M ${rect.x + rect.width / 2 - sideLength / 2} ${rect.y - offset}`,
          `H ${rect.x + rect.width / 2 + sideLength / 2}`,
        ].join(" ");
      case "right":
        return [
          `M ${rect.x + rect.width + offset} ${rect.y + rect.height / 2 - sideLength / 2}`,
          `V ${rect.y + rect.height / 2 + sideLength / 2}`,
        ].join(" ");
      case "bottom":
        return [
          `M ${rect.x + rect.width / 2 - sideLength / 2} ${rect.y + rect.height + offset}`,
          `H ${rect.x + rect.width / 2 + sideLength / 2}`,
        ].join(" ");
      case "left":
        return [
          `M ${rect.x - offset} ${rect.y + rect.height / 2 - sideLength / 2}`,
          `V ${rect.y + rect.height / 2 + sideLength / 2}`,
        ].join(" ");
      case "top-left":
        return [
          `M ${rect.x + cornerLength} ${rect.y - offset}`,
          `H ${rect.x - offset}`,
          `V ${rect.y + cornerLength}`,
        ].join(" ");
      case "top-right":
        return [
          `M ${rect.x + rect.width - cornerLength} ${rect.y - offset}`,
          `H ${rect.x + rect.width + offset}`,
          `V ${rect.y + cornerLength}`,
        ].join(" ");
      case "bottom-right":
        return [
          `M ${rect.x + rect.width + offset} ${rect.y + rect.height - cornerLength}`,
          `V ${rect.y + rect.height + offset}`,
          `H ${rect.x + rect.width - cornerLength}`,
        ].join(" ");
      case "bottom-left":
        return [
          `M ${rect.x + cornerLength} ${rect.y + rect.height + offset}`,
          `H ${rect.x - offset}`,
          `V ${rect.y + rect.height - cornerLength}`,
        ].join(" ");
    }
  };
  const getCropFrameHandleHitPath = (handle: CropFrameHandle) => {
    const rect = cropFrameRect();
    const cornerLength = cropFrameGrabberLength() + cropFrameGrabberOffset();

    switch (handle) {
      case "top":
        return `M ${rect.x} ${rect.y} H ${rect.x + rect.width}`;
      case "right":
        return `M ${rect.x + rect.width} ${rect.y} V ${rect.y + rect.height}`;
      case "bottom":
        return `M ${rect.x} ${rect.y + rect.height} H ${rect.x + rect.width}`;
      case "left":
        return `M ${rect.x} ${rect.y} V ${rect.y + rect.height}`;
      case "top-left":
        return [
          `M ${rect.x + cornerLength} ${rect.y}`,
          `H ${rect.x}`,
          `V ${rect.y + cornerLength}`,
        ].join(" ");
      case "top-right":
        return [
          `M ${rect.x + rect.width - cornerLength} ${rect.y}`,
          `H ${rect.x + rect.width}`,
          `V ${rect.y + cornerLength}`,
        ].join(" ");
      case "bottom-right":
        return [
          `M ${rect.x + rect.width} ${rect.y + rect.height - cornerLength}`,
          `V ${rect.y + rect.height}`,
          `H ${rect.x + rect.width - cornerLength}`,
        ].join(" ");
      case "bottom-left":
        return [
          `M ${rect.x + cornerLength} ${rect.y + rect.height}`,
          `H ${rect.x}`,
          `V ${rect.y + rect.height - cornerLength}`,
        ].join(" ");
    }
  };

  const [svgRef, setSvgRef] = createSignal<SVGSVGElement>();
  const [dragState, setDragState] = createSignal<DragState>();

  function getMinSvgDim(): number {
    const svg = svgRef();
    if (!svg) return 3;
    const rect = svg.getBoundingClientRect();
    const vbw = viewBoxWidth();
    const pixelsPerSvgUnit = rect.width / vbw;
    return MIN_CROP_SCREEN_PX / pixelsPerSvgUnit;
  }

  function handlePointerDown(e: PointerEvent, type: DragType) {
    const svg = svgRef();
    if (!svg) return;
    const point = clientToSVG(svg, e.clientX, e.clientY);
    if (!point) return;
    setDragState({
      type,
      startPointer: point,
      startCrop: { ...props.crop },
    });
    e.preventDefault();

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
  }

  function handleWindowPointerMove(e: PointerEvent) {
    const state = dragState();
    const svg = svgRef();
    if (!state || !svg) return;
    const point = clientToSVG(svg, e.clientX, e.clientY);
    if (!point) return;

    const dx = point.x - state.startPointer.x;
    const dy = point.y - state.startPointer.y;
    const sc = state.startCrop;
    const ar = cropAspectRatio();
    const vbw = viewBoxWidth();
    const vbh = viewBoxHeight;
    const minDim = getMinSvgDim();

    let newCrop: CropRect;

    if (state.type === "move") {
      newCrop = {
        x: sc.x + dx,
        y: sc.y + dy,
        width: sc.width,
        height: sc.height,
      };
    } else {
      newCrop = computeResize(state.type, dx, dy, sc, ar, minDim);
    }

    props.onCropChange(constrainCrop(newCrop, vbw, vbh, ar, minDim));
  }

  function handleWindowPointerUp() {
    setDragState();
    window.removeEventListener("pointermove", handleWindowPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
  }

  onCleanup(() => {
    window.removeEventListener("pointermove", handleWindowPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
  });

  return (
    <svg
      ref={setSvgRef}
      class={cn(
        "block h-full w-auto max-h-full max-w-full min-w-0 dynamic-range-standard overflow-visible",
        props.class,
      )}
      viewBox={`0 0 ${viewBoxWidth()} ${viewBoxHeight}`}
      style={{
        "aspect-ratio": props.image.width / props.image.height,
      }}
    >
      <defs>
        <mask id={maskId}>
          <rect
            width={viewBoxWidth()}
            height={viewBoxHeight}
            fill="white"
            opacity={cropFrameConfig.outerOpacity}
          />
          <rect
            x={props.crop.x}
            y={props.crop.y}
            width={props.crop.width}
            height={props.crop.height}
            fill="white"
            opacity={0.95}
          />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        {isSafariBrowser() ? (
          <image
            href={previewUrl()}
            x={0}
            y={0}
            width={viewBoxWidth()}
            height={viewBoxHeight}
            preserveAspectRatio="none"
          />
        ) : (
          <foreignObject
            x={0}
            y={0}
            width={viewBoxWidth()}
            height={viewBoxHeight}
          >
            <PreviewCanvas source={previewImage()} />
          </foreignObject>
        )}
      </g>
      <rect
        x={props.crop.x}
        y={props.crop.y}
        width={props.crop.width}
        height={props.crop.height}
        fill="transparent"
        cursor="move"
        pointer-events="fill"
        onDblClick={() => props.onCropDone?.()}
        onPointerDown={(e) => handlePointerDown(e, "move")}
      />
      <g
        fill="none"
        class="stroke-foreground"
        stroke-linecap="square"
        stroke-width={cropFrameConfig.grabberStrokeWidth}
        vector-effect="non-scaling-stroke"
      >
        <For each={CROP_FRAME_HANDLES}>
          {(handle) => (
            <path
              class={getCropFrameHandleCursor(handle())}
              d={getCropFrameHandlePath(handle())}
              pointer-events="stroke"
              onPointerDown={(e) => handlePointerDown(e, handle())}
            />
          )}
        </For>
      </g>
      <rect
        fill="none"
        pointer-events="none"
        class="stroke-foreground"
        stroke-width={cropFrameConfig.frameStrokeWidth}
        vector-effect="non-scaling-stroke"
        x={cropFrameRect().x}
        y={cropFrameRect().y}
        width={cropFrameRect().width}
        height={cropFrameRect().height}
      />
      <g
        fill="none"
        stroke="transparent"
        stroke-linecap="square"
        stroke-width={cropFrameConfig.handleHitStrokeWidth}
        vector-effect="non-scaling-stroke"
      >
        <For each={CROP_FRAME_HANDLES}>
          {(handle) => (
            <path
              class={getCropFrameHandleCursor(handle())}
              d={getCropFrameHandleHitPath(handle())}
              pointer-events="stroke"
              onPointerDown={(e) => handlePointerDown(e, handle())}
            />
          )}
        </For>
      </g>
    </svg>
  );
}
