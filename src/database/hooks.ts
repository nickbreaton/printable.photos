import { QRL, implicit$FirstArg, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { liveQuery } from "dexie";

// TODO: figure out how to avoid double function call, one is needed to unrwap the inner useLexicalScope.
// This cannot be done within the liveQuery function as it reruns
export function useLiveQueryQrl<T>(cb: QRL<() => () => Promise<T> | T>) {
  const data = useStore<
    { readonly isLoading: true; readonly value: null } | { readonly isLoading: false; readonly value: T }
  >({
    isLoading: true,
    value: null,
  });

  useVisibleTask$(({ cleanup }) => {
    cb().then((query) => {
      const subscriber = liveQuery(() => query()).subscribe((value) => {
        (data as any).value = value;
        (data as any).isLoading = false;
      });
      cleanup(() => subscriber.unsubscribe());
    });
  });

  return data;
}

export const useLiveQuery$ = implicit$FirstArg(useLiveQueryQrl);
