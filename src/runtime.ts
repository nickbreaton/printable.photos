import { Layer, ManagedRuntime } from "effect";

import { DownloadService } from "./services/DownloadService";
import { ImageImportService } from "./services/ImageImportService";

export const runtime = ManagedRuntime.make(Layer.mergeAll(ImageImportService.layer, DownloadService.layer));
