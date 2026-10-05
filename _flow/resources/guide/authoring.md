# Flow Authoring Cycle

Backend FlowScript: the source dialect with verified examples, then the write, run, promote and schema loop.

## A complete Flow

```javascript
const _flow = {
  "sourceVersion": 2,
  "inputs": {
    "name": {
      "type": "string",
      "description": "Person name.",
      "default": "Ada",
    },
  },
}

function Greeting({ input, config, result }) {
  local.name = text.trim({
    $$id: "cleanName",
    text: input.name,
  })
  if({
    $$id: "checkName",
    condition: local.name == "",
    $$then: function () {
      throw({
        $$id: "missingName",
        code: "NAME_REQUIRED",
        message: "name is required",
        status: 400,
      })
    },
  })
  result.message = "Hello {{ local.name }}"
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
  `set` node and written back as `set({ $$id, path, value })`.
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
- **Control flow is blocks with slots.** JavaScript `if`/`else`, loops and
  `throw` statements are rejected (`FLOWSCRIPT_UNSUPPORTED_SYNTAX`); there is
  no `else if`: nest an `if` block in `$$else`. Raise errors with
  `throw({ code, message, status, details })`.
- **Values:** arithmetic and comparisons stay expressions (`left + 1`,
  `!local.entity`). Expressions are null-safe and allow index reads
  (`local.items[0]`, `current["media:thumbnail"]`). Object literals are values
  (`select: { title: current.title }`), not expressions. Use
  `"Hello {{ input.name }}"` or a template literal for mixed text.
- **Business `id`, `disabled`, `out` are free** for project block properties;
  core blocks declare no business `out` (`UNKNOWN_BLOCK_PROPERTY`).

## Slots, loops and typed collections

```javascript
json.array({
  $$id: "rows",
  path: "local.rows",
  itemType: {
    type: "object",
    properties: {
      label: { type: "string" },
      size: { type: "number" },
    },
  },
})
forEach({
  $$id: "eachItem",
  items: input.items,
  $$nodes: function () {
    json.push({
      $$id: "addRow",
      path: "local.rows",
      value: {
        label: current.label,
        size: current.field,
      },
    })
  },
})
if({
  $$id: "isEmpty",
  condition: local.rows.length == 0,
  $$then: function () {
    result.status = "empty"
  },
  $$else: function () {
    if({
      $$id: "isSingle",
      condition: local.rows.length == 1,
      $$then: function () {
        result.status = "single"
      },
      $$else: function () {
        result.status = "many"
      },
    })
  },
})
result.rows = local.rows
```

Collections are created typed, then mutated explicitly: `json.array({ path,
itemType })`, `json.map({ path, valueType })`, `json.push({ path, value })`,
`json.put({ path, key, value })`. Destinations are static `local.`/`result.`
names; a value that does not match the declared type is refused with
`VALUE_TYPE_MISMATCH`. Create them with `path:` (not with an assignment).

## Lists, maps and config

```javascript
local.rows = list.map({
  $$id: "rows",
  items: input.items,
  select: {
    label: current.label,
  },
})
result.rows = local.rows
local.rates = json.object({
  $$id: "rates",
  $$fields: function () {
    json.field({
      $$id: "eur",
      key: "EUR",
      value: 1,
    })
    json.field({
      $$id: "usd",
      key: "USD",
      value: 1.1,
    })
  },
})
local.codes = object.keys({
  $$id: "codes",
  source: local.rates,
})
local.usd = object.get({
  $$id: "usd",
  source: local.rates,
  key: "USD",
})
result.codes = local.codes
result.usd = local.usd
```

- Never hard-code `items[0]`, `items[1]` for a dynamic list. `list.map`
  `select` takes an expression or object literal, not a block call; for a
  per-item block, use `forEach` with a `json.push` into a typed array.
- `object.firstEntry({ source })` returns one `{ key, value }`.
- For repeated external work, model one item and iterate: store rows in
  `config.*` or a small data block and call one per-item FlowScript block.
- Temporary configuration for a subtree:

```javascript
config.use({
  $$id: "slowHttp",
  http: {
    timeout: 30000,
  },
  $$then: function () {
    result.timeout = config.http.timeout
  },
})
```

Root keys (or one `overrides` object) are config branches, deep-merged only
while `$$then` runs. Config precedence per root key: `_flow.config`, then
project `_flow/engine.yaml`, then request config. The project configuration is
`default` with the named configurations of the Flow's tags merged over it,
value by value, the last tag winning (`flow://guide/tags`). Put structural constants
(API roots, tokens, timeouts) in project or Flow `config.*`; reuse existing
project config instead of duplicating it in `_flow.config`.

For JSON HTTP APIs: `local.response = http.get({ url: config.api.url })`,
then read `local.response.body`; parse `local.response.text` only when the
body is not native JSON.

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
   enough.
5. `flow-test` validates saved Flows only; use `includeTrace:true` while
   debugging and avoid `includeFlow`, `includeFullResult`, `includeFullTrace`.
6. After `code-run` proves the result and `code-promote` succeeds, stop. No
   shell confirmation (`git`, `sed`, `cat`, HTTP scripts).

## Formatting and defaults

The canonical writer puts one property per line, engine attributes first
(`$$id`, `$$comment`, `$$disabled`, `$$out`), then business properties, then
slots. The first write of a non-canonical file reorders it completely: expect
that diff and do not "repair" it; patch the returned revision afterwards.
A property edit (Studio or mutation) that sets a value back to the block
default removes it from the source: absent means default, and a present
default value stays valid.

## Maintenance edits

Start with `code-rg`. Each extract carries its target, line range and
revision: when the match is unique, apply the smallest `code-patch` directly.
Otherwise read only that range with `code-get({ qname, revision, startLine,
endLine })`; read the whole source only for ambiguous or broad changes. To
skip a node without deleting it, patch `$$disabled: true` into its call and
remove the line to restore it.

## Output schemas

- `flow-output-schema({ project, qname })` combines the explicit contract,
  static analysis of `result.*` writes and optional learned samples; add
  `detail:"full"` to compare declared/static/learned/effective sources and
  warnings. Ordinary `code-run` does not learn the Flow result.
- `_flow.outputs` is optional. After a verified run, `action:"adopt"` with
  `source:"static"|"learned"` writes it, `action:"remove"` deletes it,
  `action:"reset"` deletes stale learned samples only.
- `flow-node-output-schema({ project, qname, nodeId, detail:"full" })`
  inspects one producer (HTTP, exec, parser); pass the JSON Pointer `path`
  from `flow-search` as `nodePointer` when `nodeId` is ambiguous. Use
  `action:"adopt"` to keep a verified schema, `action:"remove"` to resume
  inference.
- Learned fields no longer produced, or `unknown` items from old samples, are
  stale. Prefer `flow-node-output-schema action:"remove"` for one producer;
  `flow-schema-reset({ project, flowName })` only for broader stale learned
  schemas.

## Blocks and mocks

- If a readable draft needs a missing domain block, let `UNKNOWN_BLOCK`
  confirm it, then `flow-block-mock({ project, name, properties, outputs })`
  with the call arguments as typed properties. The mock is `mock:true` with a
  TODO; implement it before calling the parent Flow done, and audit with
  `flow-block-mock-list`.
- Treat `FLOW_BLOCK_PROPERTY_UNKNOWN`,
  `FLOWSCRIPT_PROJECT_BLOCK_PROPERTY_UNKNOWN` and `FLOW_BLOCK_OUTPUT_UNKNOWN`
  as contract feedback: patch the project block `_meta` with native types.
- Rhino blocks are for missing low-level primitives only; read
  `flow://guide/rhino-block-api` first. Never hide HTTP or requestable calls
  in Rhino, and never write a block only to enumerate object keys.
- For pure logic shared with Flow Svelte, read `flow://guide/portable-blocks`.
- Other project resources (`_flow/types`, editors, libraries, fragments):
  `flow-resource-search`, `flow-resource-get`, `flow-resource-patch` with
  `baseHash`.

## Samples

For reusable examples, create a private executable Flow named `sample_*`.
Comments explain subtle syntax, for example
`// Only call Flow blocks with one object containing named parameters.`
Rhino sample blocks start with
`// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html`.
