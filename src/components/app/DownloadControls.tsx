import { action, createOptimistic, snapshot } from "solid-js";

import { Button } from "../ui/Button";
import { bins, paper, project, projectImages } from "../../state";
import { runtime } from "../../runtime";
import { ImageExportService } from "../../services/ImageExportService";
import { PdfExportService } from "../../services/PdfExportService";

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function DownloadControls() {
  const [downloading, setDownloading] = createOptimistic(false);

  return (
    <div class="flex items-center gap-2">
      <span class="mr-2 text-sm font-medium tabular-nums text-foreground/70">
        {bins.length} {pluralize(bins.length, "page", "pages")} / {projectImages.length}{" "}
        {pluralize(projectImages.length, "photo", "photos")}
      </span>
      <Button
        type="button"
        variant="secondary"
        disabled={downloading()}
        onClick={action(function* () {
          setDownloading(true);
          yield runtime.runPromise(
            ImageExportService.use((service) =>
              service.exportImageZip({
                bins: [...bins],
                paper: paper(),
                images: [...snapshot(projectImages)],
                projectName: project().name,
              }),
            ),
          );
        })}
      >
        Download Photos
      </Button>
      <Button
        type="button"
        disabled={downloading()}
        onClick={action(function* () {
          setDownloading(true);
          yield runtime.runPromise(
            PdfExportService.use((service) =>
              service.exportPDF({
                bins: [...bins],
                paper: paper(),
                images: [...snapshot(projectImages)],
                projectName: project().name,
              }),
            ),
          );
        })}
      >
        Download PDF
      </Button>
    </div>
  );
}

