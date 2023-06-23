import { component$ } from "@builder.io/qwik";
import { ArrowLeftIcon, DownloadIcon } from "qwik-feather-icons";
import { css } from "~/panda/css";

export const Navigation = component$<{ onDownload: () => void }>(({ onDownload }) => {
  return (
    <div class={css({ w: "full", display: "flex", justifyContent: "space-between", alignItems: "center" })}>
      <button
        // TODO: figure out if Qwik can SPA history.back (maybe this is the browser default)
        onClick$={() => history.back()}
        class={css({
          display: "inline-flex",
          alignItems: "center",
          gap: "1",
          fontWeight: "semibold",
          color: "blue.500",
          fontSize: "sm",
          paddingInlineEnd: "2",
          paddingBlock: "1",
          userSelect: "none",
          cursor: "pointer",
          _pointerDown: {
            color: "blue.300",
          },
        })}
      >
        <ArrowLeftIcon size={18} />
        Projects
      </button>
      <button
        class={css({
          p: "1",
          paddingInline: "3",
          bg: "blue.400",
          color: "white",
          display: "inline-flex",
          fontWeight: "semibold",
          alignItems: "center",
          borderRadius: "sm",
          boxShadow: "xs",
          userSelect: "none",
          gap: "2",
          fontSize: "md",
          cursor: "pointer",
          _pointerDown: {
            bg: "blue.300",
          },
        })}
        onClick$={onDownload}
      >
        Download
        <DownloadIcon size={20} />
      </button>
    </div>
  );
});
