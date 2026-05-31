import type { JSX } from "@solidjs/web";

import { arrayify } from "../classes";

export function SectionHeader(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...props}
      class={[
        "text-sm font-semibold uppercase leading-none tracking-tight",
        ...arrayify(props.class),
      ]}
    />
  );
}
