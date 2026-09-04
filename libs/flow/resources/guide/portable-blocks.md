# Portable Flow Blocks

Use portable blocks for small deterministic operations that should have the
same contract in backend FlowScript and frontend Flow Svelte. A portable block
owns one canonical `_meta`: the same id, properties, outputs, schemas and
documentation apply to every target. Runtime implementations may differ.

```javascript
const _meta = {
  targets: ["backend", "frontend"],
  effects: [],
  implementations: {
    backend: { runtime: "rhino" },
    frontend: { runtime: "browser", file: "trim.browser.js" }
  }
}
```

`effects:[]` means the block is pure. Keep portable inputs and outputs JSON
compatible. Do not expose DOM events, Java objects, sessions, HTTP clients,
FullSync handles or other runtime-specific values. HTTP, requestables, FullSync,
navigation and UI components remain target-specific blocks.

## Authoring

Backend FlowScript calls the canonical id:

```javascript
const normalized = text.trim({ text: input.name })
```

Flow Svelte uses the direct palette tag generated from that id:

```svelte
<TextTrim id="normalizeName" text="@event.value" />
```

With no `target`, consume the result as `@normalizeName`. Set `target` only to
an existing `local.name` when the action must update that state.

Never author `RunAxiom`; it exists only as a legacy migration input. The Svelte
compiler lowers a direct portable tag to a static import and bundles only used
browser functions.

If `code-check` reports `FRONTEND_BLOCK_UNKNOWN`, use its ranked
palette candidate only when it matches the intent. Otherwise execute its typed
`flow-block-mock` call with `targets:["frontend"]` or
`targets:["backend","frontend"]`.

## Implementing A Frontend Mock

Use the same unified code workflow as backend authoring. The target selects the
adjacent browser function rather than the canonical backend source:

```json
{"project":"MyProject","block":"domain.normalize","target":"frontend"}
```

1. Read with `code-get` and keep its `revision`.
2. Check a complete function expression with `code-check` and `code`.
3. Write with `code-set`, the same `revision`, and `finalize:true` when the
   frontend-only implementation is complete.
4. Use `code-patch` for later revision-checked changes.

The browser implementation is one synchronous function receiving a JSON input
object and returning a JSON-compatible value. Do not use JVM or Node.js APIs.
For a dual-target mock, implement every target before removing the shared
`mock:true` marker. `flow-app-progress` and `flow-block-mock-list` must report no
mock debt before the application is complete.

## Current Portable Core

Use `flow-catalog` with target `frontend` only when a palette suggestion is not
enough. The initial portable core covers deterministic text, JSON, object and
simple list/value/comparison operations. Higher-order `list.map`, `list.filter`
and `list.sort` remain backend-only until expressions or sub-flows have a shared
portable contract.
