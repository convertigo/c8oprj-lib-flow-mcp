# FlowScript dialect rules

Read for metadata, slots, values, dates or input conversion.

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

Continue with `flow://guide/authoring-collections` for the remaining recipes.
