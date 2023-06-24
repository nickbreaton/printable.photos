import memoize from "just-memoize";

function createEventEmitter<T extends { type: string }>() {
  const el = document.createElement("div");
  return {
    emit: (data: T) => el.dispatchEvent(new CustomEvent(`emitter:${data.type}`, { detail: data })),
    on<E extends T>(type: E["type"], callback: (data: E) => void) {
      el.addEventListener(`emitter:${type}` as any, callback);
      return () => el.removeEventListener(`emitter:${type}` as any, callback);
    },
  };
}

export const getEmitter = memoize(() => createEventEmitter<{ type: "change-photos" }>());
