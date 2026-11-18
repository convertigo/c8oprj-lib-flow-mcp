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
- const rows = [] then rows.push of values that disagree or cannot be typed: the exact json.array({ itemType }) proposal (`FLOWSCRIPT_V3_UNTYPED_LIST`)
- a function other than a top-level helper, a list arrow or a slot: nested, in an expression, a closure: inline, a top-level helper, or a project block (`FLOWSCRIPT_V3_FUNCTION`)
- import … from "…": const { … } = flow.import("…") (`FLOWSCRIPT_V3_IMPORT_SYNTAX`)
- a bare default( call: default is a reserved word of JavaScript: flow.default(x, y), or x ?? y (`FLOWSCRIPT_V3_RESERVED_WORD`)
<!-- /generated -->

A regular expression literal is a block: `/re/.test(x)` becomes `text.match({ text: x, pattern: "re" })`.
Every accepted form and every refusal: `flow://guide/authoring/forms`.
