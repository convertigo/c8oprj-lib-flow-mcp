// A slot written with one dollar ($nodes: function () {...}) was refused by code-set, with a proposal to write $$nodes:
// four refusals in a run, for a correction that has no other reading. code-set and code-patch now write the engine's
// slot proposal once on the refused working copy, with a warning per correction. Any other proposal stays a proposal.
// Run with Rhino: tests/slot-sigil-write-1109.js <lib_flow_mcp dir> <engine _flow dir>
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : java.lang.System.getenv("ENG") || "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
var target = java.nio.file.Files.createTempDirectory("flow-slot-sigil-write-").toFile().getCanonicalFile();
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
function flow(name, body) {
	return ["const _flow = {", "  sourceVersion: 2,", "}", "", "function " + name + "({ input, result }) {"].concat(body, ["}"]).join("\n");
}
try {
	var counting = flow("Counter", [
		"  result.count = 0",
		"  forEach({",
		"    items: [\"a\", \"b\", \"c\"],",
		"    $nodes: function () {",
		"      result.count = result.count + 1",
		"    }",
		"  })"
	]);
	var written = tool(1, "code-set", { name: "Counter", code: counting });
	assert(!written.isError && written.value.ok === true, "code-set writes the slot with two dollars: " + written.text + " " + JSON.stringify(written.value).substring(0, 1200));
	assert(written.value.code === counting.split("    $nodes:").join("    $$nodes:"), "the written source says $$nodes: " + written.value.code);
	assert(written.value.fixes.length === 1 && written.value.fixes[0].code === "FLOWSCRIPT_SLOT_SIGIL_CORRECTED" &&
		written.value.fixes[0].before === "$nodes" && written.value.fixes[0].after === "$$nodes" && written.value.fixes[0].line === 9,
		"the correction is listed with its line: " + JSON.stringify(written.value.fixes));
	assert(/warnings=1: \$nodes written \$\$nodes at line 9: slots and engine attributes take two dollars/.test(written.text),
		"the text says the correction: " + written.text);
	var source = tool(2, "code-get", { name: "Counter" });
	assert(source.value.code.indexOf("$$nodes: function") !== -1 && source.value.code.indexOf(" $nodes:") === -1, "code-get returns the corrected source");
	var ran = tool(3, "code-run", { name: "Counter" });
	assert(ran.value.ok === true && ran.value.result.count === 3, "the slot runs: " + JSON.stringify(ran.value).substring(0, 600));

	// The same through code-patch: the patched text keeps its one dollar until the proposal is written.
	var patched = tool(4, "code-patch", { name: "Counter", revision: source.value.revision,
		edits: [{ oldText: "    $$nodes: function () {", newText: "    $nodes: function () {" }] });
	assert(!patched.isError && patched.value.ok === true && patched.value.fixes && patched.value.fixes[0].after === "$$nodes",
		"code-patch writes the slot proposal too: " + patched.text);
	assert(tool(5, "code-get", { name: "Counter" }).value.code.indexOf(" $nodes:") === -1, "the patched source says $$nodes");

	// A plain key may be a business property: no correction is written for it.
	var plain = tool(6, "code-set", { name: "Plain", code: flow("Plain", ["  forEach({ items: [1], nodes: function () { result.x = 1 } })"]) });
	assert(plain.isError && plain.value.ok === false && !plain.value.fixes, "a plain slot key stays refused: " + plain.text);
	print("slot-sigil-write-1109 OK (" + count + " checks)");
} finally {
	FileUtils.deleteDirectory(target);
}
