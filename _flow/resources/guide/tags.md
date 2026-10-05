# Project Tags and Flow Configurations

Read and edit ordered sequence tags with the shared Studio domain, then attach named Flow configurations without copying their values into each Flow.

## Same domain, two MCP servers

`tags-get` and `tags-apply` are available in both the Flow and legacy MCP.
They use the same engine service as Eclipse and the web Studio. The normal
MCP bearer token is enough; an administrator browser session is not needed.
Do not regenerate tokens merely because an older tools catalog lacks tags.
Update the MCP project, reload it, and refresh the client's tools catalog.

`scope:"projectObjects"` manages sequence tags owned by the explicit project.
`scope:"workspaceProjects"` manages the workspace's project organization.
Sequences remain normal requestables; tags never change their parent,
invocation or permissions. Workspace project tags are not Flow configurations.

## Named configuration recipe

1. Use `authoring-tree({project})` and the contextual `authoring-palette` to
   inspect or create configurations in FlowEngine > Configs. `default` is the
   common configuration; named configurations are siblings. Use the generic
   authoring mutations returned by the palette, not raw file writes.
2. Read `tags-get({scope:"projectObjects",project})`. Reuse its `revision`,
   canonical sequence `targets`, and available `contributions`. The Flow
   contribution only exists when this project has a FlowEngine; its config
   choices expose names, never secret configuration values.
3. Create the tag with the exact revision:

```json
{
  "scope": "projectObjects",
  "project": "Demo",
  "revision": "<revision from tags-get>",
  "action": "create",
  "input": {
    "definition": {
      "label": "Baserow",
      "presentation": { "color": "#3366CC" },
      "metadata": { "flow": { "configs": ["baserowLab"] } }
    }
  }
}
```

4. The `tags-apply` result returns the new UUID in `id` and the next
   `revision`. Assign it with `action:"assign"`,
   `input:{targets:["Demo.sq:ListRecords"],tagIds:["<returned id>"]}`.
   Always take real targets from `tags-get`, not from display labels.
5. Verify with `tags-get` and run the tagged Flow with `code-run`. Project
   tag edits are drafts: finish with explicit **Save project**. Reload without
   Save discards them. The legacy MCP also provides the normal project Save
   operation. Do not promote unrelated Flow code to save tags.

## Order and safety

The assignment array preserves its explicit order. `assign` appends tags;
`reorder` requires exactly the existing assigned IDs, in the desired order.
The last tag wins, followed by the last config in that tag's `configs` array.
Precedence is Flow defaults < project default < tagged named configs < explicit
request config. A winning root key replaces the previous root key; there is
no implicit deep merge. `config.use` is the explicit merge mechanism.

`update` supplies the complete definition with `input.id`; preserve metadata
whose contribution is unavailable. A stale or missing revision, invalid
target, unknown config or read-only source is rejected by the domain.
`delete` requires `confirmed:true` and the current `memberCount`; destructive
clear and publication operations also retain their normal confirmations.
Workspace-only edits persist locally and never save a project implicitly.
