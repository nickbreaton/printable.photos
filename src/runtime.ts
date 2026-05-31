import { Layer, ManagedRuntime } from "effect";

import { ImageRepository } from "./repositories/ImageRepository";
import { ProjectRepository } from "./repositories/ProjectRepository";
import { DatabaseService } from "./services/DatabaseService";
import { WebGraphicsService } from "./services/WebGraphicsService";
import { ImageExportService } from "./services/ImageExportService";
import { ImageImportService } from "./services/ImageImportService";
import { PdfExportService } from "./services/PdfExportService";

export const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    DatabaseService.layer,
    ImageRepository.layer,
    ProjectRepository.layer,
    ImageImportService.layer,
    ImageExportService.layer,
    PdfExportService.layer,
    WebGraphicsService.layer,
  ),
);
