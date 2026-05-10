# Solid 2.0 Migration Notes

Last updated: 2026-05-09

This project is currently on:

- `solid-js@2.0.0-beta.10`
- `@solidjs/web@2.0.0-beta.10`
- `vite-plugin-solid@3.0.0-next.5`

This file is a working note for Solid 2.0 migration details that are easy to forget or easy to get wrong.

## Important Caveat

Solid's public docs, `next`-branch migration docs, and the currently published beta packages are not perfectly aligned yet.

- The installed `beta.10` package set in this repo does not include `@solidjs/universal`.
- The installed `beta.10` `solid-js` types expose the split `createEffect(compute, effect, options?)` style.
- Solid's official `next` migration guide/RFCs describe the incoming split-effect model and `@solidjs/universal`.

Treat the migration guide items below as the direction of Solid 2.0, but verify against the exact installed beta before doing broad refactors.

## Custom Renderers

The Solid 2.0 migration guide says custom renderers move from:

```ts
import { createRenderer } from "solid-js/universal";
```

to:

```ts
import { createRenderer } from "@solidjs/universal";
```

The renderer shape appears to stay conceptually the same: you provide platform hooks like element creation, text replacement, insertion, removal, and sibling/parent traversal.

Example shape from Solid's official renderer docs/release notes:

```ts
import { createRenderer } from "@solidjs/universal";

const PROPERTIES = new Set(["className", "textContent"]);

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
} = createRenderer({
  createElement(tag) {
    return document.createElement(tag);
  },
  createTextNode(value) {
    return document.createTextNode(value);
  },
  replaceText(node, value) {
    node.data = value;
  },
  setProperty(node, name, value) {
    if (name === "style") Object.assign(node.style, value);
    else if (name.startsWith("on")) node[name.toLowerCase()] = value;
    else if (PROPERTIES.has(name)) node[name] = value;
    else node.setAttribute(name, value);
  },
  insertNode(parent, node, anchor) {
    parent.insertBefore(node, anchor);
  },
  isTextNode(node) {
    return node.nodeType === 3;
  },
  removeNode(parent, node) {
    parent.removeChild(node);
  },
  getParentNode(node) {
    return node.parentNode;
  },
  getFirstChild(node) {
    return node.firstChild;
  },
  getNextSibling(node) {
    return node.nextSibling;
  },
});
```

Practical takeaway:

- If we ever build a Solid 2 custom renderer, start by checking whether `@solidjs/universal` is actually published for the exact beta we are using.
- Do not assume old `solid-js/universal` import paths still work in final 2.0.

## Reactivity And Effects

### Split `createEffect` is the migration direction

Solid's 2.0 migration docs describe `createEffect` as two-phase:

- compute phase: read reactive values only
- apply phase: perform side effects and optionally return cleanup

Example from the migration docs:

```ts
createEffect(
  () => name(),
  (value) => {
    el().title = value;
  },
);
```

Cleanup belongs on the apply side:

```ts
createEffect(
  () => name(),
  (value) => {
    const id = setInterval(() => console.log(value), 1000);
    return () => clearInterval(id);
  },
);
```

Important caveat for this repo:

- the installed `beta.10` types expose this split signature in `solid-js`

So for now, treat split effects as the target model, not as something we should blindly codemod everywhere without checking the exact package behavior first.

### `createRenderEffect`

`createRenderEffect` still exists and is for render-phase work.

- It runs synchronously during render.
- It runs before refs are assigned on the initial pass.
- Most app code should still prefer `createEffect`.

## Scheduling / Batching

Solid 2.0 migration docs describe a more explicit microtask-batched model:

- setters queue work
- reads continue to see the previous committed value until flush
- `flush()` forces pending updates to apply immediately

Example from the migration docs:

```ts
const [count, setCount] = createSignal(0);

setCount(1);
count(); // old value until flush

flush();
count(); // new value
```

Practical rule:

- avoid assuming "set then immediately read" works the way Solid 1.x did
- only use `flush()` when imperative code genuinely needs a settled state immediately

## `mergeProps` To `merge`

Solid 2.0 migration direction renames `mergeProps` to `merge`:

```ts
import { merge } from "solid-js";
```

Use `merge(...)` for reactive prop/object merging in app code.

Why this can look inconsistent:

- In this repo's current beta, `@solidjs/web` still exposes `mergeProps` for JSX/runtime compatibility.
- Internally this maps to the same underlying `merge` behavior.

Practical rule for this repo:

- Prefer importing `merge` from `solid-js` in application/state code.
- Treat `mergeProps` as compatibility/runtime surface, not the preferred API name.

## Top-Level Reactive Reads

Solid 2.0 dev guidance warns on top-level reactive reads in component bodies.

This includes common mistakes like:

- destructuring props in function args
- assigning `const foo = props.foo` at component top level

Preferred pattern:

```tsx
function Title(props) {
  return <h1>{props.title}</h1>;
}
```

Not this:

```tsx
function Title({ title }) {
  return <h1>{title}</h1>;
}
```

For this repo specifically:

- do not destructure props

## Owned-Scope Writes

Solid 2.0 docs also tighten writes inside reactive scopes.

- Avoid writing signals/stores inside component bodies, memos, or tracking code.
- Prefer deriving with `createMemo`.
- Prefer event handlers, actions, or effect apply functions for side effects.

Bad:

```ts
createMemo(() => setDoubled(count() * 2));
```

Good:

```ts
const doubled = createMemo(() => count() * 2);
```

## Loading / Async Direction

Solid 2.0 is pushing toward async-first computations and `Loading` boundaries.

- Use `<Loading fallback={...}>` for initial readiness.
- Use `isPending(() => expr)` for refresh/revalidation indicators.
- The migration guide frames this as the successor mental model to old `Suspense`-centric patterns.

The installed package already exports `Loading`.

## Ref Composition Replaces `use:` Directives

Solid 2.0 removes the `use:` directive namespace. The DOM RFC describes `ref` as the single composition point for:

- direct DOM access: `ref={el => ...}`
- reusable directive factories: `ref={tooltip(options)}`
- composition of multiple refs/directives: `ref={[setEl, tooltip(options), autofocus()]}`

Before:

```tsx
<button use:tooltip={props.label} ref={setButton}>
  {props.children}
</button>
```

After:

```tsx
<button ref={[setButton, tooltip(() => props.label)]}>{props.children}</button>
```

Important details:

- Use arrays when an element needs more than one ref behavior.
- Ref arrays can be nested, so component code can merge its own ref with a forwarded `props.ref`.
- Prefer factory calls for directive-like behavior: `ref={tooltip(options)}`.
- If no options are needed, `ref={autofocus}` can still be a plain callback.
- Keep the normal repo rule: do not destructure props just to pass directive inputs around.

### Two-phase directive factories

The Solid 2.0 recommendation is a two-phase pattern:

- setup phase: owned; create signals, effects, subscriptions, or cleanup here
- apply phase: unowned; receives the element and performs DOM wiring/writes

Example:

```ts
function titleRef(source: () => string) {
  let el: HTMLElement | undefined;

  createEffect(source, (value) => {
    if (el) el.title = value;
  });

  return (nextEl: HTMLElement) => {
    el = nextEl;
    el.title = source();
  };
}
```

Used as:

```tsx
<button ref={titleRef(() => props.title)}>{props.children}</button>
```

Practical rules for this repo:

- Do not create new reactive primitives inside the returned ref callback.
- Do not do top-level imperative DOM mutation in the factory setup phase.
- Put reactive reads in the setup/effect side and DOM attachment in the returned callback.
- When forwarding refs through components, compose instead of choosing one ref:

```tsx
function Button(props) {
  let local!: HTMLButtonElement;

  return <button ref={[(el) => (local = el), props.ref]}>{props.children}</button>;
}
```

## Other Migration Notes

- DOM runtime imports move from `solid-js/web` to `@solidjs/web`.
- Store helpers now come from `solid-js` rather than `solid-js/store`.
- `onMount` is being replaced by `onSettled` in the migration guide.
- `Index` is replaced by `<For keyed={false}>`.
- `classList` is being folded into `class`.
- `use:` directives are being replaced by `ref` directive factories and ref arrays.

## Sources

- Solid 2.0 beta release notes:
  - https://github.com/solidjs/solid/releases
- Solid 2.0 migration guide on Solid's `next` branch:
  - https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/MIGRATION.md
  - (Includes the `mergeProps` -> `merge` migration direction)
- Solid 2.0 RFC for reactivity/batching/effects:
  - https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/01-reactivity-batching-effects.md
- Solid 2.0 RFC for DOM changes:
  - https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/07-dom.md
- Current public docs for `createEffect`:
  - https://docs.solidjs.com/reference/basic-reactivity/create-effect
- Current public docs for `createRenderEffect`:
  - https://docs.solidjs.com/reference/secondary-primitives/create-render-effect
