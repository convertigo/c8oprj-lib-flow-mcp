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

A construct outside the subset is refused at its line with a `FLOWSCRIPT_V3_*` code and the rewrite to apply; the source is never rewritten for you. The common ones (all of them: `flow://guide/authoring/forms`):

<!-- generated:v3-refusals format=bullets codes=BREAK,FINALLY,RETURN_IN_LOOP,ERROR_CODE_CHOICE,FUNCTION,LOOP_FORM,RESERVED_WORD -->
- `break`: a local tested by the while condition, or find / filter (`FLOWSCRIPT_V3_BREAK`)
- `finally`: the statements after the try (`FLOWSCRIPT_V3_FINALLY`)
- return inside a loop: continue, or a local and a return after the loop (`FLOWSCRIPT_V3_RETURN_IN_LOOP`)
- throw new Error(m): throw { code: "CHOOSE_ERROR_CODE", message: m } (`FLOWSCRIPT_V3_ERROR_CODE_CHOICE`)
- a function other than a top-level helper, a list arrow or a slot (nested, in an expression, a closure); a slot with a parameter or an expression body: inline, a top-level helper, or a project block; a slot $$s() {…} (`FLOWSCRIPT_V3_FUNCTION`)
- do … while, for … in, labelled loop, labelled break or continue: while, for (const key of Object.keys(o)) (`FLOWSCRIPT_V3_LOOP_FORM`)
- default(x, y) outside a switch: default is a reserved word, so this is not JavaScript: flow.default(x, y), with the same arguments (`FLOWSCRIPT_V3_RESERVED_WORD`)
<!-- /generated -->
