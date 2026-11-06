// Block names guessed in the light bench of 06/11 (it3, it4: flow-block-get and code-set refused with UNKNOWN_BLOCK) get
// what they meant first in the hint: the real block (sql.execute -> sql.query, sql.mutate), the expression function
// (round), json.push for a JavaScript .push, and a Svelte component or action (Heading, Text, Table, SetValue,
// CallSequence) read with authoring-palette rather than flow-block-get. No name is substituted.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/guessed-block-names-1106.js <lib_flow_mcp dir> <engine dir>
var root = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow");
var FU = Packages.org.apache.commons.io.FileUtils;
function read(path) { return String(FU.readFileToString(new java.io.File(path), "UTF-8")); }
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var mcp = eval(read(root + "/_flow/lib/mcp.js"));
var temp = java.nio.file.Files.createTempDirectory("mcp-guessed-blocks-").toFile();
try {
	var __flowEngineDir = engineDir, __flowProjectDir = String(temp), engine = eval(read(engineDir + "/Engine.js"));
	function request(name, args) { return { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }; }
	function blockGet(name) {
		var raw = JSON.parse(engine.blockGet(JSON.stringify({ name: name })));
		assert(!raw.ok && raw.error.code === "UNKNOWN_BLOCK", "the unknown name stays refused: " + name);
		var error = mcp.toolError(request("flow-block-get", { project: "App", name: name }), raw.error).result.structuredContent.error;
		var twice = mcp.toolError(request("flow-block-get", { project: "App", name: name }), error).result.structuredContent.error;
		assert(twice.hint === error.hint, "the enrichment is idempotent for " + name + ": " + twice.hint);
		return error;
	}
	function first(error, pattern, label) {
		assert(pattern.test(String(error.hint || "")), label + " answers what was meant first: " + error.hint);
	}
	// Backend (FlowScript) guesses.
	var execute = blockGet("sql.execute");
	first(execute, /^sql\.execute is not a block: sql\.query runs a SELECT, sql\.mutate an INSERT, UPDATE or DELETE\./, "sql.execute");
	assert(execute.details.contract === "flow-block-get({ project: \"App\", name: \"sql.query\" })", "sql.execute points to the contract of sql.query: " + JSON.stringify(execute.details));
	first(blockGet("sql.connection"), /^sql\.connection is not a block: the connection is config\.sql/, "sql.connection");
	first(blockGet("http.response"), /^http\.response is not a block: .*throw \{ code, message, status \}/, "http.response");
	first(blockGet("round"), /^round is not a block but an expression function: write round\(value, digits\)/, "round");
	first(blockGet("local.items.push"), /^local\.items\.push is a JavaScript method, not a block: append with json\.push\(\{ path: "local\.items", value \}\)/, "local.items.push");
	// Frontend guesses: a Svelte component or action, read with authoring-palette.
	["Heading", "Text", "Table"].forEach(function (name) {
		var error = blockGet(name);
		first(error, new RegExp("^" + name + " is not a backend Flow block: in a Svelte page, " + name +
			" is a component or action; read it with authoring-palette\\(\\{ project: \"App\", query: \"" + name + "\" \\}\\)"), name);
		assert(!error.details.contract, name + " does not point to the contract of an unrelated backend block: " + JSON.stringify(error.details));
	});
	var set = blockGet("Set");
	first(set, /^Block names are lowercase: set is the FlowScript block\. Set is not a backend Flow block: in a Svelte page, SetValue/, "Set");
	assert(set.details.contract === "flow-block-get({ project: \"App\", name: \"set\" })", "Set points to the contract of set: " + JSON.stringify(set.details));
	first(blockGet("frontbuilder.svelte.callSequence"), /^frontbuilder\.svelte\.callSequence is not a backend Flow block: in a Svelte page, CallSequence .*query: "CallSequence"/, "frontbuilder.svelte.callSequence");
	// The same answer in a code-set diagnostic.
	var failed = mcp.toolResponse(request("code-set", { project: "App", qname: "App.books_add" }), { ok: false, error: {
		code: "FLOWSCRIPT_VALIDATION_FAILED", message: "FlowScript validation failed.", details: [
			{ severity: "error", code: "UNKNOWN_BLOCK", line: 9, message: "Unknown Flow block: sql.execute",
				candidates: [{ block: "sql.check", score: 3 }], candidateDecision: { recommendation: "existing", bestBlock: "sql.check" } }
		] } }, {}).result.structuredContent;
	var diagnostic = failed.error.diagnostics[0];
	assert(/^sql\.execute is not a block: sql\.query/.test(diagnostic.next) && diagnostic.contract === "flow-block-get({ project: \"App\", name: \"sql.query\" })",
		"a code-set diagnostic answers the same: " + JSON.stringify(diagnostic));
	// Any other unknown name keeps the closest contracts.
	var other = blockGet("list.slice");
	assert(/^The contract of list\.take/.test(other.hint) || /list\.take/.test(other.hint), "other names keep the closest contracts: " + other.hint);
	print("guessed-block-names-1106 OK " + checks + " checks");
} finally {
	FU.deleteDirectory(temp);
}
