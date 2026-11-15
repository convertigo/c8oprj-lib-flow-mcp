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
  `lower`, `upper`, `trim`, `contains`, `startsWith`, `endsWith`, `length`, `default(x, fallback)`, `json(x)`,
  `oneOf`, `overlaps`, `Array.isArray`, `text.repeat(text, n)`.
- **Methods:** text `trim`, `toLowerCase`, `includes`, `split`, `replace`/`replaceAll` (text patterns), `slice`,
  `padStart`...; lists `includes`, `indexOf`, `slice`, `join`, `at`, `length`; numbers `toFixed`.
- **Regex:** `text.match({ text, pattern: "^[0-9]+$", flags: "i" })` (then `.matched`, `.groups`),
  `text.replace({ ..., regex: true })` (`$1` in the replacement), `text.split({ ..., regex: true })`.
- **Refused, with the block to write instead:** a regular expression literal `/x/` (the regex blocks above), a JavaScript `while`, `for` or `do` loop (the `while` and `forEach` blocks in
  `flow://guide/authoring-collections`), `Math.random` (`crypto.random`), `Date.now` (`date.now`), `JSON.*` and `Object.*` (`json.*`, `object.*`),
  `push` on a list (`json.push`).
