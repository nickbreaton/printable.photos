import { Signal, component$ } from "@builder.io/qwik";
import { css } from "~/panda/css";

const MobileTab = component$<{ value: "Photos" | "Preview"; activeTab: Signal<"Photos" | "Preview"> }>(
  ({ value, activeTab }) => {
    return (
      <label
        class={css({
          w: "full",
          display: "grid",
          userSelect: "none",
        })}
      >
        <input
          type="radio"
          name="view"
          value={value}
          class={css({ gridArea: "1/1", appearance: "none" })}
          checked={activeTab.value === value}
          onInput$={() => (activeTab.value = value)}
        />
        <span
          class={css({
            gridArea: "1/1",
            paddingBlock: "2",
            paddingInline: "3",
            w: "full",
            textAlign: "center",
            fontWeight: "extrabold",
            color: "gray.700",
            cursor: "pointer",
            borderRadius: "sm",
            _pointerDown: {
              bg: "gray.100",
              boxShadow: "inner",
            },
            _hoverable: {
              _hover: {
                bg: "gray.100",
                boxShadow: "inner",
              },
            },
            _tabChecked: {
              boxShadow: "sm",
              bg: "white",
              cursor: "default",
              color: "gray.800",
            },
          })}
        >
          {value}
        </span>
      </label>
    );
  }
);

export const MobileTabs = component$<{ activeTab: Signal<"Photos" | "Preview"> }>(({ activeTab }) => {
  return (
    <div
      class={css({
        display: "flex",
        justifyContent: "stretch",
        bg: "gray.50",
        borderRadius: "sm",
        boxShadow: "inner",
      })}
    >
      {/* TODO: maybe role="tab" is a better a11y role than radios */}
      {(["Photos", "Preview"] as const).map((value) => (
        <MobileTab key={value} value={value} activeTab={activeTab} />
      ))}
    </div>
  );
});
