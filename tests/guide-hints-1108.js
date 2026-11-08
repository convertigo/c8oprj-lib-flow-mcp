// Invented guide names resolve only when the matching guide is present.
var root = new java.io.File(arguments[0]);
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8"));
var mcp = eval(source);
var sql = "flow://lib/lib_flow_sql/sql";
var guides = [{ uri: sql, project: "lib_flow_sql" }];
var core = ["start", "authoring"];
function assert(value, message) { if (!value) throw new Error(message); }
["flow://lib/lib_flow_sql/guide", "flow://lib/lib_flow_sql/start", "flow://guide/sql", "flow://lib/lib_flow_sql"].forEach(function (uri) {
  assert(mcp.guideAlias(uri, guides, core).uri === sql, uri + " should resolve to the available SQL guide");
  assert(mcp.guideAlias(uri, [], core).uri !== sql, uri + " must not resolve to an unavailable guide");
});
["flow://lib/lib_flow_sql/direct-sql", "flow://lib/lib_flow_sql/setup"].forEach(function (uri) {
  var found = mcp.guideAlias(uri, guides, core);
  assert(!found.uri && found.suggestions.indexOf(sql) >= 0, uri + " should only suggest SQL");
});
["flow://guide/flows", "flow://skills/flow-authoring/SKILL", "flow://skills/authoring/SKILL"].forEach(function (uri) {
  var found = mcp.guideAlias(uri, guides, core);
  assert(!found.uri && found.suggestions.indexOf("flow://guide/authoring") >= 0, uri + " should suggest authoring");
});
var schema = mcp.toolError({ jsonrpc: "2.0", id: 2, method: "tools/call", params: {
  name: "flow-resource-get", arguments: { project: "App", path: "_flow/resources/sql/books/schema.json" }
} }, { code: "UNKNOWN_RESOURCE", message: "Unknown resource" }).result.structuredContent.error;
assert(/flow-resource-search/.test(schema.hint) && !schema.details, "an invented schema path prompts project resource search without fabricating a guide");
print("guide-hints-1108 OK");
