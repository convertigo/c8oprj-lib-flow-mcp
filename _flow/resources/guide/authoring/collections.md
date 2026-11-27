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
| `if (c) {…} else if (d) {…} else {…}` | `if` | An `else if` is an `if` in `else`. A single statement is a body of one statement. A list method or a global call that `c` always evaluates (not after `&&`, `\|\|` or `??`, in a branch of `?:` or in a call argument) runs before the `if`, in a hidden local. |
| `while (c) {…}` | `while` | `maxIterations` 1000 and `timeoutMs` 60000. Other values: `flow.while({…})` (call forms). No list method in `c`, evaluated before every pass (`FLOWSCRIPT_V3_CHAIN`). |
| `for (const item of items) {…}` | `forEach` | `item` reads the current element. One level of object destructuring: `for (const { id } of rows)`. `items` may be `Object.keys(o)`, `Object.values(o)` or a list method chain, computed once before the loop. |
| `for (let i = a; i < b; i++) {…}` | `set` and `while` | Only this form, `<` or `<=`, step `++`; `i` is not assigned in the body. `continue` is accepted, even when `b` changes in the body: the counter steps before the body, on a hidden local. `maxIterations` 1000000. |
| `switch (x) { case "a": …; break; default: … }` | chain of `if` | Literal labels; every case ends with `break`, `return` or `throw`; `default` last. |
| `try {…} catch (e) {…}` | `try` | The error is `local.e`, read as `e` inside the catch only. `catch {…}` declares no name: the error goes to `local.error`, or to a hidden local when the Flow has its own `error`. |
| `continue` | `next` | In a `while`, a `for…of` or a counted `for`, without a label. |
| `return`, `return value`, `return {…}` | `return` | Leaves the Flow. Refused inside a loop (`FLOWSCRIPT_V3_RETURN_IN_LOOP`). `return block({…})` returns the result of the call, written to a hidden local first. |
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
600000). A counted `for (let i = 0; i < n; i++)` (or `<=`, `continue` included, with a body that does not assign
`i`) gets the largest bound. `break` is not available: use a local
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
method arrow, or a `flow.forEach`/`list.*` call rebinds `current` and reads the outer `for…of` item, the reader
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

For the method table and chaining rules, read `flow://guide/authoring/collections/methods`.

`Array.isArray(value)` and `typeof value` are expressions. A block in an
assignment's comparison/arithmetic or `&&`, `||`, `??`, `?:` is evaluated once,
left to right, only in the branch that needs it. For example:
`const overdue = open && date.compare({left: item.dueDate, right: today}) < 0`.
A list method inside a branch of `&&`, `||` or `??` is refused: declare it first.
An `if` condition runs its list methods first (`if (!roles.some(r => r == "OWNER"))`);
a `while` condition, evaluated before every pass, cannot: test a `let` updated at
the end of the body. `for (const key of Object.keys(o))` computes the keys once.

`throw.code` is a **literal public code**, for example `"INVALID_INPUT"`.
Keep dynamic data in `message` or `details`. `throw new Error(m)` is refused with
a proposed edit containing `"CHOOSE_ERROR_CODE"` and `requiresChoice:true`:
replace that placeholder with the intended public contract before applying it.

**Collections are created typed,** then changed as in JavaScript:
`const rows = json.array({ itemType })` then `rows.push(value)`;
`const byId = json.map({ valueType })` then `byId[key] = value`. A value that
does not match the declared type is refused with `VALUE_TYPE_MISMATCH`.
A local object is a map without a declared type: `const groups = {}` then
`groups[key] = value` groups by a computed key, without sorting first.
An object read from a map is that object, as in JavaScript: after
`const g = byCat[c]`, `g.count++` and `g.total += x` change the map.

<!-- generated:v3-fragment id=collections -->
- A list or a map is created typed: `const rows = json.array({ itemType: {…} })`, `const byId = json.map({ valueType: {…} })`.
- `rows.push(v)` is `json.push({ path: "local.rows", value: v })`; `byId[key] = v` is `json.put({ path: "local.byId", key, value: v })`;
  `order.status = "paid"` is a `set`, as in v2.
- A local declared with an object literal is a map too: `const groups = {}` then `groups[key] = v`, `groups[key] += v`
  and `groups[key]++` are `json.put`; a finite number key is its text, as in JavaScript. A computed key elsewhere
  (`result[k]`, a loop item, a list item, a nested field, an input) and `groups[k].push(v)` are refused
  (`FLOWSCRIPT_V3_COMPUTED_WRITE`) with the form to write: the local object, then `result.groups = groups`;
  `groups[k] = groups[k].concat([v])`.
- `const rows = []` (or `let`) followed by `push` lowers to the `json.array` whose item type every pushed value proves
  from its syntax (text, number and boolean literals, comparisons, `null`, object and list literals); a pushed name,
  path, call or computed number is refused (`FLOWSCRIPT_V3_UNTYPED_LIST`) with the exact `json.array({ itemType })` to
  write as its proposal.
<!-- /generated -->

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
