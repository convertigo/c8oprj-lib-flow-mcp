# Custom Blocks And Types

Prefer core blocks and core property types. Add project-local vocabulary only when it expresses a reusable domain concept.

Block contracts live under `libs/flow/blocks/*.block.yaml`. Rhino blocks use a
separate `*.js` implementation; Flow-backed blocks use a separate
`*.flow.yaml` implementation.

Only Rhino implementation source is JavaScript executed by Rhino ES6 inside the Convertigo JVM. Java classes are available through `Packages`; Node.js APIs such as `require`, npm modules and browser globals are not.

Minimal Rhino block source shape: `(function(){ return { run:function(ctx,node){...} }; }())`.

Use `input.*` inside Flow implementations and `local.*` for scratch state. `flow.*` and `props.*` are not expression scopes.

Use `ctx.props(node)`, `ctx.template(value)`, `ctx.expr(value)`, `ctx.read(path)`, `ctx.write(path,value)` and return a value when the catalog has an `out` path property. If Rhino code calls `ctx.lib("name")`, declare that library in the descriptor with `uses: [name]`.

Types live under `libs/flow/types/*.type.yaml` and may point to HTML editors under `libs/flow/types/editors/*.html`.

Use `flow-block-create` or `flow-type-create` for project-local additions, then validate with `flow-block-test`, `flow-catalog` or `flow-type-get`.

For maintenance, prefer `flow-resource-search` + `flow-resource-get` + `flow-resource-patch` with `baseHash`; it is closer to how coding agents work on files.

Duplicate a core/shared block with `flow-block-duplicate` before editing it with `flow-block-edit`.

Keep one-off procedural code exceptional; prefer a small Flow made of existing blocks.
