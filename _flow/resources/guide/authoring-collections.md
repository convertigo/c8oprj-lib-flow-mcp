# FlowScript Slots And Collections

Typed collections, slots and loop syntax for backend FlowScript.

Continue after `flow://guide/authoring` when writing typed collections or loops.

## Slots, loops and typed collections

For row processing, filter/project before the loop, capture `current` before a
nested loop, and append to a typed array with `json.push`; avoid copying the
growing array. Metadata and external reads belong outside the cell loop whenever
they are independent of the cell. Keep business block calls visible in FlowScript.
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
json.array({
  path: "local.rows",
  itemType: { "type": "object", "properties": { "label": { "type": "string" }, "size": { "type": "number" } } },
})
forEach({
  items: input.items,
  $$nodes: function () {
    json.push({ path: "local.rows", value: { label: current.label, size: current.field } })
  },
})
if (local.rows.length == 0) {
  result.status = "empty"
} else {
  if (local.rows.length == 1) {
    result.status = "single"
  } else {
    result.status = "many"
  }
}
result.rows = local.rows
```

A loop that is not over a list is the `while` block:
`while({ condition: local.d * local.d <= local.n, maxIterations: 100000, $$nodes() { ... } })`.
`maxIterations` is 1000 when omitted (1 to 1000000): a condition still true after it stops the run with
`WHILE_ITERATION_LIMIT`, so set it to the largest count the input allows; `timeoutMs` is 60000 (at most 600000).
A JavaScript `while`, `for` or `do` loop is refused at its line (`FLOWSCRIPT_LOOP_UNSUPPORTED`).

A slot (`$$then`, `$$else`, `$$nodes`, `$$try`, `$$catch`) takes a function
body. The method form `$$then() { ... }` and an arrow function with a block
body `$$then: () => { ... }` are the same slot; an arrow with an expression
body, an async function or a function under a name the block does not declare
as a slot is refused, and the refusal names the slots of the block.

Keep **two** dollar signs on engine attributes and slots (`$$id`, `$$nodes`).
When building text with JavaScript, use `split(oldText).join(newText)` or a
replacement callback: a replacement string interprets `$$` as one dollar.
Close both the slot body and the argument object: `$$nodes() { ... } })`.
The diagnostic supplies an exact edit for a mistaken prefix or an unambiguous
missing argument brace; source is never silently rewritten.

`Array.isArray(value)` and `typeof value` are expressions. A block in an
assignment's comparison/arithmetic or `&&`, `||`, `??`, `?:` is evaluated once,
left to right, only in the branch that needs it. For example:
`local.overdue = local.open && date.compare({left: current.dueDate, right: local.today}) < 0`.
Inside a `list.map` projection, use a named per-item block for multi-step work;
do not move work on `current` before the iterator. Block calls under arbitrary
JavaScript methods still require explicit intermediates in the same branch.

`throw.code` is a **literal public code**, for example `"INVALID_INPUT"`.
Keep dynamic data in `message` or `details`. Its proposed edit contains
`"CHOOSE_ERROR_CODE"` and `requiresChoice:true`: replace that placeholder with
the intended public contract before applying it.

Collections are created typed, then mutated explicitly: `json.array({ path,
itemType })`, `json.map({ path, valueType })`, `json.push({ path, value })`,
`json.put({ path, key, value })`. Destinations are static `local.`/`result.`
names; a value that does not match the declared type is refused with
`VALUE_TYPE_MISMATCH`. Create them with `path:`, or assign the call (it gives the `path`).

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
