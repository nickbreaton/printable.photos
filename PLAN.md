# Plan

Use a shared scene model as the single source of truth.

## Renderers

1. Preview renderer uses raw DOM.
2. Image export uses `OffscreenCanvas`.
3. PDF export uses `pdf-lib`.

## PDF Export (`pdf-lib`)

### Goals

1. Match the configured document/page options exactly (size, orientation, margins, units).
2. Keep image layout consistent with preview (position, scale mode, alignment, rotation).
3. Keep output file sizes predictable by capping effective raster density.

### Page Size Mapping

1. Normalize document options into final page dimensions in PDF points (`72 pt = 1 in`).
2. Convert from configured units:
   - `in -> pt`: `value * 72`
   - `mm -> pt`: `value * 72 / 25.4`
3. Apply orientation after size resolution:
   - `portrait`: `[widthPt, heightPt]`
   - `landscape`: `[heightPt, widthPt]`
4. Create one `pdf-lib` page per scene page with resolved dimensions.

### Shared Geometry Contract

1. Store scene/layout geometry in one canonical space (CSS px recommended).
2. Export pipeline performs one deterministic transform:
   - `scene px -> PDF pt` with scale `72 / 96`
3. Every renderer (DOM preview, image export, PDF) reads the same scene box model:
   - page frame
   - content bounds
   - placed image bounds
   - transforms (rotation/flip)

### DPI and File Size Guardrails

1. Define target export DPI for placed raster images:
   - always `300 DPI`
2. For each placed image, compute required output pixels from physical size:
   - `requiredPxW = placedWidthInches * targetDpi`
   - `requiredPxH = placedHeightInches * targetDpi`
3. Always downsample to target output size before embedding using `pica`.
4. Do not upscale images above source resolution.

Result: print-appropriate quality while avoiding massive PDFs from oversized originals.
