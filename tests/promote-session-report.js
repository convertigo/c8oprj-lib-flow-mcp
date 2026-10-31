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

	// code-promote of a private Flow in the Studio says that the Studio runs it over HTTP anyway (Studio mode): an agent
	// read the anonymous answer of the Studio as a security defect of the Flow. Not on a server, not for another Flow.
	function engineMode(studio) { return { isStudioMode: function () { return studio; } }; }
	var privateSource = { code: 'const _flow = {\n  "sourceVersion": 2,\n  "accessibility": "private",\n}\n\nfunction Reset({ input, result }) {\n  result.ok = true\n}\n' };
	var studioPrivate = {}, serverPrivate = {}, studioHidden = {}, bodyOnly = {};
	mcp._accessibilityReport(engineMode(true), privateSource, studioPrivate);
	mcp._accessibilityReport(engineMode(false), privateSource, serverPrivate);
	mcp._accessibilityReport(engineMode(true), { code: privateSource.code.replace('"private"', '"hidden"') }, studioHidden);
	mcp._accessibilityReport(engineMode(true), { code: 'const _flow = { sourceVersion: 2 }\nfunction Notes({ result }) {\n  result.text = "accessibility: \'private\'"\n}\n' }, bodyOnly);
	assert(/Studio mode/.test(studioPrivate.accessibilityNote || "") && /refused over HTTP/.test(studioPrivate.accessibilityNote)
		&& /not an administrator/.test(studioPrivate.accessibilityNote),
		"A private Flow promoted in the Studio says how to prove its refusal: " + JSON.stringify(studioPrivate));
	assert(serverPrivate.accessibilityNote === undefined && studioHidden.accessibilityNote === undefined && bodyOnly.accessibilityNote === undefined,
		"No note on a server, for a hidden Flow or for a text of the body: " + JSON.stringify([serverPrivate, studioHidden, bodyOnly]));
	var promotedPrivate = mcp.toolResponse({ id: 8, params: { name: "code-promote", arguments: { name: "Reset" } } },
		{ ok: true, name: "Reset", promoted: true, registration: Object.assign({ requested: true, registered: true, qname: "Tickets.Reset" }, studioPrivate) }, {}).result;
	assert(promotedPrivate.structuredContent.registration.accessibilityNote === studioPrivate.accessibilityNote &&
		promotedPrivate.content[0].text.indexOf("Studio mode") !== -1, "The compact registration and its text keep the note: " + JSON.stringify(promotedPrivate));

	print("promote-session-report OK (" + count + " checks)");
} finally {
	FileUtils.deleteDirectory(target);
}
