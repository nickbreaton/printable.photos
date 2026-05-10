# Image Preview Requirements

This document captures the behavior currently required by the image crop preview and editor. It is based on `src/components/ImagePreview.tsx`, `src/crop.ts`, `src/main.tsx`, `src/download.ts`, `src/style.css`, and `DESIGN.md`.

The requirements below describe the user-facing behavior and data rules. The current implementation uses SVG for the interactive preview, but SVG is not itself a product requirement unless explicitly called out under current implementation notes.

## Scope

- The preview displays one selected project image inside the crop dialog.
- The preview lets the user move and resize a crop rectangle for a selected target placement rectangle.
- The preview reports crop changes through `onCropChange` and reports crop completion through `onCropDone` when available.
- The crop rectangle represents a subset of the image and must remain contained within the image bounds.

## Coordinate Model

- Preview-space image height is normalized to `100` units.
- Preview-space image width is `100 * (image.width / image.height)`.
- Crop rectangles use `{ x, y, width, height }` in preview-space units.
- Saved crop rectangles are stored as percentages:
  - `x` is `crop.x / viewBoxWidth * 100`.
  - `y` is `crop.y` because preview-space height is already `100`.
  - `width` is `crop.width / viewBoxWidth * 100`.
  - `height` is `crop.height` because preview-space height is already `100`.
- Export converts the preview-space crop to source-image pixels using the same normalized coordinate model.

## Crop Aspect Ratio

- The editable crop rectangle must match the selected target crop aspect ratio.
- For an unrotated target rectangle, the aspect ratio is `currentCrop.width / currentCrop.height`.
- For a rotated target rectangle, the aspect ratio is `currentCrop.height / currentCrop.width`.
- Saved crops are keyed by the target crop aspect ratio rounded with `toFixed(6)`.

## Initial And Restored Crop

- When opening the crop dialog, the app first looks for a saved crop for the selected image and target crop aspect-ratio key.
- If a saved crop exists, the saved percentage crop is converted back to preview-space units and used as the active crop.
- If no saved crop exists, the initial crop is computed to be the largest centered crop with the target aspect ratio that fits inside the full image.
- The same saved-crop-or-initial-crop rule is used when rendering placed images on the page and when rendering images for PDF download.
- Closing the crop dialog clears the current selected crop and active crop state.
- Clicking the dialog `Done` button saves the active crop as percentages.
- Double-clicking the crop area calls `onCropDone` when provided, which currently saves the active crop from the dialog.

## Image Rendering

- The visible image must fill the normalized preview bounds.
- The displayed image must preserve the source image aspect ratio through the preview dimensions.
- The preview currently sets `dynamic-range-limit: standard` on the SVG root and on rendered page images.
- The current non-Safari path renders an `ImageBitmap` into a canvas inside the preview.
- The current Safari path renders a browser image element from an object URL because Safari is detected by Apple vendor plus Safari user agent while excluding Chrome, Chromium, CriOS, Firefox iOS, Edge iOS, and Android user agents.
- Object URLs created for preview loading must be revoked during cleanup.
- `ImageBitmap` instances created for preview rendering must be closed during cleanup.

## Crop Overlay

- The area outside the crop is dimmed relative to the crop area.
- Current opacity values are:
  - Outside crop: `0.4`.
  - Crop area in the mask: `0.95`.
- The crop rectangle frame uses the foreground theme color.
- The crop rectangle frame stroke width is `1` with non-scaling stroke behavior in the current SVG implementation.
- The crop area itself is transparent and is the drag target for moving the crop.

## Grabbers And Handles

- Resize grabbers are rendered on all four sides and all four corners.
- The supported handles are:
  - `top`
  - `right`
  - `bottom`
  - `left`
  - `top-left`
  - `top-right`
  - `bottom-right`
  - `bottom-left`
- Side grabbers are centered on their side.
- Corner grabbers form an L shape at each corner.
- Grabber visual length is capped by crop size:
  - Corner grabber length is the smaller of `4`, `crop.width / 4`, and `crop.height / 4`.
  - Side grabber length is the smaller of `6`, `crop.width / 3`, and `crop.height / 3`.
- Grabber visual stroke width is `0.75` with non-scaling stroke behavior in the current SVG implementation.
- Grabbers use square line caps in the current SVG implementation.
- Handle hit targets are larger than the visible grabbers.
- Current handle hit stroke width is `8` with a transparent stroke and non-scaling stroke behavior in the current SVG implementation.
- Side handle hit targets span the full corresponding crop edge.
- Corner handle hit targets cover the corresponding corner L shape, using the corner grabber length plus grabber offset.
- Grabber offset is `grabberStrokeWidth / 2`.

## Cursor Behavior

- Moving the crop uses the `move` cursor.
- Top and bottom handles use `ns-resize`.
- Left and right handles use `ew-resize`.
- Top-left and bottom-right handles use `nwse-resize`.
- Top-right and bottom-left handles use `nesw-resize`.

## Pointer Interaction

- Pointer down on the crop rectangle starts a move drag.
- Pointer down on a handle starts a resize drag for that handle.
- On pointer down, the preview records:
  - The drag type.
  - The pointer position converted into preview-space coordinates.
  - A copy of the crop rectangle at drag start.
- Pointer movement is tracked on `window` after drag start.
- Pointer release is tracked on `window` after drag start.
- Pointer down prevents the default browser action.
- Pointer movement updates the crop through `onCropChange`.
- Pointer release clears the drag state and removes the window listeners.
- Component cleanup removes any remaining pointer listeners.

## Move Constraints

- Moving preserves the crop width and height.
- Moving changes `x` by pointer delta `dx` and `y` by pointer delta `dy` in preview-space units.
- After movement, the crop is constrained so it remains fully inside the image bounds.
- The crop `x` value is clamped between `0` and `viewBoxWidth - crop.width`.
- The crop `y` value is clamped between `0` and `100 - crop.height`.

## Resize Behavior

- Resizing always preserves the target crop aspect ratio.
- The crop is constrained after every resize so it remains fully inside the image bounds.
- `bottom-right` resizes from the top-left anchor using `start.width + dx`.
- `top-left` resizes from the bottom-right anchor using `start.width - dx`.
- `top-right` resizes from the bottom-left anchor using `start.width + dx`.
- `bottom-left` resizes from the top-right anchor using `start.width - dx`.
- `right` resizes horizontally from the left edge using `start.width + dx` and shifts `y` to keep the crop vertically centered around its previous center.
- `left` resizes horizontally from the right edge using `start.width - dx` and shifts `y` to keep the crop vertically centered around its previous center.
- `top` resizes vertically from the bottom edge using `start.height - dy` and shifts `x` to keep the crop horizontally centered around its previous center.
- `bottom` resizes vertically from the top edge using `start.height + dy` and shifts `x` to keep the crop horizontally centered around its previous center.

## Minimum Crop Size

- The crop has a screen-space minimum size of `100` pixels.
- The minimum size is converted to preview-space units from the current rendered preview width.
- If the preview element is not available, the fallback minimum preview-space dimension is `3`.
- Minimum size is enforced during resize constraint handling.

## Boundary Constraints

- Constraint handling recomputes height from width and the target aspect ratio.
- If the crop width exceeds image width, width is reduced to image width and height is recomputed.
- If the crop height exceeds image height, height is reduced to image height and width is recomputed.
- If crop width is below the minimum dimension, width is raised to the minimum and height is recomputed.
- If crop height is below the minimum dimension, height is raised to the minimum and width is recomputed.
- After size constraints, `x` and `y` are clamped so the crop remains contained in the image.

## Theme And Visual Styling

- Crop frame and grabber strokes use the foreground theme color through `stroke-foreground`.
- The foreground theme color changes with `prefers-color-scheme: dark`.
- Current light foreground is `oklch(0.145 0 0)`.
- Current dark foreground is `oklch(0.985 0 0)`.
- The preview root accepts an optional class from the caller.
- The current preview root classes make it block-level, height-filling, width-auto, max-height and max-width constrained, minimum-width zero, standard dynamic range, and overflow-visible.
- The crop dialog renders the preview inside a centered grid container with overflow visible and padding.
- Project design follows the Tailwind/ShadCN Maia neutral preset described in `DESIGN.md`, using Figtree and neutral colors.

## Current SVG Implementation Notes

- The current implementation uses an SVG root with a `viewBox` matching the normalized preview bounds.
- The current implementation uses an SVG mask to dim outside-crop and reveal the crop area.
- The current implementation uses SVG paths for grabber visuals and transparent hit targets.
- The current implementation uses `vector-effect="non-scaling-stroke"` for frame, grabber, and hit-target strokes.
- A replacement implementation does not need to use SVG if it preserves the behavior and visual requirements above.
