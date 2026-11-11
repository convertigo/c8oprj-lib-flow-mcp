// The contract of a block comes from flow-block-get, never from library sources: in the trial, an agent ran 255 shell
// commands, many of them grep/sed in the library folders, and called flow-block-get twice. code-check/code-set
// diagnostics on a block call name the flow-block-get call (contract), flow-block-get keeps the longDescription of the
// block (its errors, examples and guide), and a property named password or token in a block contract is shown as the
// descriptor it is (email.send password), its literal sample values still hidden.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/block-contract-pointers.js <engine _flow dir> <lib_flow_mcp dir>
var engineDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : "../lib_flow_engine/_flow").getCanonicalPath());
var projectDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : ".").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }

var mcp = eval(read(projectDir, "_flow/lib/mcp.js"));
function request(name, args) { return { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: name, arguments: args || {} } }; }

// 1. Diagnostics on a block call name the call that reads its contract.
var failed = mcp.toolResponse(request("code-set", { project: "App", qname: "App.Book" }), {
	ok: false,
	error: { code: "FLOWSCRIPT_VALIDATION_FAILED", message: "FlowScript validation failed.", details: [
		{ severity: "error", code: "UNKNOWN_BLOCK_PROPERTY", line: 4, block: "sql.write", property: "params", message: "Unknown property params for Flow block sql.write.",
			next: "Use only expected properties, or create/patch a project block if this property is part of a new contract.", expected: ["onError", "parameters", "statement"] },
		{ severity: "error", code: "UNKNOWN_BLOCK", line: 9, message: "Unknown Flow block: rows.unique",
			candidates: [{ block: "rows.distinct", score: 4 }], candidateDecision: { recommendation: "existing", bestBlock: "rows.distinct" } },
		{ severity: "error", code: "INVALID_EXPRESSION", line: 12, message: "Unknown expression identifier: typeof" }
	] }
}, {}).result.structuredContent;
var diagnostics = failed.error.diagnostics;
assert(diagnostics[0].contract === "flow-block-get({ project: \"App\", name: \"sql.write\" })", "an unknown property names the contract call: " + JSON.stringify(diagnostics[0]));
assert(/^Use only expected properties.*The contract of sql\.write \(properties, outputs, errors, examples\): flow-block-get\(\{ project: "App", name: "sql\.write" \}\); never read library sources for it\.$/.test(diagnostics[0].next),
	"next keeps the engine advice and adds the contract call: " + diagnostics[0].next);
assert(diagnostics[1].contract === "flow-block-get({ project: \"App\", name: \"rows.distinct\" })", "an unknown block names the contract of its best candidate: " + JSON.stringify(diagnostics[1]));
assert(diagnostics[2].contract === undefined && diagnostics[2].next === undefined, "an expression error names no block contract");
var warned = mcp.toolResponse(request("code-check", { project: "App" }), { ok: true, revision: "r1", warnings: [
	{ severity: "warning", code: "FLOWSCRIPT_PROPERTY_TYPE_MISMATCH", line: 3, block: "data.read", property: "limit", message: "data.read.limit declares number but local.limit is string." }
] }, {}).result.structuredContent;
assert(warned.warnings[0].contract === "flow-block-get({ project: \"App\", name: \"data.read\" })", "a type mismatch warning names the contract call: " + JSON.stringify(warned.warnings[0]));

// 2. A password or token property of a block contract is a descriptor, not a secret.
var contract = mcp.toolResponse(request("flow-block-get", { project: "App", name: "email.send" }), { ok: true, detail: "compact", name: "email.send", block: {
	blockId: "email.send",
	properties: {
		password: { label: "SMTP password", kind: "template", type: "string", "default": "${config.email.smtp.password}", description: "Password of the account." },
		token: { label: "API token", kind: "template", type: "string", "default": "literal-fixture-token", description: "Token of the account." },
		to: { label: "To", kind: "template", type: "string" }
	}
}, password: "fixture-password", settings: { password: { type: "string", value: "fixture-password" } }, properties: { token: "fixture-token" } }, {}).result.structuredContent;
var properties = contract.block.properties;
assert(properties.password.label === "SMTP password" && properties.password.type === "string" && properties.password["default"] === "${config.email.smtp.password}" &&
	properties.password.description === "Password of the account.", "the password descriptor is shown with its symbol default: " + JSON.stringify(properties.password));
assert(properties.token.label === "API token" && properties.token["default"] === "[redacted]", "a literal default stays hidden: " + JSON.stringify(properties.token));
assert(contract.password === "[redacted]" && contract.settings.password === "[redacted]" && contract.properties.token === "[redacted]",
	"runtime secrets stay redacted, also an object outside a properties map: " + JSON.stringify(contract));
assert(JSON.stringify(contract).indexOf("fixture-") === -1 && contract.content === undefined, "no fixture secret leaks");

// 3. The tool descriptions send to flow-block-get.
var __flowEngineDir = engineDir;
var __flowProjectDir = projectDir;
var engine = eval(read(engineDir, "Engine.js"));
var mcpFlowSource = read(projectDir, "_flow/flows/McpServer.flow.js");
function call(id, method, params) {
	var execution = JSON.parse(engine.run(JSON.stringify({ flowSource: mcpFlowSource, includeTrace: false,
		input: { request: JSON.stringify({ jsonrpc: "2.0", id: id, method: method, params: params }) } })));
	assert(execution.ok === true && execution.result, method + " ran: " + JSON.stringify(execution).substring(0, 400));
	return execution.result;
}
var tools = {};
call(1, "tools/list", {}).result.tools.forEach(function (tool) { tools[tool.name] = tool; });
assert(/The contract of one block/.test(tools["flow-block-get"].description) && /never read library sources/.test(tools["flow-block-get"].description),
	"flow-block-get says it is the contract of a block: " + tools["flow-block-get"].description);
["code-set", "code-check", "flow-catalog"].forEach(function (name) {
	assert(/flow-block-get/.test(tools[name].description), name + " points to flow-block-get: " + tools[name].description);
});

// 4. End to end on lib_flow_engine blocks: the longDescription and the password descriptor reach the agent, and a
// FlowScript draft with a wrong property gets the contract call.
var target = java.nio.file.Files.createTempDirectory("flow-block-contract-").toFile();
try {
	new java.io.File(target, "_flow").mkdirs();
	FileUtils.writeStringToFile(new java.io.File(target, "_flow/engine.yaml"), "version: 1\nengineQName: lib_flow_engine.Engine\nbindings: {}\nconfig: {}\n", "UTF-8");
	var targetDir = String(target.getAbsolutePath());
	function tool(id, name, args) {
		var answer = call(id, "tools/call", { name: name, arguments: args });
		assert(answer.result && answer.result.structuredContent, name + " answered: " + JSON.stringify(answer).substring(0, 400));
		return answer.result.structuredContent;
	}
	var dateAdd = tool(2, "flow-block-get", { projectDir: targetDir, name: "date.add" });
	assert(dateAdd.ok === true && /2024-03-10/.test(dateAdd.block.longDescription) && dateAdd.block.properties.months,
		"date.add keeps its longDescription with its example: " + JSON.stringify(dateAdd.block).substring(0, 400));
	var email = tool(3, "flow-block-get", { projectDir: targetDir, name: "email.send" });
	assert(email.block.properties.password && email.block.properties.password.type === "string" &&
		email.block.properties.password["default"] === "${config.email.smtp.password}", "email.send shows its password property: " + JSON.stringify(email.block.properties.password));
	var code = [
		"const _flow = {",
		"  \"sourceVersion\": 2,",
		"}",
		"",
		"function Probe({ input, config, result }) {",
		"  local.next = date.add({",
		"    $$id: \"next\",",
		"    value: \"2025-01-31\",",
		"    month: 1,",
		"  })",
		"}",
		""
	].join("\n");
	var set = tool(4, "code-set", { projectDir: targetDir, name: "Probe", code: code });
	var unknown = (set.error && set.error.diagnostics || []).filter(function (diagnostic) { return diagnostic.code === "UNKNOWN_BLOCK_PROPERTY"; })[0];
	assert(unknown && unknown.block === "date.add" && unknown.contract === "flow-block-get({ name: \"date.add\" })" && /never read library sources/.test(unknown.next),
		"code-set names the contract call of date.add: " + JSON.stringify(set).substring(0, 600));
} finally {
	FileUtils.deleteQuietly(target);
}
print("block-contract-pointers OK (" + count + " checks)");
