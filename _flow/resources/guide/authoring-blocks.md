# Flow Authoring: Blocks, Mocks And Native Properties

Project blocks and mocks from a Flow, real samples, and native Convertigo properties of sequences.

Sub-guide of `flow://guide/authoring`: read that guide first.

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
- Other project resources (`_flow/engine.yaml`, `_flow/types`, editors,
  libraries, fragments): `flow-resource-search`, `flow-resource-get`, then
  `flow-resource-patch` with `baseHash` and a unified `patch` (several hunks
  at once) or the whole new text as `content` (see
  `flow://guide/search-and-edit`).
- Java sources of the project (`libs/src/**/*.java`, compiled by the server
  into the project class path): the same tools. Create one with a patch from
  `--- /dev/null` (`@@ -0,0 +1,N @@`); its `package` matches its folder.
  Use Java for batched hotspots called once from Rhino, not per row or cell.
- Jars the project needs (`libs/jars.yaml`, same tools): never commit them;
  declare Maven coordinates or http(s) URLs, each with its quoted `sha256`.
  The server downloads and checks them, the exported `.car` carries them.

```yaml
repositories:                 # optional, Maven Central by default
  - https://repo.maven.apache.org/maven2
jars:
  - maven: io.github.openfeign.querydsl:querydsl-sql:7.7   # no transitive dependency: list each jar
    sha256: "<64 hex>"
  - url: https://download.example.com/driver-1.2.jar
    sha256: "<64 hex>"
```

  Credentials of a private repository are global symbols in its URL
  (`https://${repo.user}:${repo.password.secret}@host/path`). A
  non-redistributable driver stays in a private library project that carries
  its jar in `libs/`.

## Samples

For reusable examples, create a private executable Flow named `sample_*`.
Comments explain subtle syntax, for example
`// Only call Flow blocks with one object containing named parameters.`
Rhino sample blocks start with
`// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html`.

## Native Convertigo properties

Authoring properties are validated before any native bean changes. Booleans take
`true` or `false`; integer properties reject non-numbers and out-of-range values;
enums accept their constant or a unique display label, case aside. Spaces around
a scalar spelling are removed only when unambiguous. Never rely on a fallback
to zero, false or the first enum constant.

`code-check` reports invalid `_flow.inputs` and `_flow.accessibility` values at
their source line. Equivalent native scalar spellings are understood without
rewriting the source. Native operations
return `normalizations` with property, before and after; inspect them.

For inputs, use a supported JSON `type`, boolean `required`/`isFileUpload`, a
`visibility` of -1 or a mask from 0 to 15, and a text `description`. Typed defaults
must be convertible by the declared Flow input contract. Business request input
conversion is distinct from native authoring property validation.

`flow-project-metadata` edits only `version` (one line, at most 64 characters)
and `description` (at most 4000). It does not edit timeouts or CORS.
