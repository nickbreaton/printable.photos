import type { JSX } from "@solidjs/web";

type ClassPart = string | number | boolean | Record<string, boolean> | null | undefined;

export function arrayify(value: JSX.ClassValue | false | null | undefined): ClassPart[] {
  return Array.isArray(value) ? value : [value];
}
