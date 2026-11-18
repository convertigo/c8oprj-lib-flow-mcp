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

**Loops.** `for (const item of items) { ... }` is the `forEach` block; `continue`
goes to the next item. `while (condition) { ... }` is the `while` block: it stops
the run with `WHILE_ITERATION_LIMIT` after 1000 passes and after 60000 ms; for
another bound write its call form, `flow.while({ condition: d * d <= n,
maxIterations: 100000, $$nodes() { ... } })` (1 to 1000000, `timeoutMs` at most
600000). `for (let i = 0; i < n; i++)` (or `<=`) is accepted in that form only,
`continue` included, with a body that does not assign `i`. There is no
`break` (use a local tested by the `while` condition, or `find`/`filter`), no
`return` inside a loop (use `continue`, or a local and a `return` after the loop),
no `do`, `for…in` or labelled loop (`FLOWSCRIPT_V3_LOOP_FORM`). An inner loop can
read the variable of an outer loop: the bridge copies an outer `for…of` item
automatically when an inner loop or list callback rebinds `current` and reads it.
Locals declared in a loop body remain readable in nested loops.

**List methods** are blocks written as JavaScript, in a declaration, an assignment
or a `return`: `xs.filter(x => x.ok)` (`list.filter`), `xs.map(x => ({ id: x.id }))`
(`list.map`), `xs.find(x => …)`, `xs.some(…)`, `xs.every(…)`, and
`xs.toSorted((a, b) => a.score - b.score)` (`list.sort`; `b - a` sorts down,
`a.name.localeCompare(b.name)` sorts text, `a.code < b.code ? -1 : a.code > b.code ? 1 : 0`
sorts with JavaScript's `<`). Several keys join with `||`:
`(b.total - a.total) || a.name.localeCompare(b.name)`; the next key decides when
the previous one gives `0` or `NaN`. To sort the items themselves, use
`xs.toSorted((a, b) => a - b)` or `b - a` for numbers, and
`xs.toSorted((a, b) => a.localeCompare(b))` or
`String(a).localeCompare(String(b))` for text; reversing the operands sorts down.
The identity forms use `list.sort({ items, compare })` without `by`. List method
arrows use one parameter (two for `toSorted`) and an expression body without a
block call. They chain:
`rows.filter(r => r.ok).map(r => r.name).join(", ")`. `xs.sort` (in place),
`reduce`, an index parameter and other comparators (`a.k === b.k ? 0 : …`,
`a.k < b.k ? -1 : 1`, which differ on absent keys) are refused with a rewrite.

`Array.isArray(value)` and `typeof value` are expressions. A block in an
assignment's comparison/arithmetic or `&&`, `||`, `??`, `?:` is evaluated once,
left to right, only in the branch that needs it. For example:
`const overdue = open && date.compare({left: item.dueDate, right: today}) < 0`.
A list method or another block inside a branch of `?:`, `&&`, `||` or `??` is
refused: declare it first. A declaration or an assignment that is entirely
`c ? a : b` is the exception: it becomes `if (c) { x = a } else { x = b }`.
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
An object read from a map is that object, as in JavaScript: after
`const g = byCat[c]`, `g.count++` and `g.total += x` change the map.
`const rows = []` followed by `rows.push(v)` becomes that `json.array` when every
pushed value shows its type: text, template and number literals, `true`, `false`,
comparisons, `null`, object and list literals (`rows.push({ label: "x", ok: n > 0 })`).
A pushed name, path or computed number is refused with the `json.array` to write.

**Call forms.** A block with slots keeps its call form (`flow.poll({ …,
$$nodes() { ... } })`); a slot takes a function body (`$$nodes() { ... }`,
`$$nodes: function () { ... }` or `$$nodes: () => { ... }`), also in a call that
is assigned: `const tx = sql.transaction({ …, $$nodes() { ... } })` (its output
goes to `tx`). Keep **two** dollar signs on engine attributes and
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
