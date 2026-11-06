// Natural forms of focusPath read as the node they name, with a note: the project name, "frontends", a page source file
// (light bench of 06/11, it4: 9 runs, 7 models refused with AUTHORING_TREE_FOCUS_NOT_FOUND). Any other unknown path
// keeps the error and its nearest paths.
var projectDir = arguments.length > 0 ? arguments[0] : ".";
var engineDir = arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow";
var io = Packages.org.apache.commons.io.FileUtils;
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(String(io.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8")));
var mcpFlowSource = String(io.readFileToString(new java.io.File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
var targetDir = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"), "lib_flow_mcp_focus_forms_" + java.lang.System.currentTimeMillis());
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
function note(out) {
	return (out.warnings || []).filter(function (warning) { return warning.code === "FOCUS_PATH_NORMALIZED"; })[0];
}
function focused(out) { return String(out.focus && out.focus.path || out.focusPath || ""); }
try {
	// "frontends" (5 runs): the frontend root.
	var frontends = tree(1, { surface: "frontend", focusPath: "frontends" });
	assert(!frontends.error && /^frontends(?:\.svelte)?$/.test(focused(frontends)) && note(frontends),
		"focusPath frontends reads as the frontend root, with a note: " + JSON.stringify(frontends).slice(0, 1500));
	// A page source file (glm-5-3, as rootPath): the node of that page.
	var page = tree(2, { surface: "frontend", builder: "svelte", rootPath: sourceFile });
	assert(!page.error && /page_src_routes_page_flow_svelte$/.test(focused(page)) && note(page) &&
		note(page).message.indexOf(sourceFile) !== -1,
		"a page source path reads as its page node, with a note: " + JSON.stringify(page).slice(0, 1500));
	var relative = tree(3, { surface: "frontend", focusPath: "src/routes/+page.svelte" });
	assert(!relative.error && /page_src_routes_page_flow_svelte$/.test(focused(relative)),
		"the generated source name reads as the same page: " + JSON.stringify(relative).slice(0, 1500));
	// The project name: the root of the tree.
	var root = tree(4, { surface: "frontend", focusPath: "target" });
	assert(!root.error && note(root) && (root.children || []).length > 0, "the project name reads as the root: " + JSON.stringify(root).slice(0, 1500));
	// Any other unknown path keeps the error with its nearest paths.
	var missing = tree(5, { surface: "frontend", focusPath: "frontends.svelte.model" });
	assert(missing.error && missing.error.code === "AUTHORING_TREE_FOCUS_NOT_FOUND" && (missing.nearestPaths || []).length,
		"an unknown path is still refused with nearestPaths: " + JSON.stringify(missing).slice(0, 1500));
	print("authoring-tree-focus-forms-1106 OK " + [focused(frontends), focused(page), focused(relative)].join(" "));
} finally {
	io.deleteDirectory(targetDir);
}
