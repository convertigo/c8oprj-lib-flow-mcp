# Custom Blocks And Types

Prefer core blocks and core property types. Add project-local vocabulary only when it expresses a reusable domain concept.

For project-local FlowScript blocks, the canonical source lives under
`libs/flow/blocks/<namespace>/<name>.block.js`. The file contains `_meta` for
the visible contract and either one FlowScript function or one Rhino IIFE for
the implementation. Legacy YAML descriptors are still accepted only as migration
fallbacks for older blocks.

Before creating a new block, inspect real samples:

```json
{"tool":"code-get","arguments":{"project":"lib_flow_mcp","block":"sample.formatGreeting"}}
{"tool":"code-get","arguments":{"project":"lib_flow_mcp","block":"sample.sha256"}}
```

For Rhino/JVM primitives, read the MCP resource `flow://guide/rhino-block-api`
with `resources/read` before writing code. Do not search sibling repositories
for `ctx.*` helpers.

Only Rhino implementation source is JavaScript executed by Rhino ES6 inside the Convertigo JVM. Java classes are available through `Packages`; Node.js APIs such as `require`, npm modules and browser globals are not. Start Rhino sample or project blocks with `// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html`.

Minimal Rhino block source shape: `(function(){ return { run:function(ctx,node){...} }; }())`.

Use `input.*` inside Flow implementations and `local.*` for scratch state. `flow.*` and `props.*` are not expression scopes.

Use `ctx.props(node)`, `ctx.template(value)`, `ctx.expr(value)`, `ctx.read(path)`, `ctx.write(path,value)` and return a value when the catalog has an `out` path property. For `kind: "template"` properties, call `ctx.template(props.key)`; for expression properties, call `ctx.expr(props.key)`; use `ctx.input(props, fallback)` only for generic `value`-style properties. If Rhino code calls `ctx.lib("name")`, declare that library in `_meta.uses` so the dependency is visible in the catalog.

Types live under `libs/flow/types/*.type.yaml` and may point to HTML editors under `libs/flow/types/editors/*.html`.

Use `code-set` for project-local blocks with `block:"namespace.name"` or `kind:"block", name:"namespace.name"`. It accepts `{name, code, properties, description}` and writes the canonical `.block.js` file. Provide `outputs` when the return type is known; if omitted, the tool registers an `out` output with unknown type. FlowScript code can be just the block body, a `function localName({ input }) { ... }`, or the complete `_meta + function` source returned by `code-get`. Rhino code must be a complete `_meta` with `runtime: "rhino"` followed by an IIFE returning `{ run: function (ctx, node) { ... } }`. Use `flow-type-create` for project-local property types, then validate with `flow-catalog` or `flow-type-get`.

## Output Schemas

Do not leave block outputs as `unknown` when the result shape is stable or
derivable. A static contract belongs in `_meta.outputs`, for example
`outputs:{out:{type:"array",items:{type:"string"}}}`. Use this for wrappers,
protocol responses and primitives that always return the same shape.

When the output depends on an input schema, keep the static `outputs` broad and
add a `hooks.file` analyzer. Common helpers are:

- `ctx.addSameSchema(outPath, sourcePath)` for filters, sorts, takes and other
  pass-through transforms.
- `ctx.addArraySchema(outPath, itemSchema)` for mappers and pluck-like blocks.
- `ctx.schemaForExpression(value)` when a property can be a scope expression.
- `ctx.schemaForPath(path)` for selector/path properties.
- `ctx.itemSchema(schema)` or `ctx.itemSchemaFor(path)` for `current.*` item
  propagation.
- `ctx.addSchema(outPath, schema)` to publish the derived schema; node
  `outputs[].schema`, picker paths and `outputSchema` are updated from this.

For item-scoped expression properties such as `where`, `by` or `select`, set the
property metadata to `current:"item"` and `sourceProperty:"items"` so
`flow-context` exposes `current.name`, `current.age`, etc. Unknown is acceptable
only for deliberately generic values, learned external payloads before the first
run, or project block templates.

In FlowScript block code, `input.*` contains the block properties. Use `return value;` for the block result. Template literals such as `` `${input.name} - ${input.city}` `` are accepted for simple string composition. In executable Flow code, `return { ... }` writes the response object. A normal assignment such as `const label = my.block({ text: input.name })` stores the returned block value in `local.label`.

Use `code-set` directly when the block should become available in the project palette. Treat it like writing code: register it, run a Flow that uses it, then patch the block if diagnostics or runtime behavior are wrong.

For edits, prefer `code-get` followed by `code-patch`
with the returned `revision`. Use full `code` replacement only when the patch
would be larger or less clear than the complete `.block.js` source.
Use `code-rg` first when you need to find which FlowScript block
contains a phrase, property, helper call or expression.

When calling a block from compact FlowScript, use direct typed values where possible: `user.summary({ name: current.name, email: current.email })`, `forEach({ items: sorted })`, or `set({ path: "local.count", value: news.length })`. Quoted expression strings such as `items: "local.items"` are accepted for low-level calls, but the bare form is clearer. Use `{{ expression }}` only for mixed text templates, for example `"Hello {{ input.name }}"`, or when working with low-level canonical node data.

Reusable blocks can be used as array mappers: `const labels = list.map({ items, select: text.label({ value: current.name }) })`. This compiles to the explicit Flow loop, block call and `json.push` nodes.

Use Rhino blocks only for Java bridge or performance-critical primitives. Create them with `code-set` and a canonical `.block.js` source. Java packages are available through `Packages`, for example `Packages.java.security.MessageDigest`. Coerce Java values to JavaScript primitives before JS operations, for example `var s = String(javaString);` before using `s.length`.

Do not put a whole feature in one Rhino block. Reuse standard Flow blocks for IO (`http.get`, `http.request`, `requestable.call`), transforms (`list.*`), JSON shaping (`json.*`), files/resources and sessions. If only parsing or a Java bridge is missing, create that one primitive and keep orchestration in FlowScript. Project Rhino blocks must not open URLs, sockets, or Convertigo requestables directly; the engine rejects those implementations so the graph stays inspectable.

When a custom block is worth teaching, add a private executable Flow named `sample_*` that uses it in a realistic small graph. The search index will link the sample to the blocks it uses automatically.

For maintenance of non-FlowScript resources, use `flow-resource-search` + `flow-resource-get` + `flow-resource-patch` with `baseHash`. For executable Flows and project blocks, prefer `code-get`, `code-rg`, `code-set`, and `code-patch`; they are shorter and preserve the FlowScript model.

Duplicate a core/shared block with `flow-block-duplicate` before editing it with `flow-block-edit`.

Keep one-off procedural code exceptional; prefer a small Flow made of existing blocks.
