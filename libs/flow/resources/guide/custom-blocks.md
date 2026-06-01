# Custom Blocks And Types

Prefer core blocks and core property types. Add project-local vocabulary only when it expresses a reusable domain concept.

Native blocks live under `libs/flow/blocks/*.js`; composite graph blocks live under `libs/flow/blocks/*.block.yaml` and expose props plus internal nodes.

Block source is JavaScript executed by Rhino ES6 inside the Convertigo JVM. Java classes are available through `Packages`; Node.js APIs such as `require`, npm modules and browser globals are not.

Minimal block source shape: `(function(){ return { name:"demo.block", catalog:function(){...}, analyze:function(ctx,node){...}, run:function(ctx,node){...} }; }())`.

Use `ctx.props(node)`, `ctx.template(value)`, `ctx.expr(value)`, `ctx.read(path)`, `ctx.write(path,value)` and return a value when the catalog has an `out` path property.

Types live under `libs/flow/types/*.js` and may point to HTML editors under `libs/flow/types/editors/*.html`.

Use `flow-block-create` or `flow-type-create` for project-local additions, then validate with `flow-block-test`, `flow-catalog` or `flow-type-get`.

For maintenance, prefer `flow-resource-search` + `flow-resource-get` + `flow-resource-patch` with `baseHash`; it is closer to how coding agents work on files.

Duplicate a core/shared block with `flow-block-duplicate` before editing it with `flow-block-edit`.

Keep one-off procedural code exceptional; prefer a small Flow made of existing blocks.
