import { Signal, useSignal, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import { isBrowser, isServer } from "@builder.io/qwik/build";

const readValue = <T>(storageKey: string, defaultValue: T) => {
  const state = history.state ?? {};
  return storageKey in state ? state[storageKey] : defaultValue;
};

const writeValue = <T>(storageKey: string, value: T) => {
  const state = history.state ?? {};
  history.replaceState({ ...state, [storageKey]: value }, "");
};

export function useHistoryState<T>(storageKey: string, defaultValue: T): Signal<T> {
  const signal = useSignal(() => {
    if (isBrowser) {
      return readValue(storageKey, defaultValue);
    }
    return defaultValue;
  });

  useVisibleTask$(
    () => {
      signal.value = readValue(storageKey, defaultValue);
    },
    { strategy: "document-ready" }
  );

  useTask$(({ track }) => {
    track(() => signal.value);

    if (isServer) {
      return;
    }

    writeValue(storageKey, signal.value);
  });

  return signal;
}
