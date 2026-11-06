// An unknown focusPath tells the expected form and the nearest existing paths; obvious forms are corrected.
var projectDir = arguments.length > 0 ? arguments[0] : ".";
var engineDir = arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow";
var io = Packages.org.apache.commons.io.FileUtils;
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(String(io.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8")));
var mcpFlowSource = String(io.readFileToString(new java.io.File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
var targetDir = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"), "lib_flow_mcp_focus_" + java.lang.System.currentTimeMillis());
targetDir.mkdirs();
function assert(ok, message) { if (!ok) throw new Error(message); }
var sourceFile = "_flow/frontbuilder/svelte/model/Focus/src/routes/+page.flow.svelte";
io.writeStringToFile(new java.io.File(targetDir, sourceFile), ["<script module>", "  export const _flow = { sourceVersion: 2 };",
	"</script>", "", "<FlowComponent", "  $$id=\"focus\"", "  label=\"Focus\"", ">", "  <Variables />", "  <Structure />",
	"</FlowComponent>", ""].join("\n"), "UTF-8");
var definition = [
	"version: 1",
	"config:",
	"  frontbuilder:",
	"    svelte:",
	"      target: svelte5",
	"      resourceRoot: " + String(java.lang.System.getenv("FLOW_FRONTBUILDER_RESOURCE_ROOT") || ""),
	"      modelPath: " + sourceFile,
	"  sql:",
	"    queries:",
	"      booksPage:",
	"        sql: SELECT 1",
	""
].join("\n");
function tree(id, args) {
	args = Object.assign({ project: "target", projectDir: String(targetDir.getAbsolutePath()), engineSource: definition }, args);
	var response = JSON.parse(engine.run(JSON.stringify({ flowSource: mcpFlowSource, includeTrace: false, input: {
		request: JSON.stringify({ jsonrpc: "2.0", id: id, method: "tools/call", params: { name: "authoring-tree", arguments: args } })
	} })));
	var out = response.result && response.result.result && response.result.result.structuredContent;
	assert(out, "authoring-tree answered nothing: " + JSON.stringify(response));
	return out;
}
function paths(node, list) {
	list = list || [];
	(node.children || []).forEach(function (child) { if (child.path) list.push(String(child.path)); paths(child, list); });
	return list;
}
try {
	// A configuration path is on the backend surface: no surface given, it is found there.
	var config = tree(1, { focusPath: "config.sql.queries" });
	assert(!config.error && paths(config).indexOf("config.sql.queries.booksPage") !== -1,
		"config.* focusPath without surface must read the backend tree: " + JSON.stringify(config));
	// The qualified form returned as parentPath is accepted as focusPath.
	var qualified = tree(2, { focusPath: "target::config.sql" });
	assert(!qualified.error && paths(qualified).indexOf("config.sql.queries") !== -1,
		"A qualified Project::path focusPath must be accepted: " + JSON.stringify(qualified));
	// An unknown path says the expected form and proposes the nearest existing paths.
	var missing = tree(3, { surface: "backend", focusPath: "config.sql.query" });
	var text = JSON.stringify(missing);
	assert(missing.error && missing.error.code === "AUTHORING_TREE_FOCUS_NOT_FOUND", "Unknown path is still an error: " + text);
	assert(/Project::/.test(String(missing.error.hint || "")), "The hint gives the qualified form: " + text);
	assert((missing.nearestPaths || [])[0] === "target::config.sql.queries",
		"The nearest existing path is proposed, qualified: " + text);
	print("authoring-tree-focus-hint OK " + JSON.stringify(missing.nearestPaths));
} finally {
	io.deleteDirectory(targetDir);
}
