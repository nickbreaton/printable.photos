import { ManagedRuntime } from "effect";

import { ImageImportService } from "./services/ImageImportService";

export const runtime = ManagedRuntime.make(ImageImportService.layer);
