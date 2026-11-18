# FlowScript expressions

Read when an expression or JavaScript equivalent is unclear.

## Expressions in short

A condition, a value or an expression property is a small JavaScript subset; anything else is a block.

- **Values:** `input.*`, `config.*`, `local.*`, `result.*`, `current`, literals, `[a, b]`, `{ key: value }`,
  template literals, `true`, `false`, `null`, `undefined`, `Infinity`, `NaN`, `Math.PI`, `Math.E`.
- **Operators:** `+ - * / %`, `== != === !==`, `< <= > >=`, `&& || !`, `?:`, `??`, `typeof`, `value[key]`.
- **Functions:** `round(x, digits)`, `floor`, `ceil`, `abs`, `min`, `max`, `parseInt(text, 10)`, `parseFloat`,
  `isNaN`, `isFinite`, `Number(x)`, `String(x)`, `Number.isInteger`, `Number.isFinite`, `Number.isNaN`, the pure
  `Math.*` functions (`sqrt`, `pow`, `trunc`, `sign`, `hypot`, `log`, `log2`, `log10`, `exp`, `sin`, `atan2`...),
  `lower`, `upper`, `trim`, `contains`, `startsWith`, `endsWith`, `length`, `json(x)`,
  `oneOf`, `overlaps`, `Array.isArray`, `text.repeat(text, n)`.
- **Absent values:** `x ?? fallback` replaces `null` and `undefined` and keeps `0`, `false` and `""`; write
  `flow.default(x, fallback)` when `""` must count as absent too. `default(…)` alone is refused: `default` is a reserved
  word of JavaScript (`FLOWSCRIPT_V3_RESERVED_WORD`, rewrite `flow.default(…)`).
- **Methods:** text `trim`, `toLowerCase`, `includes`, `split`, `replace`/`replaceAll` (text patterns), `slice`,
  `padStart`...; lists `includes`, `indexOf`, `slice`, `join`, `at`, `length`; numbers `toFixed`.
- **Regex:** `text.match({ text, pattern: "^[0-9]+$", flags: "i" })` (then `.matched`, `.groups`),
  `text.replace({ ..., regex: true })` (`$1` in the replacement), `text.split({ ..., regex: true })`.
- **`?.`** is accepted and means `.` (paths are already null-safe). Prefer the JavaScript methods (`x.toLowerCase()`,
  `a.includes(b)`, `x.length`) to the older functions `lower`, `contains`, `length`.
- **Statements, not expressions:** list methods with an arrow (`xs.filter(x => …)`, `map`, `find`, `some`, `every`,
  `toSorted`), `Object.keys(o)`, `Object.values(o)`, `JSON.parse(t)`, `JSON.stringify(v)` and `rows.push(v)` are blocks
  written as JavaScript: use them in a declaration, an assignment, a `return`, the list of a `for…of`
  (`for (const key of Object.keys(o))`) or an `if` condition (`if (!roles.some(r => r == "OWNER"))`), chained if needed
  (`rows.filter(r => r.ok).map(r => r.id).join(",")`), not inside a branch of `?:`, `&&`, `||` or `??`, except a
  value that is entirely `c ? a : b` (`const post = id ? posts.find(p => p.id === id) : undefined`, an `if`/`else`).
  Not in a `while` condition, evaluated before every pass: keep the value in a `let` updated at the end of the body.
  `xs.concat(ys)` is JavaScript's `concat` and may take a chain (`items.concat(page.rows.map(r => ({ id: r.id })))`).
- **Loops and collections:** `for (const x of xs)` is the `forEach` block and `while (condition)` the `while` block;
  typed lists and maps, loop bounds and refusals: `flow://guide/authoring-collections`.
- **Refused, with the replacement:** a regular expression literal `/x/` (the regex blocks above), `Math.random`
  (`crypto.random`), `Date.now` and `new Date` (`date.now`, `date.format`), `Object.entries`
  (`for (const key of Object.keys(o))`), `reduce` (`list.sum`, `list.map` or a loop), `xs.sort` in place (`toSorted`).
