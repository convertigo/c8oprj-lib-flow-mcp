// An agent writing FlowScript as JavaScript (Math.pow, Object.assign, JSON.stringify, parseInt, console.log, a guessed
// block name, positional arguments) got one refusal per call and spent turns on flow-block-get and the palette.
// code-set now answers one global patch (proposedPatch.edits, ready for code-patch), and autoCorrect: true applies the
// edits at or above the threshold: through tools/call, in structuredContent and in the text.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/code-intuitive-calls.js <lib_flow_mcp dir> [<engine _flow dir>]
// (the engine directory defaults to $ENG, then ../lib_flow_engine/_flow)
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : java.lang.System.getenv("ENG") || "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
var target = java.nio.file.Files.createTempDirectory("flow-code-intuitive-calls-").toFile().getCanonicalFile();
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
var intuitive = [
	'function Report({ input, result }) {',
	'  local.largest = Math.max(input.a, input.b)',
	'  local.squared = Math.pow(input.a, 2)',
	'  local.merged = Object.assign({}, input.defaults, input.options)',
	'  local.keys = Object.keys(local.merged)',
	'  local.payload = JSON.stringify(local.merged)',
	'  local.digest = crypto.md5(local.payload)',
	'  local.label = text.trimm(input.label)',
	'  local.sorted = list.sort(input.rows, current.name)',
	'  local.page = parseInt(input.page)',
	'  local.clean = text.replace(local.label, "-", " ")',
	'  console.log(local.label)',
	'  smtp.send({ to: input.email, subject: "Report", body: "Your report is ready." })',
	'  result.largest = local.largest',
	'  result.squared = local.squared',
	'  result.keys = local.keys',
	'  result.digest = local.digest',
	'  result.sorted = local.sorted',
	'  result.page = local.page',
	'  result.clean = local.clean',
	'}'
].join('\n');
try {
	var tools = call(1, "tools/list", {}).tools;
	["code-set", "code-patch"].forEach(function (name) {
		var described = tools.filter(function (t) { return t.name === name; })[0];
		var props = described.inputSchema.properties;
		assert(props.autoCorrect && props.autoCorrect.type === "boolean" && props.autoCorrectThreshold && props.autoCorrectThreshold.type === "number",
			name + " takes autoCorrect and autoCorrectThreshold: " + JSON.stringify(props.autoCorrect) + JSON.stringify(props.autoCorrectThreshold));
		assert(/proposedPatch/.test(described.description), name + " describes the proposed patch: " + described.description);
	});

	// The proposal, in structuredContent and in the text
	var refused = tool(2, "code-set", { name: "Report", code: intuitive });
	var patch = refused.value.proposedPatch;
	assert(refused.isError && patch && patch.edits.length === 11 && patch.revision === refused.value.revision && patch.threshold === 0.9,
		"a refused code-set proposes one global patch: " + JSON.stringify(refused.value).substring(0, 1200));
	assert(patch.edits.every(function (edit) {
		return typeof edit.oldText === "string" && typeof edit.newText === "string" && typeof edit.line === "number" &&
			typeof edit.confidence === "number" && typeof edit.reason === "string" && typeof edit.block === "string";
	}), "each edit is { oldText, newText, line, confidence, reason, block }: " + JSON.stringify(patch.edits[0]));
	assert(refused.text.indexOf("Proposed patch on revision " + patch.revision) !== -1 &&
		refused.text.indexOf("line 7 (0.95): crypto.md5(local.payload) -> crypto.hash({ text: local.payload, algorithm: \"md5\" })") !== -1 &&
		refused.text.indexOf("line 10 (0.7): parseInt(input.page) -> floor(Number(input.page)) — parseInt is not FlowScript") !== -1,
		"the text lists the edits, with the reason of those below the threshold: " + refused.text);
	assert(refused.value.next === patch.next && /code-patch edits with this revision/.test(patch.next), "next says how to apply it: " + refused.value.next);

	// A compatibility flag never changes the authored source or applies a guess.
	var auto = tool(3, "code-set", { name: "Report", code: intuitive, autoCorrect: true, revision: refused.value.revision });
	assert(!auto.value.autoCorrected && auto.value.proposedPatch.edits.length===11,"all guesses remain proposals");
	var read=tool(30,"code-get",{name:"Report"});
	assert(read.value.code===intuitive&&read.value.revision===refused.value.revision,"unchanged exact draft and revision");
	assert(auto.text.indexOf("Auto-corrected")<0&&auto.text.indexOf("Proposed patch")>=0,"text describes suggestions only");
	var left = auto.value.proposedPatch;
	var patched = tool(4, "code-patch", { name: "Report", revision: left.revision, edits: left.edits });
	assert(patched.value.ok === true, "the proposed edits pass unchanged to code-patch: " + patched.text);
	var checked = tool(5, "code-check", { name: "Report" });
	assert(checked.value.ok === true, "the result passes code-check: " + checked.text);

	print("code-intuitive-calls OK (" + count + " checks)");
} finally {
	FileUtils.deleteDirectory(target);
}
