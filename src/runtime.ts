import { Layer, ManagedRuntime } from "effect";

import { WebGraphicsService } from "./services/WebGraphicsService";
import { DownloadService } from "./services/DownloadService";
import { ImageImportService } from "./services/ImageImportService";

export const runtime = ManagedRuntime.make(Layer.mergeAll(ImageImportService.layer, DownloadService.layer, WebGraphicsService.layer));
