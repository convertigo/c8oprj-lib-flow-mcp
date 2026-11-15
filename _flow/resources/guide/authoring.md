# Flow Authoring Cycle

Essential FlowScript v2 syntax and the write, run, promote loop.

Block calls take one object of named properties: `block.name({ key: value })`. Write one statement per line. Capture with `local.value = block.name({...})`; use `input.*` for request inputs, `local.*` for scratch state and `result.*` for output. Backend `flow.*` and `props.*` are not expression scopes. `_flow` headers contain static literals. Use assignments, native `if/else`, `return` and `throw` objects; phase 1 loops remain catalog blocks.

## A complete Flow

```javascript
const _flow = { sourceVersion: 2, inputs: { name: { type: "string", default: "Ada" } } }

function Greeting({ input, config, result }) {
  local.name = text.trim({ text: input.name })
  if (local.name == "") {
    throw { code: "NAME_REQUIRED", message: "name is required" }
  }
  result.message = `Hello ${local.name}`
}
```

Write a first draft with `code-set`; use `code-run` diagnostics, then `code-promote` when clean. `unsaved:true` or `workingCopy:true` requires promotion. For an existing source, use `code-rg`, `code-get`, then the smallest `code-patch` with its revision. A missing reusable domain block may be mocked explicitly, but a Flow calling a mock is unfinished.

## Drawers

- `flow://guide/authoring/expressions` — open for expression operators, functions and JavaScript replacements.
- `flow://guide/authoring/dialect` — open for slots, metadata, values, dates and input conversion.
- `flow://guide/authoring-collections` — open for loops and typed collections.
- `flow://guide/authoring-data` — open for JSON, text, HTTP and requestable data operations.
- `flow://guide/authoring-source` — open for source revisions, run and promotion details.
- `flow://guide/authoring-blocks` — open for custom block and catalog details.
