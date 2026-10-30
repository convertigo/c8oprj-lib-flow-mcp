// flow-resource-patch with fromFile: a file of the Convertigo workspace copied into a project resource byte for byte,
// through McpServer and the resource service of lib_flow_engine (headless). An agent no longer sends a document back
// as content, whose lines are then normalized.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/resource-import-tool.js <lib_flow_mcp dir> [<engine _flow dir>]
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var Files = java.nio.file.Files;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
function bytesOf(text) { return new java.lang.String(text).getBytes(java.nio.charset.StandardCharsets.UTF_8); }

var workspace = Files.createTempDirectory("flow-resource-import-tool-").toFile().getCanonicalFile();
var target = new java.io.File(workspace, "projects/Orders");
target.mkdirs();
var __flowEngineDir = engineDir;
var __flowProjectDir = projectDir;
var __flowWorkspaceDir = String(workspace.getAbsolutePath());
var engine = eval(read(engineDir, "Engine.js"));
var mcpFlowSource = read(projectDir, "_flow/flows/McpServer.flow.js");
function call(id, method, params) {
	var execution = JSON.parse(engine.run(JSON.stringify({ flowSource: mcpFlowSource, includeTrace: false,
		input: { request: JSON.stringify({ jsonrpc: "2.0", id: id, method: method, params: params }) } })));
	assert(execution.ok === true && execution.result && execution.result.result, method + " ran: " + JSON.stringify(execution).substring(0, 400));
	return execution.result.result;
}
function tool(id, args) { return call(id, "tools/call", { name: "flow-resource-patch", arguments: args }).structuredContent; }
var targetDir = String(target.getAbsolutePath());
try {
	var schema = call(1, "tools/list", {}).tools.filter(function (t) { return t.name === "flow-resource-patch"; })[0];
	assert(schema && schema.inputSchema.properties.fromFile && /byte for byte/.test(schema.inputSchema.properties.fromFile.description),
		"tools/list advertises fromFile: " + JSON.stringify(schema && schema.inputSchema.properties.fromFile));

	var guide = "# Delivery guide\r\n\r\nDélai : 3 jours.\r\nNo final new line";
	Files.write(new java.io.File(workspace, "delivery-guide.md").toPath(), bytesOf(guide));
	var imported = tool(2, { projectDir: targetDir, path: "docs/delivery-guide.md", fromFile: "delivery-guide.md" });
	assert(imported.ok === true && imported.mode === "fromFile" && imported.created === true && imported.hash === imported.newHash,
		"fromFile imports the document: " + JSON.stringify(imported));
	assert(java.util.Arrays.equals(Files.readAllBytes(new java.io.File(target, "docs/delivery-guide.md").toPath()), bytesOf(guide)),
		"The resource holds the bytes of the file, CRLF and missing final new line kept");
	var got = call(3, "tools/call", { name: "flow-resource-get", arguments: { projectDir: targetDir, path: "docs/delivery-guide.md" } }).structuredContent;
	assert(got.hash === imported.hash, "The returned hash is the next baseHash");

	var replace = tool(4, { projectDir: targetDir, path: "docs/delivery-guide.md", fromFile: "delivery-guide.md" });
	assert(replace.error && replace.error.code === "RESOURCE_BASE_HASH_REQUIRED", "An existing resource is not overwritten without its hash: " + JSON.stringify(replace));
	var both = tool(5, { projectDir: targetDir, path: "docs/other.md", fromFile: "delivery-guide.md", content: "# Other\n" });
	assert(both.error && both.error.code === "INVALID_ARGUMENTS", "fromFile with content is refused: " + JSON.stringify(both));
	FileUtils.writeStringToFile(new java.io.File(workspace, "jwt/mcp/tokens.json"), "{}", "UTF-8");
	var private_ = tool(6, { projectDir: targetDir, path: "docs/tokens.md", fromFile: "jwt/mcp/tokens.json" });
	assert(private_.error && private_.error.code === "RESOURCE_IMPORT_SOURCE_PRIVATE" && !new java.io.File(target, "docs/tokens.md").exists(),
		"A private folder of the workspace is never imported: " + JSON.stringify(private_));
	var escape = tool(7, { projectDir: targetDir, path: "docs/escape.md", fromFile: "../../etc/hosts" });
	assert(escape.error && /RESOURCE_IMPORT_SOURCE_(OUTSIDE_WORKSPACE|MISSING)/.test(escape.error.code), "A path out of the workspace is refused: " + JSON.stringify(escape));
} finally {
	FileUtils.deleteQuietly(workspace);
}
print("resource-import-tool OK (" + count + " checks)");
