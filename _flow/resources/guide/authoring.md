# Flow Authoring Cycle

Essential FlowScript v3 syntax and the write, run, promote loop.

FlowScript v3 is JavaScript, lowered to Flow blocks: write `const`/`let`, `if`/`else`, `while`, `for…of`, `continue`, `try`/`catch`, `switch`, `return { … }` and list methods (`filter`, `map`, `find`, `some`, `every`, `toSorted`) as in JavaScript. Catalog blocks take one object of named properties: `sql.query({ connection, sql })`. Use `input.*` for request inputs and `config.*` for configuration; declared locals (`const total = …`) are the Flow's scratch state; return the output with `return { … }` or write `result.x = …` (one style per Flow). `_flow` headers contain static literals.

## A complete Flow

```javascript
const _flow = { sourceVersion: 3, inputs: { name: { type: "string", default: "Ada" }, items: { type: "array" } } }

function Greeting({ input, config, result }) {
  const name = input.name.trim()
  if (name == "") {
    throw { code: "NAME_REQUIRED", message: "name is required" }
  }
  let total = 0
  for (const item of input.items) {
    if (!item.active) {
      continue
    }
    total += item.amount
  }
  const names = input.items.filter(item => item.active).map(item => item.label).join(", ")
  return { message: `Hello ${name}`, total, names }
}
```

Write a first draft with `code-set`; use `code-run` diagnostics, then `code-promote` when clean. `unsaved:true` or `workingCopy:true` requires promotion. For an existing source, use `code-rg`, `code-get`, then the smallest `code-patch` with its revision. A missing reusable domain block may be mocked explicitly, but a Flow calling a mock is unfinished.

A construct outside the subset is refused at its line with a `FLOWSCRIPT_V3_*` code and the rewrite to apply (for example `break`, `finally`, `return` inside a loop, `throw new Error`). The source is never rewritten for you.

## Drawers

- `flow://guide/authoring/expressions` — open for expression operators, functions and JavaScript replacements.
- `flow://guide/authoring/dialect` — open for declarations, scope rules, metadata, values, dates and input conversion.
- `flow://guide/authoring-collections` — open for loops, list methods and typed collections.
- `flow://guide/authoring-data` — open for JSON, text, HTTP and requestable data operations.
- `flow://guide/authoring-source` — open for source revisions, run and promotion details.
- `flow://guide/authoring-blocks` — open for custom block and catalog details.
