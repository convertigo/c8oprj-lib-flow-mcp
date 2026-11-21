# FlowScript v3 refusals

Every refused construct with its `FLOWSCRIPT_V3_*` code and the rewrite to apply.

A refusal names its line, its code and the rewrite; the source is never rewritten for you. The accepted forms: `flow://guide/authoring/forms`.

<!-- generated:v3-refusals -->
| Construct | Code | Rewrite |
|---|---|---|
| import … from "…" | `FLOWSCRIPT_V3_IMPORT_SYNTAX` | const { … } = flow.import("…") |
| declaring or importing flow, a scope name, or a local starting with __ | `FLOWSCRIPT_V3_RESERVED_NAME` | another name |
| default(x, y) outside a switch: default is a reserved word, so this is not JavaScript | `FLOWSCRIPT_V3_RESERVED_WORD` | flow.default(x, y), with the same arguments |
| a local named like a block namespace the Flow uses (text, list, json…) | `FLOWSCRIPT_V3_NAME_SHADOWS_BLOCK` | another name |
| x and local.x in the same Flow | `FLOWSCRIPT_V3_LOCAL_ALIAS` | one spelling |
| a name read outside the block that declares it | `FLOWSCRIPT_V3_OUT_OF_SCOPE` | declare it in the enclosing block |
| a name declared again in an enclosed block, or hiding an import or a loop variable | `FLOWSCRIPT_V3_SHADOWING` | another name |
| assigning a const | `FLOWSCRIPT_V3_CONST_ASSIGN` | let |
| destructuring with default, rest or nesting | `FLOWSCRIPT_V3_DESTRUCTURING` | one const per field |
| x++ or x += e inside an expression | `FLOWSCRIPT_V3_COMPOUND_CONTEXT` | a statement of its own |
| result.x = … and return { … } in the same Flow | `FLOWSCRIPT_V3_RESULT_MIXED` | one style |
| `break` | `FLOWSCRIPT_V3_BREAK` | a local tested by the while condition, or find / filter |
| `finally` | `FLOWSCRIPT_V3_FINALLY` | the statements after the try |
| return inside a loop | `FLOWSCRIPT_V3_RETURN_IN_LOOP` | continue, or a local and a return after the loop |
| a for (;;) other than for (let i = a; i < b; i++), or a counter assigned in the body | `FLOWSCRIPT_V3_FOR_FORM` | for…of, or a while with a local the body changes |
| switch with fall-through, non-literal case or default not last | `FLOWSCRIPT_V3_SWITCH_FALLTHROUGH` | if / else if |
| do … while, for … in, labelled loop, labelled break or continue | `FLOWSCRIPT_V3_LOOP_FORM` | while, for (const key of Object.keys(o)) |
| a function other than a top-level helper, a list arrow or a slot (nested, in an expression, a closure); a slot with a parameter or an expression body | `FLOWSCRIPT_V3_FUNCTION` | inline, a top-level helper, or a project block; a slot $$s() {…} |
| a block method in && \|\| ?? branches, a ?: inside an expression or its test, a call argument, after a scope read, a while condition | `FLOWSCRIPT_V3_CHAIN` | two const |
| xs.sort alone, an inexact comparator (a.k < b.k ? -1 : 1…), reduce, (x, i), an outer arrow parameter in an inner arrow | `FLOWSCRIPT_V3_LIST_METHOD` | toSorted with a.k - b.k, localeCompare or a.k < b.k ? -1 : a.k > b.k ? 1 : 0, joined by \|\|; list.sum, list.map or a loop |
| const rows = [] then a push of no certain type, or of different types | `FLOWSCRIPT_V3_UNTYPED_LIST` | json.array({ itemType }) with the type of the pushed values |
| Object.* or JSON.* elsewhere or with other arguments, Object.entries, Date.now, new Date | `FLOWSCRIPT_V3_GLOBAL_CALL` | the block (object.*, json.*, date.*) |
| throw new Error(m) | `FLOWSCRIPT_V3_ERROR_CODE_CHOICE` | throw { code: "CHOOSE_ERROR_CODE", message: m } |
| async, await, generators, classes, this, new, const without a value, o.f++ on a loop item or input, throw of a name that is not a catch parameter, a thrown object with an error field | `FLOWSCRIPT_V3_UNSUPPORTED` | blocks |
| if or while whose condition is an object literal | `FLOWSCRIPT_V3_OBJECT_CONDITION` | flow.if({ … }) or flow.while({ … }) |
| a regular expression literal in a lazy place (after && \|\| ??, in a list arrow, an argument, a while condition) or in another form | `FLOWSCRIPT_V3_PATTERN` | const m = text.match({ text: String(s), pattern: "p" }) before the statement, then m.matched |
| a field of a block call result read in a lazy place (after && \|\| ??, a branch of a ?: inside an expression, an argument, a list arrow, a while condition, a for…of list) | `FLOWSCRIPT_V3_CALL_RESULT` | const r = block({ … }) in its own statement, then r.field |
<!-- /generated -->
