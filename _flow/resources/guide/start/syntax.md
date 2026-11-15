# FlowScript first syntax conversions

Read before the first code-set when translating JavaScript idioms.

> **JavaScript → FlowScript** (before the first `code-set`; details in `flow://guide/authoring-data`)
> `for (const item of items)` → `forEach({ items: input.items, $$nodes() { ... } })`; use `current` inside.
> `try { JSON.parse(x) }` → `local.parsed = json.safeParse({ text: input.text })`; check `local.parsed.ok`, then use `.value`.
> `/re/.test(x)` → `local.match = text.match({ text: input.code, pattern: "re" })`; check `local.match.matched`.
> `arr.push(x)` → declare `json.array({ path: "local.arr", itemType: { type: "number" } })` (items' type), then `json.push({ path: "local.arr", value: input.value })`.
> `arr.map/filter/some(cb)` → `list.map({ items: input.items, select: { id: current.id } })` / `list.filter({ items: input.items, where: current.ok })`; for `some`, test the filtered list's `.length`.
> `JSON.*` calls → catalogued `json.*` blocks; for example `JSON.stringify(x)` → `json.stringify({ value: input.value })`.
> `if (block.name({ ... }))` → assign `local.value = block.name({ ... })` first, then test `if (local.value)`.
