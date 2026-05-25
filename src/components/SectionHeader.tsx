import type { JSX } from "@solidjs/web";

export function SectionHeader(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...props}
      class={["text-sm font-semibold uppercase leading-none tracking-tight", props.class]}
    />
  );
}
