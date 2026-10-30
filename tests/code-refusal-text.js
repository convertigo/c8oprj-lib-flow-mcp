// What a client showing only the text of a tool result reads of a refusal: code-set answered "Error
// [FLOWSCRIPT_VALIDATION_FAILED]: FlowScript validation failed. See structuredContent.error." and an agent never saw the
// line, the construction or the fix the diagnostics held. The text now lists them, and a diagnostic keeps its expression.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/code-refusal-text.js <lib_flow_mcp dir> [<engine _flow dir>]
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
var target = java.nio.file.Files.createTempDirectory("flow-code-refusal-text-").toFile().getCanonicalFile();
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
	// A refusal reads in the text alone: the line of the file, the code, the construction and the fix.
	var regex = tool(2, "code-set", { name: "Tickets", code: flow('  local.code = String(input.code)\n  result.valid = /^T-[0-9]+$/.test(local.code)') });
	assert(regex.value.error && regex.text.indexOf("line 8") !== -1 && regex.text.indexOf("FLOWSCRIPT_EXPRESSION_UNSUPPORTED") !== -1 &&
		regex.text.indexOf("Fix: Test the text with the text.match block") !== -1, "The text names the refusal: " + regex.text);
	var diagnostic = regex.value.error.diagnostics[0];
	assert(diagnostic.line === 8 && diagnostic.expression && diagnostic.expression.indexOf("/^T-[0-9]+$/") !== -1, "The diagnostic keeps its construction: " + JSON.stringify(diagnostic));
	var block = tool(3, "code-set", { block: "tickets.check", code: 'const _meta = {\n  "sourceVersion": 2,\n  "properties": { "code": { "kind": "value", "type": "string" } },\n' +
		'  "outputs": { "out": { "type": "object" } }\n}\n\nfunction tickets_check({ input, config }) {\n  return { valid: /^T-/.test(input.code) }\n}\n' });
	assert(block.value.error && block.text.indexOf("line 8") !== -1 && block.text.indexOf("FLOWSCRIPT_EXPRESSION_UNSUPPORTED") !== -1,
		"A block refusal names the line of its file: " + block.text);

	print("code-refusal-text OK (" + count + " checks)");
} finally {
	FileUtils.deleteDirectory(target);
}
