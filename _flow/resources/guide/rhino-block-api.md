# Rhino Block API

Rhino project blocks: the canonical source shape and the `ctx` helpers available in `run(ctx, node)`.

Use this only when a missing primitive really needs Java/JVM access. Keep the
visible algorithm in FlowScript and put only the low-level bridge in Rhino.
The property charter of `flow://guide/custom-blocks` applies unchanged.

Canonical shape:

```javascript
const _meta = {
  "sourceVersion": 2,
  "runtime": "rhino",
  "description": "Small Java/JVM primitive.",
  "properties": {
    "text": {
      "label": "Text",
      "kind": "template",
      "type": "string",
      "default": "",
      "description": "Input text.",
    },
  },
  "outputs": {
    "out": {
      "type": "object",
    },
  },
}

// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html
(function () {
  return {
    run: function (ctx, node) {
      var props = ctx.props(node);
      var text = String(ctx.template(props.text || ""));
      return { text: text, length: text.length };
    }
  };
}())
```

The IIFE returns `{ run: function (ctx, node) {...} }` plus local helpers;
dynamic labels and analysis live in the `hooks.file` companion, not in
runtime code. Write it with `code-set({ project, block:"ns.name", code })`
and prove it by running a Flow that calls `local.x = ns.name({ text: "hi" })`.

Runtime helpers available in `run(ctx,node)`:

- `ctx.props(node)`: the direct business properties (never engine `$$`
  attributes).
- `ctx.template(value)`: evaluates a template property such as
  `"{{ input.name }}"` and returns a typed or string value.
- `ctx.expr(value)`: evaluates an expression property and preserves arrays,
  objects, numbers and booleans.
- `ctx.input(props, fallback)`: reads a generic `value`-style property.
- `ctx.read(path)`: reads a scope path such as `input.name`, `local.rows` or
  `config.http.timeout`.
- `ctx.write(path, value)`: writes a scope path. Return the block result
  instead; use `write` only for a declared destination property
  (`kind:"path"`, `mode:"write"`, for example `path` or `target`). Never
  declare `out`, `id`, `comment` or `disabled` to mean engine metadata.
- `ctx.callBlock(name, props, options)`: calls another Flow block. Prefer
  FlowScript composition when possible.
- `ctx.throwFlow({ code, message, status, details, hint }, node)`: raises a
  structured Flow error.
- `ctx.lib("name")`: loads a helper library declared in `_meta.uses`.

Property mapping rule:

- `kind:"template"` -> `ctx.template(props.key)`.
- `kind:"expression"` -> `ctx.expr(props.key)`.
- `kind:"path"` -> pass the path string to `ctx.read` or `ctx.write`.
- `kind:"text"` / `literal` / `value` -> use the direct value (or
  `ctx.input`) unless the block documents evaluation.

Rhino runs ES6 inside the Convertigo JVM. Java classes are available through
`Packages`, for example `Packages.java.security.MessageDigest`; coerce Java
values before JS operations (`var s = String(javaString);`). Node.js APIs
(`require`, npm modules) and browser globals are not available.

Do not implement a full backend feature in one Rhino block. Use standard blocks
for HTTP (`http.get`, `http.request`), requestables (`requestable.call`),
iteration and list transforms (`list.*`), JSON shaping (`json.*`), sessions,
files and resources. Project Rhino blocks that open URLs, sockets or
requestables are rejected. The sample `sample.sha256` in `lib_flow_mcp` shows
a minimal Java bridge.
