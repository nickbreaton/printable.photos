import { Context, Effect, Layer } from "effect";

const MAX_IMPORT_BYTES = 100 * 1024 * 1024; // 100 MiB

export class MemoryEstimationService extends Context.Service<MemoryEstimationService>()("MemoryEstimationService", {
  make: Effect.gen(function* () {
    const estimate = Effect.fn("MemoryEstimationService.estimate")(function* () {
      return MAX_IMPORT_BYTES;
    });

    return { estimate };
  }),
}) {
  static readonly layer = Layer.effect(MemoryEstimationService, MemoryEstimationService.make);
}
