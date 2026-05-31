import type { JSX } from "@solidjs/web";

import { arrayify } from "../../classes";

export const labelTextClass = "text-xs font-semibold uppercase tracking-tight";

export function FieldLabel(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} class={["block", labelTextClass, ...arrayify(props.class)]} />;
}
