# Flow Authoring: Source Ownership And Protection

Source ownership and canonical formatting, maintenance edits, protected authoring and accessibility rules.

Sub-guide of `flow://guide/authoring`: read that guide first.

## Protected authoring

An application may register what it prepared (a data source, an adopted
schema) through two platform blocks, never through Java internals:

```javascript
local.preview = config.mutate({
  project: "sampleApp",
  configuration: "dataLab",
  path: "data.sources.orders",
  op: "set",
  value: { provider: "sql", connection: "labPg", table: "orders", readOnly: true },
  dryRun: true,
})
// confirm with revision: local.preview.previousRevision, persist: "draft" or "save"
```

`schema.adopt({ qname, node?, schema, dryRun, revision, persist })` replaces
`_flow.outputs` of a Flow (without `node`) or adopts the schema of one node;
pass the complete schema, a proposal is never adopted implicitly.

Both run for an administrator over HTTP (POST with the session XSRF token) or
an authenticated MCP call only, whatever the accessibility of the Flows on the
way; anyone else gets `AUTHORING_FORBIDDEN`, dry runs included. A dry run
returns `before`, `after` and `previousRevision`; a change in between answers
a revision conflict. `persist: "draft"` keeps the working copy the Save of the
project publishes; `"save"` writes that one file and is refused over its
unsaved changes. Secret keys only take a reference to a `.secret` global
symbol, whose default may be a test or development value:
`"${<project>.<usage>.<name>.secret=<default>}"`.

## Accessibility

```javascript
const _flow = { accessibility: "private" }

function Internal({ input, config, result }) {
  result.ok = true
}
```

`private` Flows run only for Flow→Flow calls, the MCP and administrators;
`hidden` Flows are callable over HTTP but not listed; `public` Flows are
listed. Without `accessibility`, the Flow property applies. Keep internal,
exploration, authoring, test and qualification Flows private; make `public`
or `hidden` only what a frontend or an external client calls, and validate
its inputs there.

Where it applies: on a server, `.json`, `.xml` and the other
`/projects/<project>/.<ext>?__sequence=` URLs answer an anonymous or
non-administrator call to a `private` Flow as an unknown requestable; a recent
Studio does the same, an older one still ran it for an anonymous call (Studio
mode). Prove the refusal with a session that is not an administrator, and do
not add guards to the Flow for it. A URL Mapper
operation (`/api/...`) publishes its target whatever its accessibility, and
`requestable.call`, the scheduler and the MCP run `private` Flows by design.

For JSON HTTP APIs: `local.response = http.get({ url: config.api.url })`,
then read `local.response.body`; parse `local.response.text` only when the
body is not native JSON.

## Source ownership and formatting

`code-set` and `code-patch` keep and compile your exact text. Diagnostics use
its line numbers. An equivalent spelling is understood; a guessed block name,
key or positional call is refused with a `proposedPatch`: line, before, after,
and exact `oldText`/`newText` edits for `code-patch`. Review it; no suggestion
is ever applied automatically, including when an old client sends `autoCorrect`.

Only `code-promote` and Studio tree edits format. Promotion checks the tree
before and after formatting and saves nothing if the program changes. Its
answer includes `linted`, `changedLines` and the text-hash `revision`. An
unchanged text keeps its revision; continue with it without another `code-get`.
The formatter is idempotent, with code width 120.

Names are implicit: the assignment destination (`answer`), the instruction
(`if`, `throw`, `return`) or the local block name (`trim`). Repetitions use
`if2`, `if3`, skipping explicit names. Names remain assigned during editing;
a new node takes the next free counter even when inserted above an old one.
Reload recalculates them in source order. Node tools accept these names for
the current revision; identify a diagnostic by its source line.

Use a JavaScript label for an explicit name: `cleanName: local.name =
text.trim({ text: input.name })`, or `checkName: if (...) { ... }`. Studio
Rename writes the label; renaming back to the implicit name removes it.
Duplicate explicit names are errors. Existing `$$id` is still read and is
formatted as a label, or omitted when redundant. A block nested in a property
keeps `$$id` when an explicit name is needed there.

A comment attached to the next instruction is its Comment (`$$comment`),
written one `//` line per text line, without reflow. A blank line separates a
standalone `comment` node; a comment at the end of a body is also standalone.
These nodes are visible in the tree, have no properties, and are removed
when execution is prepared. At most one authored blank line is kept before
its node, including after a Studio property edit.

Natural syntax cannot carry every block attribute: a disabled statement, a
`set` with additional properties, or a conflicting `$$out` keeps its generic
call form. `set({ ... })` remains valid for every existing source.
A property edit that restores a block default can omit that property.

## Maintenance edits

Start with `code-rg`. Each extract carries its target, line range and
revision: when the match is unique, apply the smallest `code-patch` directly.
Otherwise read only that range with `code-get({ qname, revision, startLine,
endLine })`; read the whole source only for ambiguous or broad changes. To
skip a node without deleting it, patch `$$disabled: true` into its call and
remove the line to restore it.
