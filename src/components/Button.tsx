import { cva, type VariantProps } from "class-variance-authority";
import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center border text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/10 dark:hover:bg-input/50",
      },
      size: {
        default: "h-9 min-w-24 px-3 py-2",
        icon: "h-9 w-9 min-w-9 px-0 py-0",
      },
      activeTransform: {
        true: "active:translate-y-px",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      activeTransform: true,
    },
  },
);

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button(props: ButtonProps) {
  const buttonProps = omit(props, "activeTransform", "class", "size", "variant");

  return (
    <button
      {...buttonProps}
      class={buttonVariants({
        variant: props.variant,
        size: props.size,
        activeTransform: props.activeTransform,
        class: props.class,
      })}
    />
  );
}
