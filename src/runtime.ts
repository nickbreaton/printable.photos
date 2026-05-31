import { Layer, ManagedRuntime } from "effect";

import { WebGraphicsService } from "./services/WebGraphicsService";
import { ImageExportService } from "./services/ImageExportService";
import { ImageImportService } from "./services/ImageImportService";
import { PdfExportService } from "./services/PdfExportService";

export const runtime = ManagedRuntime.make(
  Layer.mergeAll(ImageImportService.layer, ImageExportService.layer, PdfExportService.layer, WebGraphicsService.layer),
);
