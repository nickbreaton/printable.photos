import { Context, Effect, Layer } from "effect";

import {
  createDefaultProject,
  DEFAULT_PROJECT_SETTINGS,
  type ImageSettings,
  type PaperSettings,
} from "../data";
import { DatabaseWriteError } from "../schema";
import { DatabaseService } from "../services/DatabaseService";

export class ProjectRepository extends Context.Service<ProjectRepository>()("ProjectRepository", {
  make: Effect.gen(function* () {
    const { database } = yield* DatabaseService;

    const list = Effect.fn("ProjectRepository.list")(function* () {
      const projects = yield* Effect.promise(() => database.projects.toArray());

      if (projects.length > 0) {
        return projects;
      }

      const defaultProject = createDefaultProject();
      yield* Effect.tryPromise({
        try: () => database.projects.add(defaultProject),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });

      return [defaultProject];
    });

    const select = Effect.fn("ProjectRepository.select")(function* (id: string) {
      yield* Effect.tryPromise({
        try: () => database.projects.update(id, { lastSelectedAt: Date.now() }),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    const create = Effect.fn("ProjectRepository.create")(function* (name: string) {
      const timestamp = Date.now();

      yield* Effect.tryPromise({
        try: () =>
          database.projects.add({
            id: crypto.randomUUID(),
            name,
            settings: structuredClone(DEFAULT_PROJECT_SETTINGS),
            createdAt: timestamp,
            updatedAt: timestamp,
            lastSelectedAt: timestamp,
          }),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    const rename = Effect.fn("ProjectRepository.rename")(function* (id: string, name: string) {
      yield* Effect.tryPromise({
        try: () => database.projects.update(id, { name }),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    const remove = Effect.fn("ProjectRepository.remove")(function* (id: string) {
      yield* Effect.tryPromise({
        try: () => database.projects.delete(id),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    const updatePaperSettings = Effect.fn("ProjectRepository.updatePaperSettings")(function* (
      id: string,
      paper: Partial<PaperSettings>,
    ) {
      const nestedUpdateEntries = Object.entries(paper).map(([key, value]) => [`settings.paper.${key}`, value]);

      yield* Effect.tryPromise({
        try: () => database.projects.update(id, Object.fromEntries(nestedUpdateEntries)),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    const updateImageSettings = Effect.fn("ProjectRepository.updateImageSettings")(function* (
      id: string,
      image: Partial<ImageSettings>,
    ) {
      const nestedUpdateEntries = Object.entries(image).map(([key, value]) => [`settings.image.${key}`, value]);

      yield* Effect.tryPromise({
        try: () => database.projects.update(id, Object.fromEntries(nestedUpdateEntries)),
        catch: (cause) => new DatabaseWriteError({ cause }),
      });
    });

    return { create, list, remove, rename, select, updateImageSettings, updatePaperSettings };
  }),
}) {
  static readonly layer = Layer.effect(ProjectRepository, ProjectRepository.make).pipe(
    Layer.provide(DatabaseService.layer),
  );
}
