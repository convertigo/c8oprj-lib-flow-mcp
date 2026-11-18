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
| `const rows = []`, `let rows = []` |  | json.array with an item type admitting any value, or the type inferred from every push of the Flow. followed by rows.push(v); refused with the exact json.array proposal when the pushes disagree or cannot be typed |
| `const { a, b: c } = o` | `set` | local.a = o.a; local.c = o.b. one level, no default, no rest |
| `x = e`, `local.x = e`, `local.o.k = e` | `set` |  |
| `x += e`, `x -= e`, `x *= e`, `x /= e`, `x++`, `x--` | `set` | local.x = local.x + (e). statement only |
| `result.x = e` | `set` |  |
| `return { a, b: e }` | `set + return` | result.a = local.a; result.b = e; return |
| `return`, `return e` | `return` |  |
| `if (c) {…} else if (d) {…} else {…}` | `if` |  |
| `while (c) {…}` | `while` | defaults: maxIterations 1000, timeoutMs 60000 |
| `for (const item of items) {…}` | `forEach` | item read as current in its own body; when a nested construct rebinds current and reads the outer item, copy it to local.item at the start of the outer body; one-level destructured fields are copied from current.field |
| `for (let i = a; i < b; i++) {…}` | `set + while` | < or <=, step ++, i not assigned in the body, no continue in body; maxIterations 1000000 |
| `for (let i = a; i < b; i++) { … continue … }` | `loop over the integer range [a, b) ([a, b] for <=)` | the bound b cannot change in the body (no assignment to a name it reads, no push or [key] = on a list or map it reads) |
| `switch (x) { case LITERAL: …; break; default: … }` | `if chain` | literal labels, every case ends with break/return/throw, default last |
| `try {…} catch (e) {…}` | `try` | error = local.e (local.error without parameter); e read inside catch only |
| `continue` | `next` | while or for…of, no label |
| `throw { code: "LITERAL", message, details }` | `throw` |  |
| `throw e` | `throw` | e is the parameter of the enclosing catch, not assigned |
| `a?.b`, `a?.[k]` |  | same as a.b (paths are null-safe) |
| `xs.filter(x => c)` | `list.filter` | properties: items = xs; where = c with x as current |
| `xs.map(x => e)` | `list.map` | properties: items = xs; select = e with x as current |
| `xs.find(x => c)` | `list.find` | properties: items = xs; where = c. new block |
| `xs.some(x => c)` | `list.some` | properties: items = xs; where = c. new block |
| `xs.every(x => c)` | `list.every` | properties: items = xs; where = c. new block |
| `xs.toSorted((a, b) => a.k - b.k)`, `xs.toSorted((a, b) => a - b)`, `xs.toSorted((a, b) => a.k.localeCompare(b.k))`, `xs.toSorted((a, b) => a.localeCompare(b))`, `[...xs].sort((a, b) => b.k - a.k)` | `list.sort` | properties: items = xs; by = current.k for a key comparator; omitted for an identity comparator (the block uses current); compare = number (a - b) \| locale (localeCompare); direction = desc when b comes first. compare is a new list.sort property: a copy sorted by the engine's Array.prototype.sort with the arrow's comparator (stable; NaN compares equal); without compare list.sort keeps its Flow order |
| `xs.toSorted((a, b) => a.k < b.k ? -1 : (a.k > b.k ? 1 : 0))` | `list.sort` | properties: items = xs; by = current.k; compare = natural; direction = desc when b comes first. relational comparators, symmetric spellings included; the identity form sorts by the items themselves |
| `xs.toSorted((a, b) => c1 \|\| c2 \|\| …)` | `list.sort` | properties: items = xs; by = first key; then = [{ by, compare, direction }, …]. each ci is an accepted key comparator; 0 or NaN falls to the next key, as \|\| |
| `xs.filter(…).map(…).join(", ")` |  | one node per block step, linked by local.__chain<N>. assignment or return; not in a branch of ?: && \|\| ??, not in an expression function argument, not after a scope read of the statement |
| `const x = cond ? xs.filter(…).map(…) : ys` |  | if (cond) { x = branch1 } else { x = branch2 }, each chain lowered inside its branch. a declaration or assignment that is entirely cond ? branch1 : branch2 |
| `xs.concat(ys)` |  | a copy of xs followed by the items of ys (a non-list argument is appended as one item). statement-level list method |
| `rows.push(v)` | `json.push` | properties: path = local.rows; value = v. rows created by json.array |
| `byId[key] = v` | `json.put` | properties: path = local.byId; key = key; value = v. byId created by json.map |
| `Object.keys(o)` | `object.keys` | properties: source = o. assignment, return or chain head |
| `Object.values(o)` | `object.values` | properties: source = o. assignment, return or chain head |
| `JSON.parse(t)` | `json.parse` | properties: text = t. assignment, return or chain head |
| `JSON.stringify(v)`, `JSON.stringify(v, null, 2)` | `json.stringify` | properties: value = v; pretty = true with (null, 2). assignment, return or chain head |
| `flow.default(a, b)` |  | expression function default (null, undefined and "" replaced) |
| `flow.while({…})`, `flow.forEach({…})`, `flow.if({…})`, `flow.try({…})` | `while \| forEach \| if \| try` | properties beyond the JavaScript form; slots keep $$ keys |
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
| a bare default( call: default is a reserved word of JavaScript | `FLOWSCRIPT_V3_RESERVED_WORD` | flow.default(x, y), or x ?? y |
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
| a for (;;) other than for (let i = a; i < b; i++), or that one with continue when the bound may change in the body | `FLOWSCRIPT_V3_FOR_FORM` | for…of or while |
| switch with fall-through, non-literal case or default not last | `FLOWSCRIPT_V3_SWITCH_FALLTHROUGH` | if / else if |
| do … while, for … in, labelled loop, labelled break or continue | `FLOWSCRIPT_V3_LOOP_FORM` | while, for (const key of Object.keys(o)) |
| a function other than a top-level helper, a list arrow or a slot: nested, in an expression, a closure | `FLOWSCRIPT_V3_FUNCTION` | inline, a top-level helper, or a project block |
| a block method in a branch of && \|\| ??, in a branch of ?: that is not the whole declaration, in an expression function argument, or after a scope read of the statement | `FLOWSCRIPT_V3_CHAIN` | two const |
| xs.sort alone, a comparator that is not an accepted key comparator, reduce, (x, i), outer arrow parameter in an inner arrow | `FLOWSCRIPT_V3_LIST_METHOD` | toSorted, list.sum, list.map or a loop |
| const rows = [] then rows.push of values that disagree or cannot be typed | `FLOWSCRIPT_V3_UNTYPED_LIST` | the exact json.array({ itemType }) proposal |
| Object.* or JSON.* elsewhere or with other arguments, Object.entries, Date.now, new Date | `FLOWSCRIPT_V3_GLOBAL_CALL` | the block (object.*, json.*, date.*) |
| throw new Error(m) | `FLOWSCRIPT_V3_ERROR_CODE_CHOICE` | throw { code: "CHOOSE_ERROR_CODE", message: m } |
| async, await, generators, classes, this, new | `FLOWSCRIPT_V3_UNSUPPORTED` | blocks |
| if or while whose condition is an object literal | `FLOWSCRIPT_V3_OBJECT_CONDITION` | flow.if({ … }) or flow.while({ … }) |
<!-- /generated -->
