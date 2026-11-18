# FlowScript Slots And Collections

Loops, list methods and typed collections for backend FlowScript v3.

Continue after `flow://guide/authoring` when writing typed collections or loops.

## Loops, list methods and typed collections

For row processing, filter/project before the loop, copy the item before a
nested loop, and push to a typed array; avoid copying the growing array.
Metadata and external reads belong outside the cell loop whenever they are
independent of the cell. Keep business block calls visible in FlowScript.
The detailed examples and reproducible benchmark are in
`flow://lib/lib_flow_engine/runtime-performance`.

`code-run` skips per-node trace capture by default rather than capturing snapshots
that its compact response discards. Use `includeTrace:true` or
`includeFullTrace:true` when inspecting values. For profiling use
`profile:"envelope"` (phases) or `profile:true` (inclusive node/block time and,
where the JVM supports it, `allocatedBytes`). Measure throughput without tracing
or profiling. Automatic checks do not build a whole legacy project's XSD to
discover one output; use `flow-requestable-schema` explicitly if needed.

```javascript
const rows = json.array({
  itemType: { "type": "object", "properties": { "label": { "type": "string" }, "size": { "type": "number" } } },
})
for (const item of input.items) {
  if (item.field == null) {
    continue
  }
  rows.push({ label: item.label, size: item.field })
}
let status = "many"
if (rows.length == 0) {
  status = "empty"
} else if (rows.length == 1) {
  status = "single"
}
return { status, rows }
```

**Control flow** is JavaScript; each form is one block node:

<!-- generated:v3-fragment id=control-flow -->
| JavaScript | Block | Rule |
|---|---|---|
| `if (c) {…} else if (d) {…} else {…}` | `if` | An `else if` is an `if` in `else`. A single statement is a body of one statement. |
| `while (c) {…}` | `while` | `maxIterations` 1000 and `timeoutMs` 60000. Other values: `flow.while({…})` (call forms). |
| `for (const item of items) {…}` | `forEach` | `item` reads the current element. One level of object destructuring: `for (const { id } of rows)`. |
| `for (let i = a; i < b; i++) {…}` | `set` and `while` | Only this form, `<` or `<=`, step `++`; `i` is not assigned in the body. `continue` is accepted when the bound `b` cannot change in the body (otherwise `FLOWSCRIPT_V3_FOR_FORM`). `maxIterations` 1000000. |
| `switch (x) { case "a": …; break; default: … }` | chain of `if` | Literal labels; every case ends with `break`, `return` or `throw`; `default` last. |
| `try {…} catch (e) {…}` | `try` | The error is `local.e`, read as `e` inside the catch only. Without a parameter: `local.error`. |
| `continue` | `next` | In a `while` or a `for…of`, without a label. |
| `return`, `return value`, `return {…}` | `return` | Leaves the Flow. Refused inside a loop (`FLOWSCRIPT_V3_RETURN_IN_LOOP`). |
| `throw { code: "LITERAL", message }` | `throw` | `code` is a literal public code. |
<!-- /generated -->

<!-- generated:v3-example id=open-labels -->
```javascript
const _flow = { sourceVersion: 3, inputs: { orders: { type: "array" } } }

function OpenLabels({ input, config, result }) {
  const labels = json.array({ itemType: { type: "string" } })
  for (const order of input.orders) {
    if (order.status != "open") {
      continue
    }
    labels.push(`${order.id} ${order.customer}`)
  }
  try {
    email.send({ to: config.ops, subject: "Open orders", text: labels.join("\n") })
  } catch (failure) {
    result.mailError = failure.message
  }
  result.labels = labels
}
```
<!-- /generated -->

**Loops.** A `while` stops the run with `WHILE_ITERATION_LIMIT` after 1000 passes and after 60000 ms; for
another bound write its call form, `flow.while({ condition: d * d <= n,
maxIterations: 100000, $$nodes() { ... } })` (1 to 1000000, `timeoutMs` at most
600000). A counted `for (let i = 0; i < n; i++)` gets the largest bound. `break` is not available: use a local
tested by the `while` condition, or `find`/`filter`; a `return` inside a loop is not available either (use
`continue`, or a local and a `return` after the loop); `do`, `for…in` and labelled loops are refused
(`FLOWSCRIPT_V3_LOOP_FORM`):

<!-- generated:v3-example id=refused-break -->
```javascript refused=FLOWSCRIPT_V3_BREAK
const _flow = { sourceVersion: 3, inputs: { items: { type: "array" } } }

function FirstLarge({ input, config, result }) {
  let found
  for (const item of input.items) {
    if (item.size > 10) {
      found = item
      break
    }
  }
  return { found }
}
```
<!-- /generated -->

An inner loop can read the variable of an outer loop:

<!-- generated:v3-fragment id=nested-loops -->
**Nested loops.** Locals declared in a loop body remain available in nested loops. When an inner `for…of`, a list
method arrow, or a `flow.forEach`/`list.*` call rebinds `current` and reads the outer `for…of` item, the bridge
automatically copies that item to `local.<name>` at the start of the outer body. Destructured fields are already
copied from `current.<field>` there. Other reads of the item continue to use `current`.
<!-- /generated -->

**List methods** are blocks written as JavaScript, in a declaration, an assignment or a `return`:

<!-- generated:v3-example id=list-methods -->
```javascript
const _flow = { sourceVersion: 3, inputs: { rows: { type: "array" } } }

function Active({ input, config, result }) {
  const active = input.rows.filter(row => row.active)
  const names = active.map(row => row.name).join(", ")
  const first = input.rows.find(row => row.vip)
  const anyLate = input.rows.some(row => row.late)
  const sorted = active.toSorted((a, b) => b.score - a.score)
  const late = input.rows.filter(row => row.late).length
  return { names, first, anyLate, top: sorted.slice(0, 3), late }
}
```
<!-- /generated -->

<!-- generated:v3-fragment id=list-table -->
| JavaScript | Block |
|---|---|
| `xs.filter(x => c)` | `list.filter({ items: xs, where: c })`, `x` read as `current` |
| `xs.map(x => e)` | `list.map({ items: xs, select: e })`; an object literal is written `x => ({ … })` |
| `xs.find(x => c)` | `list.find({ items: xs, where: c })`: `undefined` when nothing matches |
| `xs.some(x => c)`, `xs.every(x => c)` | `list.some`, `list.every` |
| `xs.toSorted((a, b) => a.k - b.k)`, `[...xs].sort(…)` | `list.sort({ items: xs, by: current.k, compare: "number" })`; `b.k - a.k` adds `direction: "desc"` |
| `xs.toSorted((a, b) => a.k.localeCompare(b.k))` | `list.sort({ items: xs, by: current.k, compare: "locale" })`; `b.k.localeCompare(a.k)` adds `direction: "desc"` |
| `xs.toSorted((a, b) => a - b)` | `list.sort({ items: xs, compare: "number" })`; `b - a` adds `direction: "desc"` |
| `xs.toSorted((a, b) => a.localeCompare(b))`, also with `String(a)` and `String(b)` | `list.sort({ items: xs, compare: "locale" })`; reversed operands add `direction: "desc"` |
| `xs.toSorted((a, b) => a.k < b.k ? -1 : (a.k > b.k ? 1 : 0))` and its symmetric spellings | `list.sort({ items: xs, by: current.k, compare: "natural" })`: `left < right ? -1 : left > right ? 1 : 0` on the raw keys |
| `xs.toSorted((a, b) => c1 \|\| c2)`, each `c` an accepted key comparator | `list.sort` with the first key and `then: [{ by, compare, direction }, …]`; a `0` or `NaN` falls to the next key, as `\|\|` does |
| `includes`, `slice`, `join`, `at`, `indexOf`, `length` | expression methods, no block |
| `xs.concat(ys)` | a copy of `xs` followed by the items of `ys` (a non-list argument is appended as one item), as a statement-level list method |
<!-- /generated -->

<!-- generated:v3-fragment id=list-rules -->
- The function is an arrow with one parameter and an expression body without block call. `function (x) { return e }`
  is the same.
- A method is written in an assignment or a `return`. Methods chain: each block method becomes a node whose result
  feeds the next step through a hidden local `local.__chain<N>`.
- A declaration or an assignment that is entirely `cond ? branch1 : branch2` may hold a chain in a branch: it is lowered to
  `if (cond) { x = branch1 } else { x = branch2 }`.
- Refused, with a rewrite into two `const` (`FLOWSCRIPT_V3_CHAIN`): a step inside a branch of `&&`, `||` or `??`, or of
  a `?:` that is not the whole statement; a step in an argument of an expression function; a step after a scope read of
  the same statement.
- Sorting keeps the JavaScript comparator: `compare: "number"` orders by `a - b` and `compare: "locale"` by
  `String(a).localeCompare(String(b))`, on a copy sorted by the engine's `Array.prototype.sort`, exactly as the
  arrow does: the sort is stable, and an absent key gives `NaN`, which the comparator treats as equal. With
  `compare: "locale"`, an absent key compares as the text `"undefined"`: this is the meaning of
  `String(a.k).localeCompare(String(b.k))`, while `a.k.localeCompare(b.k)` would fail in JavaScript; both forms
  give that `list.sort` (paths are null-safe). Without `compare`,
  `list.sort` keeps its Flow order (numeric texts as numbers, `null` as `""`), which no JavaScript comparator
  reproduces: it stays a call.
- Refused: `xs.sort(…)` alone (it sorts in place, `list.sort` returns a copy: write `toSorted`), a comparator that is not an accepted key comparator,
  `reduce`, an index parameter `(x, i)`, a parameter of an outer arrow read in an inner one
  (`FLOWSCRIPT_V3_LIST_METHOD`).
<!-- /generated -->

`Array.isArray(value)` and `typeof value` are expressions. A block in an
assignment's comparison/arithmetic or `&&`, `||`, `??`, `?:` is evaluated once,
left to right, only in the branch that needs it. For example:
`const overdue = open && date.compare({left: item.dueDate, right: today}) < 0`.
A list method inside a branch of `&&`, `||` or `??` is refused: declare it first.

`throw.code` is a **literal public code**, for example `"INVALID_INPUT"`.
Keep dynamic data in `message` or `details`. `throw new Error(m)` is refused with
a proposed edit containing `"CHOOSE_ERROR_CODE"` and `requiresChoice:true`:
replace that placeholder with the intended public contract before applying it.

**Collections are created typed,** then changed as in JavaScript:
`const rows = json.array({ itemType })` then `rows.push(value)`;
`const byId = json.map({ valueType })` then `byId[key] = value`. A value that
does not match the declared type is refused with `VALUE_TYPE_MISMATCH`.

<!-- generated:v3-fragment id=collections -->
- A list or a map is created typed: `const rows = json.array({ itemType: {…} })`, `const byId = json.map({ valueType: {…} })`.
- `rows.push(v)` is `json.push({ path: "local.rows", value: v })`; `byId[key] = v` is `json.put({ path: "local.byId", key, value: v })`;
  `order.status = "paid"` is a `set`, as in v2.
- `const rows = []` (or `let`) followed by `push` is accepted: the declaration lowers to a `json.array` whose item type
  admits any value, or whose type is inferred from every `push` of the Flow. When the pushes disagree or cannot be typed
  it is refused (`FLOWSCRIPT_V3_UNTYPED_LIST`) with the exact `json.array({ itemType })` as its proposal.
<!-- /generated -->

**Call forms.** A block with slots keeps its call form (`flow.poll({ …,
$$nodes() { ... } })`); a slot takes a function body (`$$nodes() { ... }`, or
`$$nodes: () => { ... }`). Keep **two** dollar signs on engine attributes and
slots. Close both the slot body and the argument object: `$$nodes() { ... } })`.

## Loop

Copy the full `revision`; after a revision conflict, read again with `code-get` before rewriting.

1. If the given `project`, `qname` or `block` is not accessible, stop and
   report it; never fall back to another project.
2. Write the Flow with `code-set`, pass its returned `revision` to `code-patch`
   (then pass each patch's new `revision` to the next), run with
   `code-run`, then `code-promote` once diagnostics and behavior are clean.
   `unsaved:true` / `workingCopy:true` in `code-run` means: promote before
   stopping. `code-status` gives dirty/revision state, `code-discard` cancels,
   `code-analyze` returns scopes (`input`, `local`, `current`, `result`) and
   data-flow diagnostics for the working copy.
   Test a length limit from a draft `flow.call` of the Flow with
   `input: { comment: text.repeat("x", 2001) }`, never a long value typed by hand.
3. Do not pass `saveProject`, `refresh`, `draft` or `dry` unless low-level
   debugging was requested.
4. `flow-list` only for maintenance. `flow-search` only after a first draft
   when a block, sample or pattern is unclear; `flow-catalog` (typed
   signatures) or `flow-block-get` (one block) only when diagnostics are not
   enough. `flow-block-get` is the contract of a block (properties, outputs,
   `longDescription` with its errors and examples): read it there, never in
   the library sources.
5. `flow-test` validates saved Flows only; use `includeTrace:true` while
   debugging and avoid `includeFlow`, `includeFullResult`, `includeFullTrace`.
6. After `code-run` proves the result and `code-promote` succeeds, stop. No
   shell confirmation (`git`, `sed`, `cat`, HTTP scripts).
