import { QRL, noSerialize, useStore, useVisibleTask$ } from "@builder.io/qwik";

export interface DataSource<T> {
  subscribe(callback: (next: T) => void): () => void;
}

export function createDataSource<T>(
  callback: ({ next, cleanup }: { next: (value: T) => void; cleanup: (action: () => void) => void }) => void
): DataSource<T> {
  const subscribers = new Set<(next: T) => void>();
  const cleanups = new Set<() => void>();

  callback({
    next: (v) => {
      subscribers.forEach((subscriber) => subscriber(v));
    },
    cleanup: (callback) => {
      cleanups.add(callback);
    },
  });

  return {
    subscribe: (subscriber) => {
      subscribers.add(subscriber);

      return () => {
        subscribers.delete(subscriber);
        if (subscribers.size === 0) {
          cleanups.forEach((cleanup) => cleanup());
        }
      };
    },
  };
}

export function useDataSource<T>(getSource: QRL<() => DataSource<T>>) {
  const data = useStore<{ isLoading: true; value: null } | { isLoading: false; value: NoSerialize<T> }>({
    isLoading: true,
    value: null,
  });

  useVisibleTask$(({ cleanup }) => {
    getSource().then((source) => {
      cleanup(
        source.subscribe((next) => {
          data.isLoading = false;
          data.value = noSerialize(next as any);
        })
      );
    });
  });

  return data;
}
