// code-patch refused edits: [{ oldText, newText }] (INVALID_PATCH) and its schema described no format. tools/list
// now describes both formats, the unified diff and the exact replacements, and a refused edit names its lines.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/code-patch-edits-tool.js <lib_flow_mcp dir> [<engine _flow dir>]
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
var target = java.nio.file.Files.createTempDirectory("flow-code-patch-edits-tool-").toFile().getCanonicalFile();
var targetDir = String(target.getAbsolutePath());
var __flowEngineDir = engineDir;
var __flowProjectDir = projectDir;
var engine = eval(read(engineDir, "Engine.js"));
var router = read(projectDir, "_flow/flows/McpServer.flow.js");
function call(id, method, params) {
	var execution = JSON.parse(engine.run(JSON.stringify({ flowSource: router, includeTrace: false,
		input: { request: JSON.stringify({ jsonrpc: "2.0", id: id, method: method, params: params }) } })));
	assert(execution.ok === true && execution.result && execution.result.result, method + " ran: " + JSON.stringify(execution).substring(0, 400));
	return execution.result.result;
}
function tool(id, name, args) {
	args.projectDir = targetDir;
	var result = call(id, "tools/call", { name: name, arguments: args });
	return { text: String(result.content && result.content[0] && result.content[0].text || ""), value: result.structuredContent, isError: result.isError === true };
}
function flow(body) {
	return 'const _flow = {\n  sourceVersion: 2,\n  inputs: { code: { type: "string", default: "T-1" } }\n}\n\n' +
		'function Tickets({ input, config, result }) {\n' + body + '\n}\n';
}
try {
	var tools = call(1, "tools/list", {}).tools;
	var patchTool = tools.filter(function (t) { return t.name === "code-patch"; })[0];
	var props = patchTool.inputSchema.properties;
	assert(props.edits && props.edits.type === "array" && /Format 2, exact replacements/.test(props.edits.description) &&
		props.edits.items && props.edits.items.properties.oldText && props.edits.items.properties.newText,
		"tools/list describes edits: " + JSON.stringify(props.edits));
	assert(/Format 1, a unified diff/.test(props.codepatch.description) && /edits \(\[\{ oldText, newText \}\]/.test(patchTool.description),
		"and the unified diff, both in the tool description: " + JSON.stringify(props.codepatch) + " " + patchTool.description);

	// code-patch with edits, and its refusals in the text.
	var saved = tool(2, "code-set", { name: "Tickets", code: flow('  local.prefix = "T-"\n  result.valid = String(input.code).startsWith(local.prefix)\n  result.prefix = local.prefix') });
	assert(saved.value.ok === true, "code-set: " + saved.text);
	var patched = tool(3, "code-patch", { name: "Tickets", revision: saved.value.revision, edits: [{ oldText: 'local.prefix = "T-"', newText: 'local.prefix = "TK-"' }] });
	assert(patched.value.ok === true && patched.value.revision !== saved.value.revision, "code-patch takes edits: " + patched.text + " " + JSON.stringify(patched.value));
	var twice = tool(4, "code-patch", { name: "Tickets", revision: patched.value.revision, edits: [{ oldText: "local.prefix", newText: "local.start" }] });
	assert(twice.value.error && twice.value.error.code === "EDIT_TEXT_NOT_UNIQUE" && twice.text.indexOf("found 3 times, at lines 7, 8, 9") !== -1 &&
		twice.text.indexOf("Fix: Extend oldText") !== -1, "An ambiguous edit is refused with its lines: " + twice.text);

	print("code-patch-edits-tool OK (" + count + " checks)");
} finally {
	FileUtils.deleteDirectory(target);
}
