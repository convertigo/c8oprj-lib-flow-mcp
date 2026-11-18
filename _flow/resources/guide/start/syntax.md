# FlowScript first syntax conversions

Read before the first code-set when translating JavaScript idioms.

> **FlowScript v3 is JavaScript** (`const _flow = { sourceVersion: 3 }`; details in `flow://guide/authoring`).
> Write `const`/`let`, `if`/`else`, `while`, `for (const item of items)`, `continue`, `try`/`catch (e)`, `switch`,
> `return { … }`, `rows.filter(r => …)`, `.map`, `.find`, `.some`, `.every`, `.toSorted((a, b) => a.k - b.k)`,
> `Object.keys(o)`, `JSON.parse(t)`, `JSON.stringify(v)` as in JavaScript.
> Imports: `const { get: httpGet } = flow.import("http")`, never `import … from`.
> Not available, with the replacement: `break` → a local tested by the `while` condition, or `find`/`filter`;
> `finally` → the statements after the `try`; `return` inside a loop → `continue`, or a local and a `return` after it;
> `throw new Error(m)` → `throw { code: "LITERAL_CODE", message: m }`; `/re/.test(x)` → `text.match({ text: x, pattern: "re" })`;
> `const rows = []` then `push` → `const rows = json.array({ itemType: { … } })` then `rows.push(v)`;
> a nested function or closure → write it inline, a top-level helper after the Flow function with one object parameter, or a project block.
