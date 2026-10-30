// code-promote leaves the HTTP sessions alone (sessionsReset false) and names a short session timeout of the
// project: a client logged in before a pause lost its session after 60 idle seconds in the projects the bootstrap
// created before 1800 became its default, which looked like each promotion logging it out.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/promote-session-report.js <lib_flow_mcp dir> [<engine _flow dir>]
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
var target = java.nio.file.Files.createTempDirectory("flow-promote-session-report-").toFile().getCanonicalFile();
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
	// code-promote: sessions untouched, a short timeout named.
	var mcp = (function () { return eval(read(projectDir, "_flow/lib/mcp.js")); })();
	function project(timeout) { return { getName: function () { return "Tickets"; }, getHttpSessionTimeout: function () { return timeout; } }; }
	var short = {}, standard = {};
	mcp._sessionReport(project(60), short);
	mcp._sessionReport(project(1800), standard);
	assert(short.sessionsReset === false && short.httpSessionTimeout === 60 && /idle for 60 s/.test(short.sessionNote) && /1800/.test(short.sessionNote),
		"A 60 s session timeout is named: " + JSON.stringify(short));
	assert(standard.sessionsReset === false && standard.httpSessionTimeout === 1800 && standard.sessionNote === undefined, "1800 s needs no note: " + JSON.stringify(standard));
	var promoted = mcp.toolResponse({ id: 7, params: { name: "code-promote", arguments: { name: "Tickets" } } },
		{ ok: true, name: "Tickets", promoted: true, registration: Object.assign({ requested: true, registered: true, qname: "Tickets.Tickets" }, short) }, {}).result;
	assert(promoted.structuredContent.registration.sessionsReset === false && promoted.structuredContent.registration.sessionNote === short.sessionNote,
		"The compact registration keeps the session report: " + JSON.stringify(promoted.structuredContent.registration));
	assert(promoted.content[0].text.indexOf("idle for 60 s") !== -1, "and the text says it: " + promoted.content[0].text);

	print("promote-session-report OK (" + count + " checks)");
} finally {
	FileUtils.deleteDirectory(target);
}
