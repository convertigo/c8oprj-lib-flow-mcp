// authoring-palette takes every path authoring-tree returns (bench of 21/11, L34F and L35F: parentPath
// "Project::frontends", the parentPath of the frontends node of authoring-tree, was refused with AUTHORING_FOCUS_NOT_FOUND,
// the frontend tree of the palette starting at the builder). A path of the configuration or the engine is on the backend
// tree; frontends and the project name read as the node they name, with a note; a qualified focusPath is read as its
// project and path. Any other unknown path keeps the error, with its nearest paths.
var projectDir = arguments.length > 0 ? arguments[0] : ".";
var engineDir = arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow";
var io = Packages.org.apache.commons.io.FileUtils;
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(String(io.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8")));
var mcpFlowSource = String(io.readFileToString(new java.io.File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
var targetDir = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"), "lib_flow_mcp_palette_paths_" + java.lang.System.currentTimeMillis());
targetDir.mkdirs();
function assert(ok, message) { if (!ok) throw new Error(message); }
var sourceFile = "_flow/frontbuilder/svelte/model/Paths/src/routes/+page.flow.svelte";
io.writeStringToFile(new java.io.File(targetDir, sourceFile), ["<script module>", "  export const _flow = { sourceVersion: 2 };",
	"</script>", "", "<FlowComponent", "  $$id=\"paths\"", "  label=\"Paths\"", ">", "  <Variables />", "  <Structure />",
	"</FlowComponent>", ""].join("\n"), "UTF-8");
var definition = [
	"version: 1",
	"config:",
	"  frontbuilder:",
	"    svelte:",
	"      target: svelte5",
	"      resourceRoot: " + String(java.lang.System.getenv("FLOW_FRONTBUILDER_RESOURCE_ROOT") || ""),
	"      modelPath: " + sourceFile,
	"  demo:",
	"    login: false",
	""
].join("\n");
function call(id, name, args) {
	args = Object.assign({ projectDir: String(targetDir.getAbsolutePath()), engineSource: definition }, args);
	var response = JSON.parse(engine.run(JSON.stringify({ flowSource: mcpFlowSource, includeTrace: false, input: {
		request: JSON.stringify({ jsonrpc: "2.0", id: id, method: "tools/call", params: { name: name, arguments: args } })
	} })));
	var out = response.result && response.result.result && response.result.result.structuredContent;
	assert(out, name + " answered nothing: " + JSON.stringify(response).slice(0, 1500));
	return out;
}
function parentPaths(node, depth, list) {
	(node.children || []).forEach(function (child) {
		if (child.parentPath && list.indexOf(child.parentPath) < 0) list.push(String(child.parentPath));
		if (depth < 2) parentPaths(child, depth + 1, list);
	});
	return list;
}
function normalized(out) { return (out.warnings || []).filter(function (warning) { return warning.code === "FOCUS_PATH_NORMALIZED"; })[0]; }
try {
	// every parentPath of the tree, on both surfaces, is a focus of the palette
	var paths = parentPaths(call(1, "authoring-tree", { project: "target", maxDepth: 3 }), 0, []);
	paths = parentPaths(call(2, "authoring-tree", { project: "target", surface: "backend", maxDepth: 3 }), 0, paths);
	["target::frontends", "target::config", "target::configs", "target::frontends.svelte"].forEach(function (path) {
		assert(paths.indexOf(path) >= 0, "authoring-tree returns " + path + ": " + JSON.stringify(paths));
	});
	paths.forEach(function (path, index) {
		var palette = call(10 + index, "authoring-palette", { parentPath: path, limit: 3 });
		assert(!palette.error && palette.ok !== false, "the palette takes " + path + ": " + JSON.stringify(palette).slice(0, 1200));
	});
	// frontends, as the parentPath of the bench or as a focusPath, qualified or not: the builder node, with a note
	[{ parentPath: "target::frontends" }, { project: "target", focusPath: "frontends" }, { focusPath: "target::frontends" }].forEach(function (args, index) {
		var palette = call(40 + index, "authoring-palette", Object.assign({ query: "region", limit: 3 }, args));
		assert(!palette.error && palette.focus && palette.focus.path === "frontends.svelte" && normalized(palette),
			"frontends reads as the builder: " + JSON.stringify(args) + " " + JSON.stringify(palette).slice(0, 1200));
	});
	// any other unknown path keeps the error, with the nearest existing paths
	var missing = call(50, "authoring-palette", { parentPath: "target::frontends.svelte.nowhere", limit: 3 });
	assert(missing.error && missing.error.code === "AUTHORING_FOCUS_NOT_FOUND" && (missing.nearestPaths || []).length,
		"an unknown path is still refused, with nearestPaths: " + JSON.stringify(missing).slice(0, 1200));
	print("authoring-palette-tree-paths OK (" + paths.length + " paths) " + JSON.stringify(missing.nearestPaths));
} finally {
	io.deleteDirectory(targetDir);
}
