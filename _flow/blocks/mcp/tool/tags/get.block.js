const _meta = {
  sourceVersion: 2,
  version: 1,
  private: true,
  icon: "mdi:tag-search-outline",
  description: "Reads project sequence tags or workspace project tags, their revision, ordered memberships and available metadata contributions. Same domain as both Studios; no administrator browser session needed.",
  properties: {
    request: { kind: "expression", type: "object", default: "input.request" },
    scope: { kind: "text", type: "string", enum: ["projectObjects", "workspaceProjects"], description: "Required. projectObjects edits sequence tags in project; workspaceProjects edits local project organization." },
    project: { kind: "text", type: "string", description: "Required for projectObjects. Exact loaded project name, never a storage path." },
    referenceProject: { kind: "text", type: "string", description: "Optional workspaceProjects preview of this project's direct and indirect references." },
    out: { kind: "path", mode: "write", default: "local.response" },
  },
}

const _flow = { sourceVersion: 2 }

function mcp_tool_tags_get({ input, config, result }) {
  mcp.tags.dispatch({ request: input.request, operation: "get" })
}
