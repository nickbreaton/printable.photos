import type Dexie from "dexie";

import type { Project } from "./data";

export function applyMigrations(database: Dexie) {
  database.version(1).stores({
    projects: "id",
    images: "id, projectId, [projectId+order]",
    originalImages: "imageId",
  });

  database.version(2)
    .stores({
      projects: "id, lastSelectedAt",
      images: "id, projectId, [projectId+order]",
      originalImages: "imageId",
    })
    .upgrade(async (transaction) => {
      await transaction
        .table<Project>("projects")
        .toCollection()
        .modify((project) => {
          project.lastSelectedAt ??= project.createdAt;
        });
    });
}
