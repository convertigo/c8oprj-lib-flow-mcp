# FlowScript v3 forms and refusals

Every accepted JavaScript form with its block, and every refusal with its code and rewrite.

Sub-guide of `flow://guide/authoring`: read that guide first. This text is generated from the FlowScript v3 specification.

## Accepted forms

<!-- generated:v3-forms -->
| JavaScript | Block | Lowering and limits |
|---|---|---|
| `const { name, name: alias } = flow.import("module")` |  | imports[alias] = module.name. top level, before functions |
| `const ns = flow.import("module")` |  | imports[ns.*] = module. top level, before functions |
| `const x = e`, `let x = e`, `let x` | `set` | local.x = e (undefined without value) |
| `const rows = []`, `let rows = [], then rows.push(v)` | `json.array` | json.array({ itemType }) with the type every push proves from its syntax (literals, comparisons, object and list literals). otherwise FLOWSCRIPT_V3_UNTYPED_LIST with the json.array to write |
| `const { a, b: c } = o` | `set` | local.a = o.a; local.c = o.b. one level, no default, no rest |
| `x = e`, `local.x = e`, `local.o.k = e` | `set` |  |
| `x += e`, `x -= e`, `x *= e`, `x /= e`, `x++`, `x--`, `o.f++`, `o.f += e` | `set` | local.x = local.x + (e); x++ is local.x = Number(local.x) + 1; o.f is a field of a local object or of result, shared as in JavaScript. statement only |
| `result.x = e` | `set` |  |
| `return { a, b: e }` | `set + return` | result.a = local.a; result.b = e; return |
| `return`, `return e` | `return` |  |
| `if (c) {…} else if (d) {…} else {…}` | `if` | a list method or global call the condition always evaluates runs before the if, in a hidden local |
| `while (c) {…}` | `while` | no list method in the condition, evaluated before every pass (FLOWSCRIPT_V3_CHAIN). defaults: maxIterations 1000, timeoutMs 60000 |
| `for (const item of items) {…}` | `forEach` | item read as current; an outer item read by a nested loop or arrow is copied to local.item; items may be Object.keys(o), Object.values(o) or a chain, computed once before the loop |
| `for (let i = a; i < b; i++) {…}` | `set + while` | local.i = a; while (i < b) { body; local.i = Number(local.i) + 1 }. < or <=, step ++, i not assigned in the body; maxIterations 1000000 |
| `for (let i = a; i < b; i++) { … continue … }` | `set + while + next` | a hidden counter local.__count<N> steps before the body, continue is next, the bound is read at every test. i not assigned in the body |
| `switch (x) { case LITERAL: …; break; default: … }` | `if chain` | literal labels, every case ends with break/return/throw, default last |
| `try {…} catch (e) {…}` | `try` | error = local.e, read as e inside the catch only, e.details the details of the thrown error (undefined without); catch {…} declares no name: local.error, or a hidden local.__caught<N> when the Flow has its own error |
| `continue` | `next` | while, for…of or counted for, no label |
| `throw { code: "LITERAL", message, details }` | `throw` |  |
| `throw e` | `throw` | throw({ error: "local.e" }): the caught error again, unchanged (application or failure). e is the parameter of an enclosing catch (a const) |
| `a?.b`, `a?.[k]` |  | same as a.b (paths are null-safe) |
| `xs.filter(x => c)` | `list.filter` | properties: items = xs; where = c with x as current |
| `xs.map(x => e)` | `list.map` | properties: items = xs; select = e with x as current |
| `xs.find(x => c)` | `list.find` | properties: items = xs; where = c. new block |
| `xs.some(x => c)` | `list.some` | properties: items = xs; where = c. new block |
| `xs.every(x => c)` | `list.every` | properties: items = xs; where = c. new block |
| `xs.toSorted((a, b) => a.k - b.k)`, `xs.toSorted((a, b) => a - b)`, `xs.toSorted((a, b) => a.k.localeCompare(b.k))`, `xs.toSorted((a, b) => a.localeCompare(b))`, `[...xs].sort((a, b) => b.k - a.k)` | `list.sort` | properties: items = xs; by = current.k for a key comparator; omitted for an identity comparator (the block uses current); compare = number (a - b) \| locale (String(a).localeCompare(String(b))); direction = desc when b comes first. a copy sorted by Array.prototype.sort with the arrow's comparator; without compare, the Flow order |
| `xs.toSorted((a, b) => a.k < b.k ? -1 : (a.k > b.k ? 1 : 0)), and every ternary of comparisons of the two keys with the same sign for every pair` | `list.sort` | properties: items = xs; by = current.k (omitted for a < b ? …); compare = natural: a < b ? -1 : a > b ? 1 : 0 on the raw keys; direction = desc when b comes first. checked on the eight classes of a key pair; a.k < b.k ? -1 : 1 is refused |
| `xs.toSorted((a, b) => c1 \|\| c2 \|\| …), each ci a key comparator` | `list.sort` | properties: then = [{ by, compare, direction }, …] for c2, c3…. c1 \|\| c2 evaluated literally: a 0 or NaN falls to the next key |
| `xs.filter(…).map(…).join(", ")` |  | one node per block step, linked by local.__chain<N>. assignment, return, if condition; not in && \|\| ?? branches, a ?: inside an expression, a call argument, after a scope read, a while condition |
| `const x = cond ? xs.filter(…).map(…) : ys` |  | if (cond) { x = branch1 } else { x = branch2 }, each chain lowered in its branch. a declaration, assignment or returned field that is entirely the ?: |
| `xs.concat(ys, …)` |  | the expression method Array.prototype.concat; a chain in an argument runs before it |
| `rows.push(v)` | `json.push` | properties: path = local.rows; value = v. rows created by json.array, or by const rows = [] / let rows = [] whose item type every push proves |
| `byId[key] = v` | `json.put` | properties: path = local.byId; key = key; value = v. byId created by json.map |
| `Object.keys(o)` | `object.keys` | properties: source = o. assignment, return, chain head, if condition, for…of list |
| `Object.values(o)` | `object.values` | properties: source = o. assignment, return, chain head, if condition, for…of list |
| `JSON.parse(t)` | `json.parse` | properties: text = t. assignment, return, chain head, if condition |
| `JSON.stringify(v)`, `JSON.stringify(v, null, 2)` | `json.stringify` | properties: value = v; pretty = true with (null, 2). assignment, return, chain head, if condition |
| `flow.default(a, b)` |  | expression function default (null, undefined and "" replaced). any expression; a bare default( is refused (FLOWSCRIPT_V3_RESERVED_WORD) |
| `flow.while({…})`, `flow.forEach({…})`, `flow.if({…})`, `flow.try({…})` | `while \| forEach \| if \| try` | properties beyond the JavaScript form; a slot is $$s() {…}, $$s: function () {…} or $$s: () => {…}; assigned or returned, the call writes $$out |
| `name: statement` |  | explicit node name |
| `// text or /* text */ above a statement, no blank line` |  | node comment (formatter writes // lines); standalone comment node after a blank line |
| `// @disabled in the attached comment` |  | $$disabled: true |
| `function helper({ a, b }) { … } after the Flow function, called helper({ a: 1 })` |  | helper block, as in v2; body under the same rules |
<!-- /generated -->

## Refused constructs

A refusal names its line, its `FLOWSCRIPT_V3_*` code and the rewrite; the source is never rewritten for you.

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
<!-- /generated -->
