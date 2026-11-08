// A saved object removal refused for Studio drafts must name the two resolution tools.
var root = new java.io.File(arguments[0]);
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8"));
var mcp = eval(source);
var error = mcp.toolError({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
  name: "flow-object-remove", arguments: { project: "App", qname: "App.notes_list" }
} }, { code: "PROJECT_HAS_STUDIO_DRAFTS", message: "Project has unsaved Studio drafts.",
  details: { pendingDrafts: ["_flow/flows/notes_list.flow.js"] } }).result.structuredContent.error;
if (!/code-promote/.test(error.hint) || !/code-discard/.test(error.hint) ||
    !/before retrying flow-object-remove/.test(error.hint)) throw new Error("Missing removal recovery: " + error.hint);
print("remove-draft-hint-1108 OK");
