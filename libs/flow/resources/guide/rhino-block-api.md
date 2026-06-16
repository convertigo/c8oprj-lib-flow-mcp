# Rhino Block API

Use this only when a missing primitive really needs Java/JVM access. Keep the
visible algorithm in FlowScript and put only the low-level bridge in Rhino.

Canonical shape:

```javascript
const _meta = {
  version: 1,
  runtime: "rhino",
  description: "Small Java/JVM primitive.",
  properties: {
    text: { kind: "template", type: "string", description: "Input text." }
  },
  outputs: {
    out: { type: "object" }
  }
}

// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html
(function () {
  return {
    run: function (ctx, node) {
      var props = ctx.props(node);
      var text = String(ctx.template(props.text || ""));
      return { text: text };
    }
  };
}())
```

Runtime helpers available in `run(ctx,node)`:

- `ctx.props(node)`: returns the direct block properties.
- `ctx.template(value)`: evaluates a template property such as `"hello ${input.name}"` or `"{{ input.name }}"` and returns a typed/string value.
- `ctx.expr(value)`: evaluates an expression property and preserves arrays, objects, numbers and booleans.
- `ctx.input(props, fallback)`: reads the generic value from `value`, `template`, `expr`, `from`-style properties when writing generic blocks.
- `ctx.read(path)`: reads a scope path such as `input.name`, `local.rows` or `config.http.timeout`.
- `ctx.write(path, value)`: writes to a scope path. Prefer returning the block result; use `write` only for explicit path properties such as `out`.
- `ctx.callBlock(name, props, options)`: calls another Flow block when you need composition from Rhino. Prefer FlowScript composition when possible.
- `ctx.throwFlow({ code, message, status, details, hint }, node)`: raises a structured Flow error.
- `ctx.lib("name")`: loads a declared helper library. If used, declare it in `_meta.uses` so the dependency is visible in the catalog.

Property mapping rule:

- `kind:"template"` -> read with `ctx.template(props.key)`.
- `kind:"expression"` -> read with `ctx.expr(props.key)`.
- `kind:"path"` -> pass the path string to `ctx.read` or `ctx.write`.
- `kind:"text"` / `literal` -> use the direct value unless the block explicitly documents evaluation.

Do not use Node.js APIs (`require`, npm modules, browser globals). Java classes
are available through `Packages`, for example
`Packages.java.security.MessageDigest`.

Do not implement a full backend feature in one Rhino block. Use standard blocks
for HTTP (`http.get`, `http.request`), requestables (`requestable.call`),
iteration/list transforms (`list.*`), JSON shaping (`json.*`), sessions, files
and resources. Rhino should cover only the missing primitive.
