# FlowScript dialect rules

Read for metadata, slots, values, dates or input conversion.

## Dialect rules

- **FlowScript v3 is JavaScript** (`sourceVersion: 3`): the reader lowers each
  statement to a block node. Semicolons are optional; write one statement per line.
- **Block calls** take exactly one object of named properties:
  `block.name({ key: value })`. A catalog name is a block before a JS method:
  `text.trim({...})` is a block, `word.trim()` stays JavaScript.
- **Imports** are JavaScript: `const { get: httpGet, post } = flow.import("http")`
  (named blocks) or `const requestable = flow.import("requestable")` (namespace),
  at the top of the file. `import … from` is refused; `flow` is reserved.
- **Locals are declarations:** `const total = list.sum({ items })`, `let count = 0`,
  `let found` (`undefined`), one level of destructuring `const { name, email } = input`.
  The value lives in `local.<name>`; `local.x = …` stays valid, but never name the
  same local both ways (scope rules below). `x += e`, `x++` are statements.
- **Outputs:** `return { total, items: rows }` writes the output fields and leaves
  the Flow; `result.x = …` writes one field. Use one style per Flow.
- **`$$out`** (call form only) is the explicit capture metadata, only for destinations an
  assignment cannot express. An assignment and a disagreeing `$$out` give
  `FLOW_SOURCE_OUTPUT_CONFLICT`; chained or bodied assignments give
  `FLOWSCRIPT_UNSUPPORTED_ASSIGNMENT`.
- **Engine attributes use exactly two `$`:** `$$id` (the node Name, shown
  read-only in Studio and changed only by Rename), `$$comment` (Comment),
  `$$disabled: true` (Is active = false: the node and its subtree are skipped
  by execution and analysis; omit it when enabled), `$$out` (Output), and the
  slots `$$then`, `$$else`, `$$nodes`, `$$fields` (any declared slot is
  `$$<slot>`). They belong to the call form of a block: control flow is written
  natively, and a control block keeps a call form (`flow.while({ …, maxIterations,
  $$nodes() { … } })`) only for properties its JavaScript form cannot carry.
  Unknown `$$` names are errors. Plain names such as `id`,
  `disabled`, `out` or `comment` are business properties; `$$$name` spells a
  business property whose name starts with `$$`. To build source text with
  JavaScript, use `split(oldText).join(newText)` or a replacement callback: a
  replacement string reads `$$` as one `$`.
- **Headers** `const _flow = {...}` hold static literals only (no expressions,
  spreads, computed keys or duplicates: `FLOWSCRIPT_METADATA_LITERAL_REQUIRED`,
  `FLOWSCRIPT_DUPLICATE_PROPERTY`). Keys: `sourceVersion` (3), `inputs`,
  `outputs`, `config` (an object), `tests`.
- **Language statements** are JavaScript: declarations and assignments,
  `if (...) { ... } else if (...) { ... } else { ... }`, `while (...) { ... }`,
  `for (const item of items) { ... }`, `for (let i = 0; i < n; i++) { ... }`,
  `continue`, `switch` (literal cases ending with `break`, `return` or
  `throw`), `try { ... } catch (e) { ... }`,
  `return { answer: input.value }`, bare `return`, and
  `throw { code: "INVALID", message: "Invalid input" }`.
  Catalog blocks stay calls, including captures `const rows = sql.query({ ... })`.
  Everything outside this list is refused at its line, with the rewrite (`flow://guide/authoring/refusals`). A top-level helper after the Flow function is accepted with one object parameter.
- **Error or answer:** `throw` what must interrupt the caller (missing rights,
  resource or parameter, failed dependency):
  the Flow answers its error alone and a frontend action fails and stops its
  chain. Return a normal result for an outcome the caller handles (wrong
  password, nothing found): `result.ok = false` with its reason, never a
  result made of an `error` object alone. To go on after a block that may
  fail (an email, a call to another Flow or service), wrap it in
  `try { ... } catch (failure) { ... }`; the catch reads `failure.code`,
  `failure.message`, `failure.details` and every other field of the thrown
  object (`throw { code, message, field: "amount" }` gives `failure.field`),
  and `throw failure` raises it again unchanged. Uncaught, those fields reach
  the client at the top of the error envelope:
  `{ error: { code, message, details, field } }`.
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
  minutes; month ends adjusted as `LocalDate.plusMonths`: 2024-01-31 + 1
  month + 10 days = 2024-03-10: 2024-02-29 after the month, then 10 days),
  `date.format` (pattern, locale, timeZone),
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
  `FLOW_INPUT_TYPE_INVALID` application error (200 with its envelope) that
  names the input, never the value. Blocks get the same conversion with
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

## Scope rules

<!-- generated:v3-fragment id=scope-rules -->
**Scope rules** (refused otherwise):
- a name is read only inside the block that declares it (`FLOWSCRIPT_V3_OUT_OF_SCOPE`);
- a name is not declared again in an enclosed block, and does not hide an import or a loop variable
  (`FLOWSCRIPT_V3_SHADOWING`);
- a `const` is not assigned again; its object or list may still change (`FLOWSCRIPT_V3_CONST_ASSIGN`);
- a local takes neither the name of a scope (`input`, `config`, `local`, `result`, `request`, `current`, `parent`,
  `trace`), nor `flow`, nor a name starting with `__`, nor the name of a block namespace the Flow uses
  (`text`, `list`, `json`, `http`…): after `let text = …`, `text.trim({…})` would be a method call in JavaScript
  (`FLOWSCRIPT_V3_RESERVED_NAME`, `FLOWSCRIPT_V3_NAME_SHADOWS_BLOCK`).
<!-- /generated -->

## Value rules

Same meaning as JavaScript, with the value rules of the FlowScript expression evaluator:

<!-- generated:v3-fragment id=value-rules -->
- paths are null-safe: `local.a.b` is `undefined` when `local.a` is `null`, where JavaScript would throw
  (likewise `Object.keys(null)` is `[]`);
- `<`, `<=`, `>`, `>=` compare two numeric texts as numbers: `"10" < "9"` is `false` (JavaScript compares the
  texts and says `true`); inputs often arrive as text;
- a template literal writes `null` and `undefined` as `""`, and an object or a list as JSON;
- loops have an execution budget: a `while` stops the run with `WHILE_ITERATION_LIMIT` after 1000 passes or
  60 s unless `flow.while` sets other bounds; a counted `for` gets the largest bound (1000000 passes, 60 s).
<!-- /generated -->

Continue with `flow://guide/authoring/collections` for the remaining recipes.
