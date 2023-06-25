import { QRL, implicit$FirstArg, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { liveQuery } from "dexie";

export function useLiveQueryQrl<T>(cb: QRL<() => Promise<T> | T>) {
  const data = useStore<
    { readonly isLoading: true; readonly value: null } | { readonly isLoading: false; readonly value: T }
  >({
    isLoading: true,
    value: null,
  });

  useVisibleTask$(({ cleanup }) => {
    cb.resolve().then((query) => {
      const subscriber = liveQuery(query).subscribe((value) => {
        (data as any).value = value;
        (data as any).isLoading = false;
      });
      cleanup(() => subscriber.unsubscribe());
    });
  });

  return data;
}

export const useLiveQuery$ = implicit$FirstArg(useLiveQueryQrl);
