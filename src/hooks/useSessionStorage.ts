import { Signal, useSignal, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import { isBrowser, isServer } from "@builder.io/qwik/build";

export function useSessionSignal<T>(storageKey: string, defaultValue: T): Signal<T> {
  const signal = useSignal(() => {
    if (isBrowser) {
      const storedValue = sessionStorage.getItem(storageKey);
      return storedValue ? JSON.parse(storedValue).value : defaultValue;
    }
    return defaultValue;
  });

  useVisibleTask$(
    () => {
      const storedValue = sessionStorage.getItem(storageKey);
      signal.value = storedValue ? JSON.parse(storedValue).value : defaultValue;
    },
    { strategy: "document-ready" }
  );

  useTask$(({ track }) => {
    track(() => signal.value);

    if (isServer) {
      return;
    }

    sessionStorage.setItem(storageKey, JSON.stringify({ value: signal.value }));
  });

  return signal;
}
