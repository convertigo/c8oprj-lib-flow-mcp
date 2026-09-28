# Portable Flow Blocks

Portable blocks: one canonical contract for backend FlowScript and Flow Svelte, with a Rhino and a browser implementation.

Use portable blocks for small deterministic operations that should behave the
same in backend FlowScript and frontend Flow Svelte. A portable block owns one
canonical `_meta`: the same id, properties, outputs, schemas and documentation
apply to every target; only the implementations differ. The property charter
of `flow://guide/custom-blocks` applies.

```javascript
const _meta = {
  "sourceVersion": 2,
  "description": "Normalizes a display name.",
  "summary": "normalize {{text}}",
  "targets": [
    "backend",
    "frontend",
  ],
  "effects": [],
  "implementations": {
    "backend": {
      "runtime": "rhino",
    },
    "frontend": {
      "runtime": "browser",
      "file": "normalize.browser.js",
    },
  },
  "properties": {
    "text": {
      "label": "Text",
      "kind": "value",
      "type": "string",
      "default": "",
      "description": "Name to normalize.",
    },
  },
  "outputs": {
    "out": {
      "type": "string",
    },
  },
  "runtime": "rhino",
}

(function () {
  return {
    run: function (ctx, node) {
      var props = ctx.props(node);
      return String(props.text || "").trim().toLowerCase();
    }
  };
}())
```

The adjacent `normalize.browser.js` is one synchronous function receiving the
JSON input object and returning a JSON-compatible value:

```javascript
function (input) {
  return String(input.text || "").trim().toLowerCase()
}
```

`effects:[]` means the block is pure. Keep inputs and outputs JSON
compatible; never expose DOM events, Java objects, sessions, HTTP clients or
FullSync handles. HTTP, requestables, FullSync, navigation and UI components
stay target-specific blocks. Stateful portable blocks (`json.array`,
`json.map`, `json.push`, `json.put`) declare `effects:["state"]` with the
frontend capability `collections`, and in Flow Svelte they may write only to a
declared writable `State`.

## Authoring

Backend FlowScript calls the canonical id:

```javascript
local.normalized = text.trim({
  $$id: "normalized",
  text: input.name,
})
```

Flow Svelte uses the palette tag generated from that id, inside an event's
`Actions`:

```svelte
<Input $$id="nameField" label="Name">
  <Events>
    <OnChange>
      <Actions>
        <TextTrim $$id="normalizeName" text="@event.value" />
      </Actions>
    </OnChange>
  </Events>
</Input>
<Text $$id="normalized" text="@normalizeName" />
```

With no `target`, read the result as `@<$$id>` (`@normalizeName`). Set
`target` only to an existing `page.name` (`layout.` / `comp.` in a layout or a
component) when the action must update that
state. Never author `RunAxiom`; insert the portable tag directly. The Svelte
compiler lowers it to a static import and bundles only used browser functions.

If `code-check` reports `FRONTEND_BLOCK_UNKNOWN`, use its ranked palette
candidate only when it matches the intent. Otherwise execute its typed
`flow-block-mock` call with `targets:["frontend"]` or
`targets:["backend","frontend"]`.

## Implementing the frontend side

The `target` selects the browser function rather than the canonical source:

```json
{"project":"MyProject","block":"domain.normalize","target":"frontend"}
```

1. Read with `code-get` and keep its `revision`.
2. Check a complete function expression with `code-check` and `code`.
3. Write with `code-set`, the same `revision`, and `finalize:true` when the
   frontend implementation is complete.
4. Use `code-patch` for later revision-checked changes.

Do not use JVM or Node.js APIs in the browser function. For a dual-target
mock, implement every target before removing the shared `mock:true` marker;
`flow-app-progress` and `flow-block-mock-list` must report no mock debt.

## Current portable core

Use `flow-catalog` only when a palette suggestion is not enough. The portable
core covers deterministic text, JSON, object, typed collection and simple
list/value/comparison operations. Higher-order `list.map`, `list.filter` and
`list.sort` remain backend-only.
