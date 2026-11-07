# Flow Authoring Cycle

Backend FlowScript core: a complete Flow, the dialect rules, slots and loops, and the write, run, promote loop; other topics in sub-guides.

## Expressions in short

A condition, a value or an expression property is a small JavaScript subset; anything else is a block.

- **Values:** `input.*`, `config.*`, `local.*`, `result.*`, `current`, literals, `[a, b]`, `{ key: value }`,
  template literals, `true`, `false`, `null`, `undefined`, `Infinity`, `NaN`, `Math.PI`, `Math.E`.
- **Operators:** `+ - * / %`, `== != === !==`, `< <= > >=`, `&& || !`, `?:`, `??`, `typeof`, `value[key]`.
- **Functions:** `round(x, digits)`, `floor`, `ceil`, `abs`, `min`, `max`, `parseInt(text, 10)`, `parseFloat`,
  `isNaN`, `isFinite`, `Number(x)`, `String(x)`, `Number.isInteger`, `Number.isFinite`, `Number.isNaN`, the pure
  `Math.*` functions (`sqrt`, `pow`, `trunc`, `sign`, `hypot`, `log`, `log2`, `log10`, `exp`, `sin`, `atan2`...),
  `lower`, `upper`, `trim`, `contains`, `startsWith`, `endsWith`, `length`, `default(x, fallback)`, `json(x)`,
  `oneOf`, `overlaps`, `Array.isArray`.
- **Methods:** text `trim`, `toLowerCase`, `includes`, `split`, `replace`/`replaceAll` (text patterns), `slice`,
  `padStart`...; lists `includes`, `indexOf`, `slice`, `join`, `at`, `length`; numbers `toFixed`.
- **Regex:** `text.match({ text, pattern: "^[0-9]+$", flags: "i" })` (then `.matched`, `.groups`),
  `text.replace({ ..., regex: true })` (`$1` in the replacement), `text.split({ ..., regex: true })`.
- **Refused, with the block to write instead:** a regular expression literal `/x/` (the regex blocks above), a JavaScript `while`, `for` or `do` loop (the `while` and `forEach` blocks,
  below), `Math.random` (`crypto.random`), `Date.now` (`date.now`), `JSON.*` and `Object.*` (`json.*`, `object.*`),
  `push` on a list (`json.push`).

## A complete Flow

```javascript
const _flow = { sourceVersion: 2, inputs: { name: { type: "string", description: "Person name.", default: "Ada" } } }

function Greeting({ input, config, result }) {
  local.name = text.trim({ text: input.name })
  if (local.name == "") {
    throw { code: "NAME_REQUIRED", message: "name is required" }
  }
  result.message = `Hello ${local.name}`
}
```

## Dialect rules

- **Block calls** take exactly one object of named properties:
  `block.name({ key: value })`. A catalog name is a block before a JS method:
  `text.trim({...})` is a block, `local.word.trim()` stays JavaScript.
- **One statement per line.** Never join two Flow statements with `;` on one
  line.
- **Captures are assignments:** `local.x = block({...})` or
  `result.x = block({...})`. `const x = block({...})` is accepted and stored
  as `local.x`, but the writer emits `local.x = …`, so write that form.
  A plain value assignment such as `result.message = "Hello"` is stored as a
  `set` node and stays an assignment when formatted.
- **`$$out`** is the explicit capture metadata, only for destinations an
  assignment cannot express. An assignment and a disagreeing `$$out` give
  `FLOW_SOURCE_OUTPUT_CONFLICT`; chained or bodied assignments give
  `FLOWSCRIPT_UNSUPPORTED_ASSIGNMENT`.
- **Engine attributes use exactly two `$`:** `$$id` (the node Name, shown
  read-only in Studio and changed only by Rename), `$$comment` (Comment),
  `$$disabled: true` (Is active = false: the node and its subtree are skipped
  by execution and analysis; omit it when enabled), `$$out` (Output), and the
  slots `$$then`, `$$else`, `$$nodes`, `$$fields` (any declared slot is
  `$$<slot>`). Unknown `$$` names are errors. Plain names such as `id`,
  `disabled`, `out` or `comment` are business properties; `$$$name` spells a
  business property whose name starts with `$$`.
- **Headers** `const _flow = {...}` hold static literals only (no expressions,
  spreads, computed keys or duplicates: `FLOWSCRIPT_METADATA_LITERAL_REQUIRED`,
  `FLOWSCRIPT_DUPLICATE_PROPERTY`). Keys: `sourceVersion` (optional, 2 is the
  only value), `inputs`, `outputs`, `config` (an object), `tests`.
- **Language statements** stay script: assignments, `if (...) { ... } else { ... }`,
  `return { answer: input.value }`, bare `return`, and
  `throw { code: "INVALID", message: "Invalid input" }`.
  Catalog blocks stay calls, including captures `local.rows = sql.query({ ... })`.
  Loops keep their block calls in phase 1; natural loops are a later phase.
- **Error or answer:** `throw` what must interrupt the caller (missing rights,
  resource or parameter, failed dependency):
  the Flow answers its error alone and a frontend action fails and stops its
  chain. Return a normal result for an outcome the caller handles (wrong
  password, nothing found): `result.ok = false` with its reason, never a
  result made of an `error` object alone. To go on after a block that may
  fail (an email, a call to another Flow or service), wrap it in `try`:
  `try({ error: "local.failure", $$try: function () { ... }, $$catch: function () { ... } })`;
  catch reads `local.failure.code` / `.message`.
- **Values read as JavaScript:** a quoted string is text (`"cost ${x}"` is
  those characters), on a property of kind expression too (`day:
  "2025-12-14"` is that date, never 2025 - 12 - 14; a quoted scope path such
  as `where: "current.active"` is refused with the expression to write,
  `where: current.active`), an expression is a value with its type
  (`input.name`, `left + 1`, `!local.entity`, `local.items[0]`,
  `local.rows[local.rows.length - 1]`, `local.byId[input.id]`,
  `current["media:thumbnail"]`, null-safe), a template literal composes text
  (`` `Hello ${input.name}` ``), an object literal is a value (`select: {
  title: current.title }`). Strings take the escapes of JavaScript (`"\r\n"`,
  `"\t"`, `"\uFEFF"`, `"\u{1F600}"`, `"\\"`), in values and in expressions;
  a regular expression is a block, not an expression: `text.match({ text,
  pattern: "^[0-9]+$", flags: "i" })` (read `.matched`, `.groups`),
  `text.replace({ text, search: "-+", replacement: " ", regex: true })`,
  `text.split({ text, separator: "\\s*,\\s*", regex: true })`; a literal
  `/x/` assigned alone (`local.ok = /x/.test(s)`, `s.match(/x/)`,
  `s.replace(/x/g, y)`, `s.split(/x/)`) is rewritten to them, elsewhere it is
  refused at its line. A pattern runs under a budget (`TEXT_PATTERN_TIMEOUT`)
  and stays a literal text in a public Flow (`dynamicPattern: true` otherwise).
  A local never takes the
  name of a scope (`input`, `config`, `local`, `result`, `request`,
  `current`, `parent`, `trace`). Studio shows the same: a text, an
  expression, or a text with `${…}` parts. `===`
  and `!==` are strict as in JavaScript (`0 === ""` is false), `==` and `!=`
  loose. Methods chain as in JavaScript, on a path, a call or a parenthesis
  (`input.q.trim().toLowerCase().includes(local.term)`,
  `local.items.slice(0, 5).join(", ")`, `String(local.n).padStart(3, "0")`),
  from a fixed list: text `trim`, `toLowerCase`, `toUpperCase`, `includes`,
  `startsWith`, `endsWith`, `indexOf`, `lastIndexOf`, `slice`, `substring`,
  `split`, `replace`, `replaceAll` (text patterns), `padStart`, `padEnd`,
  `charAt`, `concat`, `repeat`; lists `includes`, `indexOf`, `slice`, `join`,
  `concat`, `at`, `length`; numbers `toFixed`. Numbers also have `%` and the
  functions `round(x, digits)`, `floor`, `ceil`, `abs`, `min`, `max`, written
  `Math.floor(...)` too: `local.pages = Math.ceil(input.total / input.size)`,
  and the other functions of "Expressions in short" (`parseInt(text, 10)`, `Math.sqrt(n)`...).
  Anything else is a block (`list.filter`, `list.map`, `list.sort`...).
- **Dates** use the `date.*` blocks, in a Flow and in Svelte actions alike
  (same contract on the server and in the browser): `date.today`,
  `date.now({ format: "iso" })`, `date.add` (years, months, days, hours,
  minutes; month ends adjusted as `LocalDate.plusMonths`: 2025-12-31 + 2
  months + 15 days = 2026-03-15), `date.format` (pattern, locale, timeZone),
  `date.parse`, `date.isValid` (strict: 2026-02-30 is invalid), `date.diff`,
  `date.compare`. Store dates as ISO text. The server reads
  `config.date.timeZone` (default UTC) and `config.date.locale`; pass the
  same public settings to a page for an identical display. Never write a
  Rhino block for date arithmetic.
- **Declared inputs arrive converted** whatever the caller (HTTP text, MCP,
  Flow call): `string` takes numbers and booleans as text and objects as
  JSON; `integer` truncates (`"3.9"` → 3); `number` parses text; `boolean`
  takes `true`/`false`/`1`/`0` in any case; `array` takes a JSON array text
  or wraps one value (`"a"` → `["a"]`); `object` takes a JSON object text;
  `any` is left as sent. An absent input takes its `default`; for a non-text
  input `""` and `null` count as absent unless `nullable: true`; a
  `required: true` input must be given. A value that does not convert is a
  400 `FLOW_INPUT_TYPE_INVALID`. Blocks get the same conversion with
  `ctx.convert(value, schema)`.
- **An `array` input is a list** in the Flow (`input.ids.length`,
  `input.ids.join(",")`, `list.*` blocks); its Convertigo variable is
  multi-valued, so an HTTP caller repeats the parameter or sends a JSON array
  text. A comma-separated text is one item (`"1,2"` → `["1,2"]`): to accept
  one, declare a `string` input and split it. A text method on a list
  (`input.ids.split(",")`) stops the run with `INVALID_EXPRESSION`, and a
  method on an absent input gives nothing without error: mark a list the Flow
  needs `required: true`.
- **Business `id`, `disabled`, `out` are free** for project block properties;
  core blocks declare no business `out` (`UNKNOWN_BLOCK_PROPERTY`).

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
`VALUE_TYPE_MISMATCH`. Create them with `path:` (not with an assignment).

## Loop

1. If the given `project`, `qname` or `block` is not accessible, stop and
   report it; never fall back to another project.
2. Write the Flow with `code-set`, patch with `code-patch`, run with
   `code-run`, then `code-promote` once diagnostics and behavior are clean.
   `unsaved:true` / `workingCopy:true` in `code-run` means: promote before
   stopping. `code-status` gives dirty/revision state, `code-discard` cancels,
   `code-analyze` returns scopes (`input`, `local`, `current`, `result`) and
   data-flow diagnostics for the working copy.
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

## Sub-guides

The rest of this guide is in focused sub-guides; read one only when the task needs it, once.

| Sub-guide (size) | Read it |
| --- | --- |
| `flow://guide/authoring-data` (8.3 KB) | lists, maps, `config.*`, output schemas, native inputs, backend primitives |
| `flow://guide/authoring-source` (5.7 KB) | editing existing or protected sources, formatting, accessibility |
| `flow://guide/authoring-blocks` (3.9 KB) | a missing block or a mock, samples, native Convertigo sequence properties |
