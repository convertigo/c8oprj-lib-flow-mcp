// flow-block-get LinkButton answered UNKNOWN_BLOCK with the backend blocks nearest by text (crypto.hmac) and an
// authoring-palette call without parentPath, which lists no item: the backend tool does not know the Svelte widgets.
// A name the Svelte catalog of the project knows is answered in one line with the widget and the frontend call that
// reads its contract; any other name keeps its answer.
var projectDir = arguments.length > 0 ? arguments[0] : ".";
var engineDir = arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow";
var io = Packages.org.apache.commons.io.FileUtils;
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(String(io.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8")));
var mcpFlowSource = String(io.readFileToString(new java.io.File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
var targetDir = java.nio.file.Files.createTempDirectory("lib_flow_mcp_block_get_widget_").toFile();
var checks = 0;
function assert(ok, message) { checks++; if (!ok) throw new Error(message); }
var sourceFile = "_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte";
io.writeStringToFile(new java.io.File(targetDir, sourceFile), '<script module>\n  export const _flow = { sourceVersion: 2 };\n</script>\n' +
	'<FlowComponent $$id="home" label="Home">\n  <Structure />\n</FlowComponent>\n', "UTF-8");
var definition = ["version: 1", "config:", "  frontbuilder:", "    svelte:", "      target: svelte5",
	"      resourceRoot: " + String(java.lang.System.getenv("FLOW_FRONTBUILDER_RESOURCE_ROOT") || ""), "      modelPath: " + sourceFile, ""].join("\n");
var base = { project: "App", projectDir: String(targetDir.getAbsolutePath()), engineSource: definition };
function call(name, args) {
	var response = JSON.parse(engine.run(JSON.stringify({ flowSource: mcpFlowSource, includeTrace: false, input: {
		request: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }) } })));
	var out = response.result && response.result.result && response.result.result.structuredContent;
	assert(out, name + " answered nothing: " + JSON.stringify(response).substring(0, 600));
	return out;
}
try {
	// E6 (L27F of 13/11): the backend tool answers the contract of the widget itself, not an error the agent answered by
	// asking for each widget in turn.
	var widget = call("flow-block-get", Object.assign({ name: "LinkButton" }, base));
	assert(widget.ok === true && widget.kind === "frontendWidget" && widget.frontendWidget && widget.frontendWidget.id === "svelte.linkButton",
		"LinkButton answers its widget contract: " + JSON.stringify(widget).substring(0, 600));
	assert(widget.frontendWidget.properties.page && widget.frontendWidget.properties.page.type && widget.frontendWidget.properties.label,
		"the properties carry their type: " + JSON.stringify(widget.frontendWidget.properties).substring(0, 600));
	assert(/not a backend Flow block/.test(widget.next) && /contractBlocks/.test(widget.next) && widget.next.indexOf("crypto.hmac") < 0,
		"the next step writes it in a page source: " + widget.next);
	// The named snippets are slots, with the values they receive (EntityTable Cell2 and Toolbar were missing).
	var table = call("flow-block-get", Object.assign({ name: "DataTable" }, base)).frontendWidget;
	assert(table && table.slots.indexOf("Cell2") >= 0 && table.slots.indexOf("Actions") >= 0 && table.snippets.Cell2.join() === "row,column,value",
		"DataTable lists its snippets as slots: " + JSON.stringify(table && { slots: table.slots, snippets: table.snippets }));
	var got = call("code-get", Object.assign({ sourceFile: sourceFile, contractBlocks: ["DataTable"] }, base));

	// The call the hint gives, with the Structure parentPath of the page, returns the contract of the widget.
	var tree = call("authoring-tree", Object.assign({ maxDepth: 6 }, base));
	var structure = "";
	(function find(node) {
		(node.children || []).forEach(function (child) { if (!structure && child.kind === "frontendStructure") structure = child.parentPath; find(child); });
	})(tree);
	assert(structure, "the page has a Structure: " + JSON.stringify(tree).substring(0, 600));
	var palette = call("authoring-palette", Object.assign({ parentPath: structure, query: "LinkButton" }, base));
	assert(palette.ok === true && palette.items.some(function (item) { return item.id === "svelte.linkButton" && item.properties && item.properties.length; }),
		"authoring-palette returns the contract of LinkButton: " + JSON.stringify(palette).substring(0, 600));

	// A name the catalog does not know keeps its answer; so does a call without project.
	var unknown = call("flow-block-get", Object.assign({ name: "Gizmo" }, base)).error;
	assert(unknown.code === "UNKNOWN_BLOCK" && !unknown.details.frontendWidget && /Gizmo is not a backend Flow block/.test(unknown.hint),
		"an unknown capitalized name keeps the general answer: " + JSON.stringify(unknown).substring(0, 400));
	var noProject = call("flow-block-get", { name: "LinkButton" }).error;
	assert(noProject.code === "UNKNOWN_BLOCK" && !noProject.details.frontendWidget && /authoring-palette/.test(noProject.hint),
		"without project the general answer stays: " + JSON.stringify(noProject).substring(0, 400));
	var backend = call("flow-block-get", Object.assign({ name: "sql.execute" }, base)).error;
	assert(/^sql\.execute is not a block: sql\.query/.test(backend.hint) && !backend.details.frontendWidget, "backend guesses are unchanged: " + backend.hint);
	print("block-get-frontend-widget OK (" + checks + " checks)");
} finally {
	io.deleteQuietly(targetDir);
}
