# FlowScript List Methods

Mapping, filtering, sorting and chaining lists in backend FlowScript.

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
| `xs.toSorted((a, b) => a.k < b.k ? -1 : (a.k > b.k ? 1 : 0))` and its exact spellings | `list.sort({ items: xs, by: current.k, compare: "natural" })`: `left < right ? -1 : left > right ? 1 : 0` on the raw keys; `b` first adds `direction: "desc"` |
| `xs.toSorted((a, b) => c1 \|\| c2 \|\| …)`, each `ci` one of the comparators above | `list.sort` with the first key and `then: [{ by, compare, direction }, …]`; a `0` or `NaN` falls to the next key, as `\|\|` does |
| `xs.sort((a, b) => …)` as a statement, `xs` a list the Flow builds (`const xs = []` or `json.array`), never assigned nor read whole before the sort or in a loop around it | `list.sort` into `local.xs` itself, with the comparators above; on any other list, `const sorted = xs.toSorted(…)` (`FLOWSCRIPT_V3_LIST_METHOD`) |
| `includes`, `slice`, `join`, `at`, `indexOf`, `length` | expression methods, no block |
| `xs.concat(ys)` | the expression method `Array.prototype.concat`: a copy of `xs` followed by the items of `ys` (a non-list argument is appended as one item); a list method chain in an argument runs before it |
<!-- /generated -->

<!-- generated:v3-fragment id=list-rules -->
- The function is an arrow with one parameter and an expression body without block call. `function (x) { return e }`
  is the same.
- A method is written in an assignment or a `return`. Methods chain: each block method becomes a node whose result
  feeds the next step through a hidden local `local.__chain<N>`.
- A declaration or an assignment that is entirely `cond ? branch1 : branch2` may hold a chain in a branch: it is lowered to
  `if (cond) { x = branch1 } else { x = branch2 }`. The condition of an `if` may hold a chain that it always
  evaluates: it runs before the `if`.
- Refused, with a rewrite into two `const` (`FLOWSCRIPT_V3_CHAIN`): a step inside a branch of `&&`, `||` or `??`, or of
  a `?:` that is not the whole statement; a step in an argument of an expression function; a step after a scope read of
  the same statement; a step in a `while` condition.
- Sorting keeps the JavaScript comparator: `compare: "number"` orders by `a - b`, `compare: "locale"` by
  `String(a).localeCompare(String(b))` and `compare: "natural"` by `a < b ? -1 : a > b ? 1 : 0` (the JavaScript `<` on
  the raw keys), on a copy sorted by the engine's `Array.prototype.sort`, exactly as the
  arrow does: the sort is stable, and an absent key gives `NaN`, which the comparator treats as equal. With
  `compare: "locale"`, an absent key compares as the text `"undefined"`: this is the meaning of
  `String(a.k).localeCompare(String(b.k))`, while `a.k.localeCompare(b.k)` would fail in JavaScript; both forms
  give that `list.sort` (paths are null-safe). Without `compare`,
  `list.sort` keeps its Flow order (numeric texts as numbers, `null` as `""`), which no JavaScript comparator
  reproduces: it stays a call.
- Refused: `xs.sort(…)` inside an expression, or as a statement on a list the Flow does not build (it sorts in place what
  shares the list: write `toSorted`), a comparator that is not an accepted key comparator,
  `reduce`, an index parameter `(x, i)`, a parameter of an outer arrow read in an inner one
  (`FLOWSCRIPT_V3_LIST_METHOD`).
<!-- /generated -->

**Call forms.** A block with slots keeps its call form (`flow.poll({ …,
$$nodes() { ... } })`); a slot takes a function body (`$$nodes() { ... }`,
`$$nodes: function () { ... }` or `$$nodes: () => { ... }`), also in a call that
is assigned: `const tx = sql.transaction({ …, $$nodes() { ... } })` (its output
goes to `tx`). Keep **two** dollar signs on engine attributes and
slots. Close both the slot body and the argument object: `$$nodes() { ... } })`.
