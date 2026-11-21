# FlowScript first syntax conversions

Read before the first code-set when translating JavaScript idioms.

> **FlowScript v3 is JavaScript** (`const _flow = { sourceVersion: 3 }`; details in `flow://guide/authoring`).
> Write `const`/`let`, `if`/`else`, `while`, `for (const item of items)`, `continue`, `try`/`catch (e)`, `switch`,
> `return { … }`, `rows.filter(r => …)`, `.map`, `.find`, `.some`, `.every`, `.toSorted((a, b) => a.k - b.k)` or `.toSorted((a, b) => a - b)`,
> `Object.keys(o)`, `JSON.parse(t)`, `JSON.stringify(v)` as in JavaScript.
> Imports: `const { get: httpGet } = flow.import("http")`, never `import … from`.
> A default value is `x ?? y`; `flow.default(x, y)` when `""` must count as absent.

Not available, with the replacement:

<!-- generated:v3-refusals format=bullets codes=BREAK,FINALLY,RETURN_IN_LOOP,ERROR_CODE_CHOICE,UNTYPED_LIST,FUNCTION,IMPORT_SYNTAX,RESERVED_WORD -->
- `break`: a local tested by the while condition, or find / filter (`FLOWSCRIPT_V3_BREAK`)
- `finally`: the statements after the try (`FLOWSCRIPT_V3_FINALLY`)
- return inside a loop: continue, or a local and a return after the loop (`FLOWSCRIPT_V3_RETURN_IN_LOOP`)
- throw new Error(m): throw { code: "CHOOSE_ERROR_CODE", message: m } (`FLOWSCRIPT_V3_ERROR_CODE_CHOICE`)
- const rows = [] then a push of no certain type, or of different types: json.array({ itemType }) with the type of the pushed values (`FLOWSCRIPT_V3_UNTYPED_LIST`)
- a function other than a top-level helper, a list arrow or a slot (nested, in an expression, a closure); a slot with a parameter or an expression body: inline, a top-level helper, or a project block; a slot $$s() {…} (`FLOWSCRIPT_V3_FUNCTION`)
- import … from "…": const { … } = flow.import("…") (`FLOWSCRIPT_V3_IMPORT_SYNTAX`)
- default(x, y) outside a switch: default is a reserved word, so this is not JavaScript: flow.default(x, y), with the same arguments (`FLOWSCRIPT_V3_RESERVED_WORD`)
<!-- /generated -->

A regular expression literal is a block: `/re/.test(x)` becomes `text.match({ text: x, pattern: "re" })`.
Every accepted form: `flow://guide/authoring/forms`; every refusal: `flow://guide/authoring/refusals`.
