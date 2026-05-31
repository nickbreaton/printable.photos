export interface IconProps {
  icon: string;
  class?: string;
}

export function Icon(props: IconProps) {
  return (
    <span
      aria-hidden="true"
      class={`inline-flex [&>svg]:size-4 ${props.class ?? ""}`}
      innerHTML={props.icon}
    />
  );
}
