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

	// Only an explicitly private Flow promoted in Studio gets this execution hint.
	function engineMode(studio) { return { isStudioMode: function () { return studio; } }; }
	var privateSource = { code: 'const _flow = {\n  "sourceVersion": 2,\n  "accessibility": "private",\n}\n\nfunction Reset({ input, result }) {\n  result.ok = true\n}\n' };
	var studioPrivate = {}, serverPrivate = {}, studioHidden = {}, bodyOnly = {};
	mcp._accessibilityReport(engineMode(true), privateSource, studioPrivate);
	mcp._accessibilityReport(engineMode(false), privateSource, serverPrivate);
	mcp._accessibilityReport(engineMode(true), { code: privateSource.code.replace('"private"', '"hidden"') }, studioHidden);
	mcp._accessibilityReport(engineMode(true), { code: 'const _flow = { sourceVersion: 2 }\nfunction Notes({ result }) {\n  result.text = "accessibility: \'private\'"\n}\n' }, bodyOnly);
	assert(/code-run|requestable-execute/.test(studioPrivate.accessibilityNote || ""),
		"A private Flow promoted in Studio names an execution tool: " + JSON.stringify(studioPrivate));
	assert(serverPrivate.accessibilityNote === undefined && studioHidden.accessibilityNote === undefined && bodyOnly.accessibilityNote === undefined,
		"No note on a server, for a hidden Flow or for a text of the body: " + JSON.stringify([serverPrivate, studioHidden, bodyOnly]));
	var promotedPrivate = mcp.toolResponse({ id: 8, params: { name: "code-promote", arguments: { name: "Reset" } } },
		{ ok: true, name: "Reset", promoted: true, registration: Object.assign({ requested: true, registered: true, qname: "Tickets.Reset" }, studioPrivate) }, {}).result;
	assert(promotedPrivate.structuredContent.registration.accessibilityNote === studioPrivate.accessibilityNote &&
		promotedPrivate.content[0].text.indexOf(studioPrivate.accessibilityNote) !== -1, "The compact registration and its text keep the note: " + JSON.stringify(promotedPrivate));

	// A Flow without accessibility is private on 8.5.0 (its property): code-run and requestable-execute run it, an HTTP
	// client is refused. An agent proved its API through the MCP only (it150, L2): the promotion says so, Studio or server.
	function dbo(isPrivate) { return { isPrivateAccessibility: function () { return isPrivate; } }; }
	var undeclared = { code: 'const _flow = { sourceVersion: 3, inputs: { title: { type: "string" } } }\n\nfunction book_create({ input, result }) {\n  result.ok = true\n}\n' };
	var publicSource = { code: undeclared.code.replace("sourceVersion: 3,", 'sourceVersion: 3, accessibility: "public",') };
	var onServer = {}, inStudio = {}, olderEngine = {}, declaredPublic = {}, declaredPrivate = {}, noSource = {};
	mcp._accessibilityReport(engineMode(false), undeclared, onServer, dbo(true));
	mcp._accessibilityReport(engineMode(true), undeclared, inStudio, dbo(true));
	mcp._accessibilityReport(engineMode(false), undeclared, olderEngine, dbo(false));
	mcp._accessibilityReport(engineMode(false), publicSource, declaredPublic, dbo(false));
	mcp._accessibilityReport(engineMode(false), privateSource, declaredPrivate, dbo(true));
	mcp._accessibilityReport(engineMode(false), {}, noSource, dbo(true));
	assert(/No accessibility declared/.test(onServer.accessibilityNote || "") && /requestable-execute run it/.test(onServer.accessibilityNote)
		&& /accessibility: "public"/.test(onServer.accessibilityNote) && inStudio.accessibilityNote === onServer.accessibilityNote,
		"A Flow private for want of a declaration says how to open it, on a server and in the Studio: " + JSON.stringify([onServer, inStudio]));
	assert(olderEngine.accessibilityNote === undefined && declaredPublic.accessibilityNote === undefined
		&& declaredPrivate.accessibilityNote === undefined && noSource.accessibilityNote === undefined,
		"No note when the property is public, when the source declares it, or without a source: " +
		JSON.stringify([olderEngine, declaredPublic, declaredPrivate, noSource]));
	var promotedUndeclared = mcp.toolResponse({ id: 9, params: { name: "code-promote", arguments: { name: "book_create" } } },
		{ ok: true, name: "book_create", promoted: true, registration: Object.assign({ requested: true, registered: true, qname: "Books.book_create" }, onServer) }, {}).result;
	assert(promotedUndeclared.content[0].text.indexOf("No accessibility declared") !== -1, "The text of code-promote says it: " + promotedUndeclared.content[0].text);

	// The runs of the MCP execute a private Flow anyway: their answer says that this proves nothing over HTTP, where
	// the agent believes it tested its API (it155 L5: the note of code-promote read four times and ignored).
	function run(name, args) { return { params: { name: name, arguments: args } }; }
	function resolver(isPrivate) { return function () { return dbo(isPrivate); }; }
	var codeRun = mcp._runAccessibilityNote(run("code-run", { project: "Books", name: "book_create" }), resolver(true));
	assert(/^book_create is private: this run proves nothing over HTTP/.test(codeRun)
		&& codeRun.indexOf("POST /convertigo/projects/Books/.json, __sequence=book_create") !== -1
		&& /accessibility: "public" \(listed\) or "hidden"/.test(codeRun), "code-run of a private Flow says it: " + codeRun);
	var relative = mcp._runAccessibilityNote(run("requestable-execute", { project: "Books", requestable: ".book_create" }), resolver(true));
	var qualified = mcp._runAccessibilityNote(run("requestable-execute", { requestable: "Books.book_create" }), resolver(true));
	assert(relative === codeRun && qualified === codeRun, "requestable-execute too, .Flow or Project.Flow: " + JSON.stringify([relative, qualified]));
	assert(mcp._runAccessibilityNote(run("code-run", { project: "Books", name: "book_create" }), resolver(false)) === ""
		&& mcp._runAccessibilityNote(run("code-run", { project: "Books", name: "book_create" }), function () { return null; }) === ""
		&& mcp._runAccessibilityNote(run("code-promote", { project: "Books", name: "book_create" }), resolver(true)) === ""
		&& mcp._runAccessibilityNote(run("code-run", { project: "Books", sourceFile: "src/routes/+page.flow.svelte" }), resolver(true)) === "",
		"No note for a public or unknown Flow, another tool, or a page");
	var text = mcp._textContent({ ok: true, result: { id: "1" }, accessibilityNote: codeRun })[0].text;
	assert(text.indexOf("accessibilityNote: book_create is private") === 0, "The note opens the text of the answer: " + text);

	print("promote-session-report OK (" + count + " checks)");
} finally {
	FileUtils.deleteDirectory(target);
}
