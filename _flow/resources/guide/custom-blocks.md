# Custom Blocks And Types

Project-local blocks: the `.block.js` file, the property charter, output schemas, defaults history, icons and types.

Prefer core blocks and core property types. Add project vocabulary only for a
reusable domain concept, and keep the algorithm visible in FlowScript. For a
block shared by backend and frontend, also read `flow://guide/portable-blocks`;
for a Java/JVM primitive, read `flow://guide/rhino-block-api`.

## File and shape

`_flow/blocks/<namespace>/<name>.block.js` is block `namespace.name`. It
starts with `const _meta = {...}` (static literals only, after optional
comments), followed by one FlowScript function or one Rhino IIFE. Companion
files sit beside it: `<name>.hooks.js` (analysis hooks declared by
`_meta.hooks.file`), `<name>.browser.js` (frontend implementation) and the
optional `<name>.block.defaults.json` (defaults history).

```javascript
const _meta = {
  "sourceVersion": 2,
  "description": "Formats a customer label.",
  "summary": "label {{name}}",
  "icon": "mdi:card-text-outline",
  "targets": [
    "backend",
  ],
  "properties": {
    "name": {
      "label": "Name",
      "kind": "template",
      "type": "string",
      "default": "World",
      "description": "Customer name.",
    },
    "id": {
      "label": "Customer id",
      "kind": "template",
      "type": "string",
      "default": "",
      "description": "Business identifier shown after the name.",
    },
  },
  "outputs": {
    "out": {
      "type": "string",
    },
  },
}

function crm_customerLabel({ input }) {
  return input.name + " #" + input.id
}
```

A caller captures the result with an assignment:

```javascript
local.label = crm.customerLabel({
  $$id: "label",
  name: "Ada",
  id: "42",
})
result.label = local.label
```

## Property charter

- `description` is required on the block and on every property. The public
  key is `properties`; each entry uses `label`, `kind`, `type`, `default`,
  `description`, and optionally `enum`, `expert`, `hidden`.
- Never declare engine metadata as properties. `$$id` (Name), `$$comment`
  (Comment), `$$disabled` (Is active) and `$$out` (Output) belong to every
  node. A property named `id`, `disabled`, `comment` or `out` is an ordinary
  business value, as `id` above.
- The block result is the returned value, described by `_meta.outputs.out`;
  the caller captures it (`local.x = ns.block({...})`). A block that returns
  nothing useful marks `outputs.out` `hidden` (or `expert`) so Studio moves
  or hides the Output row.
- `summary` is a node summary template such as `"GET {{url}}"`.
- `targets` lists `backend` and/or `frontend`; a frontend-only block in a
  backend Flow fails with `BLOCK_NOT_AVAILABLE_ON_TARGET`.
- `icon` names an Iconify icon (`"mdi:card-text-outline"`); see Icons below.
- A Rhino block that calls `ctx.lib("name")` declares it in `_meta.uses`.

In FlowScript block code, `input.*` holds the block properties, `local.*` is
scratch state and `return value` is the result. `input`, `local` and `result`
of a composite block are private: the caller sees only the returned value.

## Write, test, maintain

- Write the complete `_meta` + implementation with `code-set({ project,
  block:"ns.name", code })`. `code-set` and `code-patch` save blocks directly;
  never call `code-promote` for a block.
- Prove it by running a Flow that uses it (`code-run`). `code-check` on a
  block only validates `target:"frontend"` browser implementations.
- If `code-set` or `code-run` reports `FLOW_BLOCK_PROPERTY_UNKNOWN`,
  `FLOWSCRIPT_PROJECT_BLOCK_PROPERTY_UNKNOWN` or `FLOW_BLOCK_OUTPUT_UNKNOWN`,
  patch the `_meta` with native types. Use `type:"any"` only for deliberately
  generic values.
- Focused edits: `code-rg` then the smallest `code-patch` with its revision;
  bounded `code-get` only when more context is needed.
- Core and referenced blocks are read-only. For a project variant, read the
  original with `code-get({ project, block:"text.trim" })` and write the
  adapted source under a project name with `code-set`.
- Call blocks with direct typed values: `crm.customerLabel({ name:
  current.name })`, `forEach({ items: local.rows, $$nodes: function () {...}
  })`. Use `{{ expression }}` only for mixed text such as `"Hello {{
  input.name }}"`.
- Top-down: when the domain block does not exist yet, create a typed mock
  with `flow-block-mock` (it writes `_meta.mock = true` and a TODO), then
  implement it; `flow-block-mock-list` must be empty before completion.
- Design low-code APIs: pass domain objects or business fields (`zone`,
  `city`, `limit`), read endpoints and tokens from `config.*`, never ask
  callers for prebuilt URLs. Use `object.keys`/`object.get`/`object.firstEntry`
  instead of a block that only reads `map[code]`.
- When a block is worth teaching, add a private `sample_*` Flow using it.

## Output schemas

Do not leave outputs `unknown` when the shape is stable: declare it in
`_meta.outputs`, for example `outputs:{out:{type:"array",items:{type:"string"}}}`.
When it depends on an input schema, keep `outputs` broad and add a hooks
analyzer:

- `ctx.addSameSchema(outPath, sourcePath)` for filters, sorts and pass-through
  transforms;
- `ctx.addArraySchema(outPath, itemSchema)` for mappers;
- `ctx.schemaForExpression(value)`, `ctx.schemaForPath(path)`;
- `ctx.itemSchema(schema)` / `ctx.itemSchemaFor(path)` for `current.*`;
- `ctx.addSchema(outPath, schema)` to publish the derived schema.

For item-scoped expression properties (`where`, `by`, `select`), set
`current:"item"` and `sourceProperty:"items"` on the property so pickers and
`code-analyze` expose typed `current.*` paths.

## Defaults and history

- An absent property means its default. Studio or a mutation that sets a
  value back to the default removes it from the source.
- Whoever changes a declared default adds a history entry, so sources written
  against an older version keep their behavior. The companion file sits
  beside the definition (`x.block.js` -> `x.block.defaults.json`,
  `Card.flow.svelte` -> `Card.flow.defaults.json`):

```json
{ "format": "convertigo-flow-defaults",
  "history": [ { "until": "0.1.1", "props": { "padding": "16px" } } ] }
```

- For an instance written against definer version V (the `version` in the
  definer's `c8oProject.yaml`), the first entry with `until >= V` applies;
  otherwise the current default applies.
- `_flow/dependencies.json` records the definer versions a project was saved
  against (`{"format":"convertigo-flow-dependencies","projects":{...}}`). The
  Studio FlowEngine save writes it; do not edit it by hand. A default changed
  without history is logged as `FLOW_DEFAULTS_MIGRATION_REQUIRED`.

## Icons

`_meta.icon: "mdi:name"` resolves to `_flow/icons/iconify/<set>/<name>.svg`
plus the set's `LICENSE.json`, looked up in the project, its references,
lib_flow_engine, then the server cache. Saving a source copies the icons it
uses into its project. Icons are SVG project sources: never commit PNG
renderings and never put icons under `_flow/blocks`.

## Types

Property types live in `_flow/types/<name>.type.yaml` (project types are
named `project.<name>.type.yaml`) and may point to web editors in
`_flow/types/editors/<name>.html`. Create one only for real project
vocabulary; core types such as `text`, `path`, `value`, `template`,
`expression`, `literal`, `schema` or `requestable` usually fit. Maintain types,
editors, libraries and fragments with `flow-resource-search`,
`flow-resource-get` and `flow-resource-patch` (`baseHash`).
