import { createMemo, createRenderEffect, createSignal, For, onCleanup, snapshot } from "solid-js";
import type { Rectangle } from "maxrects-packer";

import type { ProjectImage } from "../data";
import { cn } from "../utils";
import { getCropAspectRatio, getImageViewBoxWidth, type CropRect } from "../crop";

const MIN_CROP_SCREEN_PX = 100;

// Visual config. Lengths are in viewBox units (viewBoxHeight = 100).
// Strokes are in CSS pixels so they remain crisp regardless of image size.
const cropFrameConfig = {
  cornerGrabberLength: 4,
  sideGrabberLength: 6,
  grabberStrokePx: 3,
  framePx: 1,
  hitStrokePx: 16,
};

// Distance (px) from the crop edge to the OUTER edge of the grabber stroke.
// Equal to outline thickness + grabber stroke thickness so the stroke sits in
// the gutter just outside the outline, not on top of it.
const GRABBER_OUTER_OFFSET_PX = cropFrameConfig.framePx + cropFrameConfig.grabberStrokePx;

// The area outside the crop is dimmed by overlaying the theme background
// (white in light mode, near-black in dark mode) at partial opacity. This
// makes it look as though the page background is showing through the image,
// instead of arbitrarily darkening with black.
//   outside crop: bg overlay at 0.6  -> ~40% image, ~60% bg
//   inside crop:  bg overlay at 0.05 -> ~95% image, ~5% bg
const OUTER_DIM_OPACITY = 0.6;
const INNER_DIM_OPACITY = 0.05;

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

type CropFrameHandle = (typeof CROP_FRAME_HANDLES)[number];

function getCropFrameHandleCursor(handle: CropFrameHandle) {
  if (handle === "top" || handle === "bottom") return "cursor-ns-resize";
  if (handle === "left" || handle === "right") return "cursor-ew-resize";
  if (handle === "top-left" || handle === "bottom-right") return "cursor-nwse-resize";
  return "cursor-nesw-resize";
}

function getDragCursor(type: DragType) {
  if (type === "move") return "move";
  if (type === "top" || type === "bottom") return "ns-resize";
  if (type === "left" || type === "right") return "ew-resize";
  if (type === "top-left" || type === "bottom-right") return "nwse-resize";
  return "nesw-resize";
}

type DragType = "move" | CropFrameHandle;

interface DragState {
  type: DragType;
  startPointer: { x: number; y: number };
  startCrop: CropRect;
}

function PreviewCanvas(props: { source: ImageBitmap; class?: string }) {
  let canvas: HTMLCanvasElement | undefined;

  // Render the bitmap at its native resolution. The canvas element itself is
  // sized via CSS (100% / 100%) and scaled by the browser like an <img>, so we
  // never need a ResizeObserver here.
  createRenderEffect(
    () => props.source,
    (image) => {
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = image.width;
      canvas.height = image.height;
      context.clearRect(0, 0, image.width, image.height);
      context.drawImage(image, 0, 0);
    },
  );

  return (
    <canvas
      ref={(element) => {
        canvas = element;
      }}
      class={props.class}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
      }}
    />
  );
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return max;
  return Math.max(min, Math.min(value, max));
}

function computeResize(
  handle: CropFrameHandle,
  dx: number,
  dy: number,
  startCrop: CropRect,
  viewBoxWidth: number,
  viewBoxHeight: number,
  aspectRatio: number,
  minDim: number,
): CropRect {
  const sc = startCrop;
  const centerX = sc.x + sc.width / 2;
  const centerY = sc.y + sc.height / 2;

  // These are max widths, not raw distances. Vertical distances are converted
  // through the crop aspect ratio so all handle math clamps a single value.
  const leftSpace = sc.x + sc.width;
  const rightSpace = viewBoxWidth - sc.x;
  const topSpace = (sc.y + sc.height) * aspectRatio;
  const bottomSpace = (viewBoxHeight - sc.y) * aspectRatio;
  const centeredXSpace = 2 * Math.min(centerX, viewBoxWidth - centerX);
  const centeredYSpace = 2 * Math.min(centerY, viewBoxHeight - centerY) * aspectRatio;
  const centeredMaxWidth = Math.min(centeredXSpace, centeredYSpace);

  switch (handle) {
    case "bottom-right": {
      const maxWidth = Math.min(rightSpace, bottomSpace);
      const newWidth = clamp(sc.width + dx, minDim, maxWidth);
      const newHeight = newWidth / aspectRatio;
      return { x: sc.x, y: sc.y, width: newWidth, height: newHeight };
    }
    case "top-left": {
      const maxWidth = Math.min(leftSpace, topSpace);
      const newWidth = clamp(sc.width - dx, minDim, maxWidth);
      const newHeight = newWidth / aspectRatio;
      return {
        x: sc.x + sc.width - newWidth,
        y: sc.y + sc.height - newHeight,
        width: newWidth,
        height: newHeight,
      };
    }
    case "top-right": {
      const maxWidth = Math.min(rightSpace, topSpace);
      const newWidth = clamp(sc.width + dx, minDim, maxWidth);
      const newHeight = newWidth / aspectRatio;
      return {
        x: sc.x,
        y: sc.y + sc.height - newHeight,
        width: newWidth,
        height: newHeight,
      };
    }
    case "bottom-left": {
      const maxWidth = Math.min(leftSpace, bottomSpace);
      const newWidth = clamp(sc.width - dx, minDim, maxWidth);
      const newHeight = newWidth / aspectRatio;
      return {
        x: sc.x + sc.width - newWidth,
        y: sc.y,
        width: newWidth,
        height: newHeight,
      };
    }
    // Side handles scale around the crop center, so dragging one side by N
    // changes the total crop width/height by 2N.
    case "right": {
      const newWidth = clamp(sc.width + dx * 2, minDim, centeredMaxWidth);
      const newHeight = newWidth / aspectRatio;
      return {
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2,
        width: newWidth,
        height: newHeight,
      };
    }
    case "left": {
      const newWidth = clamp(sc.width - dx * 2, minDim, centeredMaxWidth);
      const newHeight = newWidth / aspectRatio;
      return {
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2,
        width: newWidth,
        height: newHeight,
      };
    }
    case "top": {
      const newWidth = clamp((sc.height - dy * 2) * aspectRatio, minDim, centeredMaxWidth);
      const newHeight = newWidth / aspectRatio;
      return {
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2,
        width: newWidth,
        height: newHeight,
      };
    }
    case "bottom": {
      const newWidth = clamp((sc.height + dy * 2) * aspectRatio, minDim, centeredMaxWidth);
      const newHeight = newWidth / aspectRatio;
      return {
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2,
        width: newWidth,
        height: newHeight,
      };
    }
  }
}

export function ImagePreview(props: {
  image: ProjectImage & { url?: string };
  currentCrop: Rectangle;
  crop: CropRect;
  class?: string;
  onCropChange: (crop: CropRect) => void;
  onCropDone?: () => void;
}) {
  const cropAspectRatio = createMemo(() => getCropAspectRatio(props.currentCrop));

  const previewImage = createMemo(async () => {
    let bitmap: ImageBitmap | undefined;
    onCleanup(() => bitmap?.close());
    bitmap = await createImageBitmap(snapshot(props.image.blob));
    return bitmap;
  });

  const viewBoxHeight = 100;
  const viewBoxWidth = createMemo(() =>
    getImageViewBoxWidth(props.image.width, props.image.height),
  );

  // Horizontal viewBox units depend on image aspect ratio. Vertical units are
  // already percentages because the preview viewBox height is fixed at 100.
  const xPct = (x: number) => (x / viewBoxWidth()) * 100;

  const cropFrameGrabberLength = createMemo(() =>
    Math.min(cropFrameConfig.cornerGrabberLength, props.crop.width / 4, props.crop.height / 4),
  );
  const cropFrameSideGrabberLength = createMemo(() =>
    Math.min(cropFrameConfig.sideGrabberLength, props.crop.width / 3, props.crop.height / 3),
  );

  const [containerRef, setContainerRef] = createSignal<HTMLDivElement>();
  const [dragState, setDragState] = createSignal<DragState>();
  let dragCursorStyle: HTMLStyleElement | undefined;

  function lockDragCursor(type: DragType) {
    dragCursorStyle?.remove();
    dragCursorStyle = document.createElement("style");
    dragCursorStyle.textContent = `* { cursor: ${getDragCursor(type)} !important; }`;
    document.head.append(dragCursorStyle);
  }

  function unlockDragCursor() {
    dragCursorStyle?.remove();
    dragCursorStyle = undefined;
  }

  function clientToPreview(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = containerRef();
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * viewBoxWidth(),
      y: ((clientY - rect.top) / rect.height) * viewBoxHeight,
    };
  }

  function getMinPreviewDim(): number {
    const el = containerRef();
    if (!el) return 3;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 3;
    const pixelsPerUnit = rect.width / viewBoxWidth();
    return MIN_CROP_SCREEN_PX / pixelsPerUnit;
  }

  function handlePointerDown(e: PointerEvent, type: DragType) {
    const point = clientToPreview(e.clientX, e.clientY);
    if (!point) return;
    setDragState({
      type,
      startPointer: point,
      startCrop: { ...props.crop },
    });
    lockDragCursor(type);
    e.preventDefault();

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
  }

  function handleWindowPointerMove(e: PointerEvent) {
    const state = dragState();
    if (!state) return;
    const point = clientToPreview(e.clientX, e.clientY);
    if (!point) return;

    const dx = point.x - state.startPointer.x;
    const dy = point.y - state.startPointer.y;
    const sc = state.startCrop;
    const ar = cropAspectRatio();
    const vbw = viewBoxWidth();
    const minDim = getMinPreviewDim();

    if (state.type === "move") {
      // Moving preserves size. Clamp position only after making sure the crop
      // size itself can fit in the image at the requested aspect ratio.
      const maxWidth = Math.min(vbw, viewBoxHeight * ar);
      const width = clamp(sc.width, Math.min(minDim, maxWidth), maxWidth);
      const height = width / ar;
      props.onCropChange({
        x: clamp(sc.x + dx, 0, vbw - width),
        y: clamp(sc.y + dy, 0, viewBoxHeight - height),
        width,
        height,
      });
      return;
    }

    props.onCropChange(computeResize(state.type, dx, dy, sc, vbw, viewBoxHeight, ar, minDim));
  }

  function handleWindowPointerUp() {
    setDragState();
    unlockDragCursor();
    window.removeEventListener("pointermove", handleWindowPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
  }

  onCleanup(() => {
    unlockDragCursor();
    window.removeEventListener("pointermove", handleWindowPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
  });

  // Crop position/size as CSS percentages (memoized strings to keep DOM updates cheap).
  const cropLeft = createMemo(() => `${xPct(props.crop.x)}%`);
  const cropTop = createMemo(() => `${props.crop.y}%`);
  const cropWidth = createMemo(() => `${xPct(props.crop.width)}%`);
  const cropHeight = createMemo(() => `${props.crop.height}%`);
  const cropRight = createMemo(() => `${xPct(props.crop.x + props.crop.width)}%`);
  const cropBottom = createMemo(() => `${props.crop.y + props.crop.height}%`);

  // Visible grabber visuals.
  //
  // All grabbers sit OUTSIDE the crop's outline, in the gutter. The outer
  // edge of every stroke is GRABBER_OUTER_OFFSET_PX away from the crop edge.
  // Corners are an L formed by two adjacent borders on a single div whose
  // outer corner is offset diagonally; side handles are a short bar offset
  // perpendicular to their edge.
  const STROKE_PX = cropFrameConfig.grabberStrokePx;
  const FRAME_PX = cropFrameConfig.framePx;
  const OFFSET_PX = GRABBER_OUTER_OFFSET_PX; // = FRAME_PX + STROKE_PX
  const stroke = `${STROKE_PX}px solid currentColor`;

  function getCornerGrabber(handle: CropFrameHandle) {
    const len = cropFrameGrabberLength();
    const lenW = `${xPct(len)}%`;
    const lenH = `${len}%`;
    // Each corner is a square sized (lenW + OFFSET_PX) × (lenH + OFFSET_PX).
    // Two adjacent borders form the L; the third side of the box overlaps
    // the crop edges by the grabber length, painting the inner segments of
    // the L just outside the outline.
    const sizeW = `calc(${lenW} + ${OFFSET_PX}px)`;
    const sizeH = `calc(${lenH} + ${OFFSET_PX}px)`;

    const base = {
      position: "absolute" as const,
      width: sizeW,
      height: sizeH,
      "pointer-events": "none" as const,
    };

    switch (handle) {
      case "top-left":
        return {
          ...base,
          top: `calc(${cropTop()} - ${OFFSET_PX}px)`,
          left: `calc(${cropLeft()} - ${OFFSET_PX}px)`,
          "border-top": stroke,
          "border-left": stroke,
        };
      case "top-right":
        return {
          ...base,
          top: `calc(${cropTop()} - ${OFFSET_PX}px)`,
          left: `calc(${cropRight()} - ${lenW})`,
          "border-top": stroke,
          "border-right": stroke,
        };
      case "bottom-right":
        return {
          ...base,
          top: `calc(${cropBottom()} - ${lenH})`,
          left: `calc(${cropRight()} - ${lenW})`,
          "border-bottom": stroke,
          "border-right": stroke,
        };
      case "bottom-left":
        return {
          ...base,
          top: `calc(${cropBottom()} - ${lenH})`,
          left: `calc(${cropLeft()} - ${OFFSET_PX}px)`,
          "border-bottom": stroke,
          "border-left": stroke,
        };
      default:
        return base;
    }
  }

  function getSideGrabber(handle: CropFrameHandle) {
    const len = cropFrameSideGrabberLength();

    if (handle === "top" || handle === "bottom") {
      const widthCss = `${xPct(len)}%`;
      const leftCss = `${xPct(props.crop.x + props.crop.width / 2 - len / 2)}%`;
      // Use a 0-height div with `border-top`. The stroke ends up immediately
      // below the div's top edge, so position the top edge such that the
      // stroke lands just outside the outline.
      //   top side:    div-top = cropTop - (FRAME + STROKE) → stroke at [-3, -1]
      //   bottom side: div-top = cropBottom + FRAME         → stroke at [+1, +3]
      const topCss =
        handle === "top"
          ? `calc(${cropTop()} - ${OFFSET_PX}px)`
          : `calc(${cropBottom()} + ${FRAME_PX}px)`;
      return {
        position: "absolute" as const,
        top: topCss,
        left: leftCss,
        width: widthCss,
        height: "0",
        "border-top": stroke,
        "pointer-events": "none" as const,
      };
    }

    const heightCss = `${len}%`;
    const topCss = `${props.crop.y + props.crop.height / 2 - len / 2}%`;
    const leftCss =
      handle === "left"
        ? `calc(${cropLeft()} - ${OFFSET_PX}px)`
        : `calc(${cropRight()} + ${FRAME_PX}px)`;
    return {
      position: "absolute" as const,
      top: topCss,
      left: leftCss,
      width: "0",
      height: heightCss,
      "border-left": stroke,
      "pointer-events": "none" as const,
    };
  }

  // Hit targets: invisible rectangles centered on the visible grabber strokes
  // (which sit just outside the crop edge). Sides span the full edge; corners
  // cover the L plus a buffer outward.
  function getHitTargetStyle(handle: CropFrameHandle) {
    const hit = cropFrameConfig.hitStrokePx;
    const half = hit / 2;
    const cornerLen = cropFrameGrabberLength();
    const lenW = `${xPct(cornerLen)}%`;
    const lenH = `${cornerLen}%`;

    const base = {
      position: "absolute" as const,
      "touch-action": "none" as const,
    };

    // Side hit targets span the corresponding crop edge and are centered on
    // the stroke that sits FRAME+STROKE/2 px outside the edge.
    const sideHalfPx = half;
    switch (handle) {
      case "top":
        return {
          ...base,
          left: cropLeft(),
          top: `calc(${cropTop()} - ${sideHalfPx}px)`,
          width: cropWidth(),
          height: `${hit}px`,
        };
      case "bottom":
        return {
          ...base,
          left: cropLeft(),
          top: `calc(${cropBottom()} - ${sideHalfPx}px)`,
          width: cropWidth(),
          height: `${hit}px`,
        };
      case "left":
        return {
          ...base,
          left: `calc(${cropLeft()} - ${sideHalfPx}px)`,
          top: cropTop(),
          width: `${hit}px`,
          height: cropHeight(),
        };
      case "right":
        return {
          ...base,
          left: `calc(${cropRight()} - ${sideHalfPx}px)`,
          top: cropTop(),
          width: `${hit}px`,
          height: cropHeight(),
        };
      // Corner hit targets cover the L (length × length) and extend outward
      // by `half` px so the user can grab them in the gutter as well.
      case "top-left":
        return {
          ...base,
          left: `calc(${cropLeft()} - ${half}px)`,
          top: `calc(${cropTop()} - ${half}px)`,
          width: `calc(${lenW} + ${half}px)`,
          height: `calc(${lenH} + ${half}px)`,
        };
      case "top-right":
        return {
          ...base,
          left: `calc(${cropRight()} - ${lenW})`,
          top: `calc(${cropTop()} - ${half}px)`,
          width: `calc(${lenW} + ${half}px)`,
          height: `calc(${lenH} + ${half}px)`,
        };
      case "bottom-right":
        return {
          ...base,
          left: `calc(${cropRight()} - ${lenW})`,
          top: `calc(${cropBottom()} - ${lenH})`,
          width: `calc(${lenW} + ${half}px)`,
          height: `calc(${lenH} + ${half}px)`,
        };
      case "bottom-left":
        return {
          ...base,
          left: `calc(${cropLeft()} - ${half}px)`,
          top: `calc(${cropBottom()} - ${lenH})`,
          width: `calc(${lenW} + ${half}px)`,
          height: `calc(${lenH} + ${half}px)`,
        };
    }
  }

  return (
    <div
      ref={setContainerRef}
      class={cn(
        "relative min-h-full max-w-full [dynamic-range-limit:standard] text-foreground",
        props.class,
      )}
      style={{
        "aspect-ratio": props.image.width / props.image.height,
      }}
    >
      {/* Image */}
      <PreviewCanvas source={previewImage()} class="absolute inset-0 h-full w-full" />

      {/* Inner dim across the entire image (applies to inside-crop too). */}
      <div
        class="pointer-events-none absolute inset-0 bg-background"
        style={{ opacity: INNER_DIM_OPACITY }}
      />

      {/* Outer dim: 4 strips around the crop rect. */}
      <div
        class="pointer-events-none absolute left-0 right-0 bg-background"
        style={{ top: 0, height: cropTop(), opacity: OUTER_DIM_OPACITY }}
      />
      <div
        class="pointer-events-none absolute left-0 right-0 bg-background"
        style={{ top: cropBottom(), bottom: 0, opacity: OUTER_DIM_OPACITY }}
      />
      <div
        class="pointer-events-none absolute bg-background"
        style={{
          left: 0,
          width: cropLeft(),
          top: cropTop(),
          height: cropHeight(),
          opacity: OUTER_DIM_OPACITY,
        }}
      />
      <div
        class="pointer-events-none absolute bg-background"
        style={{
          left: cropRight(),
          right: 0,
          top: cropTop(),
          height: cropHeight(),
          opacity: OUTER_DIM_OPACITY,
        }}
      />

      {/* Crop frame border. */}
      <div
        class="pointer-events-none absolute"
        style={{
          left: cropLeft(),
          top: cropTop(),
          width: cropWidth(),
          height: cropHeight(),
          outline: `${cropFrameConfig.framePx}px solid currentColor`,
        }}
      />

      {/* Visible grabbers. */}
      <For each={CROP_FRAME_HANDLES}>
        {(handle) => {
          const isCorner = () => handle().includes("-");
          return <div style={isCorner() ? getCornerGrabber(handle()) : getSideGrabber(handle())} />;
        }}
      </For>

      {/* Move target (covers the crop area). */}
      <div
        class="absolute cursor-move"
        style={{
          left: cropLeft(),
          top: cropTop(),
          width: cropWidth(),
          height: cropHeight(),
          "touch-action": "none",
        }}
        onDblClick={() => props.onCropDone?.()}
        onPointerDown={(e) => handlePointerDown(e, "move")}
      />

      {/* Handle hit targets. */}
      <For each={CROP_FRAME_HANDLES}>
        {(handle) => (
          <div
            class={getCropFrameHandleCursor(handle())}
            style={getHitTargetStyle(handle())}
            onPointerDown={(e) => handlePointerDown(e, handle())}
          />
        )}
      </For>
    </div>
  );
}
