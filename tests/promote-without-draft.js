// code-promote without a working copy: five agents promoted a Flow whose draft a project-save had written to disk
// (a Flow file never declared) or that was already promoted, and read FLOW_CODE_DRAFT_MISSING. The saved source is
// promoted as is; a Flow never written still refuses, and the refusal gives the code-set call to make first.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/promote-without-draft.js <lib_flow_mcp dir> [<engine _flow dir>]
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
var target = java.nio.file.Files.createTempDirectory("flow-promote-without-draft-").toFile().getCanonicalFile();
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
function flow(name) {
	return 'const _flow = {\n  sourceVersion: 2,\n  inputs: { code: { type: "string", default: "T-1" } }\n}\n\n' +
		'function ' + name + '({ input, config, result }) {\n  result.code = input.code\n}\n';
}
try {
	var set = tool(2, "code-set", { name: "Tickets", code: flow("Tickets") });
	assert(set.value.ok === true && set.value.revision, "code-set wrote a working copy: " + JSON.stringify(set.value));
	var first = tool(3, "code-promote", { name: "Tickets", revision: set.value.revision });
	assert(first.value.ok === true && first.value.promoted === true, "the working copy is promoted: " + JSON.stringify(first.value));
	var file = new java.io.File(target, "_flow/flows/Tickets.flow.js");
	assert(file.isFile(), "the promoted Flow is a file of _flow/flows");

	// Promoted again, without a working copy: nothing to promote, a success that says so.
	var again = tool(4, "code-promote", { name: "Tickets" });
	assert(again.value.ok === true && !again.isError && /already saved|no working copy/i.test(String(again.value.note || "")),
		"a second promotion succeeds with a note: " + JSON.stringify(again.value));

	// A Flow file on disk that no promotion declared (a project-save wrote the draft): promoted from its saved source.
	FileUtils.writeStringToFile(new java.io.File(target, "_flow/flows/Orders.flow.js"), flow("Orders"), "UTF-8");
	var saved = tool(5, "code-promote", { name: "Orders" });
	assert(saved.value.ok === true && saved.value.promoted === true && /saved source/i.test(String(saved.value.note || "")),
		"a saved Flow file without working copy is promoted: " + JSON.stringify(saved.value));

	// A Flow never written: the refusal stays, and gives the code-set call to make first.
	var ghost = tool(6, "code-promote", { name: "Ghost" });
	assert(ghost.isError && ghost.value.error && ghost.value.error.code === "FLOW_CODE_DRAFT_MISSING", "a Flow never written is refused: " + JSON.stringify(ghost.value));
	assert(/code-set\(\{[^)]*name:"Ghost"/.test(ghost.value.error.hint + " " + ghost.text) && ghost.value.unsaved !== true && ghost.value.workingCopy !== true,
		"the refusal gives the exact code-set call and announces no working copy: " + JSON.stringify(ghost.value) + " " + ghost.text);

	print("promote-without-draft OK (" + count + " checks)");
} finally {
	FileUtils.deleteDirectory(target);
}
