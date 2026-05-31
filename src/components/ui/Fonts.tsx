import { createMemo } from "solid-js";

const ready = createMemo(async () => {
  const node = document.createElement("span");
  node.className = "sr-only";
  node.textContent = "font probe";
  node.ariaHidden = "true";
  document.body.appendChild(node);
  await document.fonts.ready.catch(() => null);
  node.remove();
});

export function Fonts() {
  return <>{ready() ?? null}</>;
}
