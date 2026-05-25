import { Context, Effect, Layer } from "effect";

export class UUIDService extends Context.Service<UUIDService>()("UUIDService", {
  make: Effect.gen(function* () {
    const randomUUID = Effect.fn("UUIDService.randomUUID")(function* () {
      return globalThis.crypto.randomUUID();
    });

    return { randomUUID };
  }),
}) {
  static readonly layer = Layer.effect(UUIDService, UUIDService.make);
}
