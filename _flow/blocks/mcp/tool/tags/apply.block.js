const _meta = {
  sourceVersion: 2,
  version: 1,
  private: true,
  icon: "mdi:tag-search-outline",
  description: "Applies one revision-checked tag command through the shared Studio domain. Project tags stay unsaved drafts until explicit project Save (Studio or legacy project-save). Ordered memberships keep the last tag's configuration priority. Never saves a project implicitly.",
  properties: {
    request: { kind: "expression", type: "object", default: "input.request" },
    scope: { kind: "text", type: "string", enum: ["projectObjects", "workspaceProjects"], description: "Required. Same scope as the preceding tags-get." },
    project: { kind: "text", type: "string", description: "Required for projectObjects. Exact loaded project name." },
    revision: { kind: "text", type: "string", description: "Required. Exact revision from tags-get or the preceding tags-apply; stale revisions are rejected." },
    action: { kind: "text", type: "string", enum: ["create", "update", "delete", "assign", "remove", "clear", "transfer", "reorder", "share", "republish", "resolve", "createFromReferences"], description: "Required. One generic tag-domain command." },
    input: { kind: "literal", type: "object", additionalProperties: true, description: "Required command object. create/update: definition (preserve unavailable metadata), id for update. Memberships: targets and ordered tagIds; use canonical targets returned by tags-get. delete: id, confirmed:true, memberCount. clear/share/republish/resolve require confirmation. Flow configs use definition.metadata.flow.configs as an ordered list of named configurations advertised by tags-get." },
    out: { kind: "path", mode: "write", default: "local.response" },
  },
}

const _flow = { sourceVersion: 2 }

function mcp_tool_tags_apply({ input, config, result }) {
  mcp.tags.dispatch({ request: input.request, operation: "apply" })
}
