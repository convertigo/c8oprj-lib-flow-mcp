// Guessed resource addresses, from the trace of a light-bench run of 10/11 (L18, it66): the model read a project block
// as flow://_flow/blocks/... (the project file is read by path), a guide as the path _flow/resources/guide/<name>.md of
// a library project, and every guide flow://guide/<name> with a project argument. Each one was answered UNKNOWN_RESOURCE,
// or traced as such: the MCP trace recorded the inner refusal of the project before the guide that the client received,
// so a run counted refusals that the client never saw.
// - A guessed address that names one resource without ambiguity is read, with a note that gives the exact address:
//   flow://_flow/<path> with a project (the path of that project), a guide path in a project that does not hold it, and a
//   guide URI that differs only by case, "_" for "-", a ".md" suffix, a final "/" or "guides" for "guide".
// - Any other unknown guide address is refused with one line that names the nearest guide URIs (shared words or edit
//   distance), with or without project, and the guide index (flow://guide/start).
// - The trace has one response per flow-resource-get request: the one the client receives.
// Run with Rhino: tests/guide-address-guesses-1110.js <lib_flow_mcp dir> <engine _flow dir>
// FLOW_MCP_EXPECT_BASELINE=true runs it against an older MCP: every regression check fails, every contract check passes.
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var negative = String(java.lang.System.getenv("FLOW_MCP_EXPECT_BASELINE") || "") === "true";
var results = [];
function check(value, name, detail, regression) {
	results.push({ name: name, passed: !!value, regression: regression !== false });
	print((value ? "PASS " : "FAIL ") + name + (value ? "" : " " + String(JSON.stringify(detail)).substring(0, 700)));
}
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
var __flowEngineDir = engineDir;
var __flowProjectDir = projectDir;
var engine = eval(read(engineDir, "Engine.js"));
var mcpFlowSource = read(projectDir, "_flow/flows/McpServer.flow.js");
var target = java.nio.file.Files.createTempDirectory("flow-guide-guesses-").toFile();
var targetDir = String(target.getAbsolutePath());
var traceFile = new java.io.File(target, "trace/flow-mcp-trace.jsonl");
var BLOCK = "const _meta = {sourceVersion: 2, private: true, properties: {request: {type: \"object\", kind: \"expression\"}}, outputs: {out: {type: \"object\"}}}\n" +
	"function block({ input, config, result }) {\n  return {}\n}\n";
new java.io.File(target, "_flow/blocks/app").mkdirs();
FileUtils.writeStringToFile(new java.io.File(target, "_flow/engine.yaml"), "version: 1\nengineQName: lib_flow_engine.Engine\nbindings: {}\n", "UTF-8");
FileUtils.writeStringToFile(new java.io.File(target, "_flow/blocks/app/entityAccess.block.js"), BLOCK, "UTF-8");
var GUIDE = read(projectDir, "_flow/resources/guide/entities-policy.md"), ENTITIES = read(projectDir, "_flow/resources/guide/entities.md");
var ids = 100;
function call(args, withProject) {
	var id = ++ids;
	if (withProject) args.projectDir = targetDir;
	var execution = JSON.parse(engine.run(JSON.stringify({ flowSource: mcpFlowSource, includeTrace: false, includeFlow: false,
		config: { mcp: { traceJsonl: String(traceFile.getAbsolutePath()) } },
		input: { request: JSON.stringify({ jsonrpc: "2.0", id: id, method: "tools/call", params: { name: "flow-resource-get", arguments: args } }) } })));
	var result = execution.ok === true && execution.result && execution.result.result || {};
	var sc = result.structuredContent || {};
	return { id: id, result: result, sc: sc, error: sc.error || null, text: String(result.content && result.content[0] && result.content[0].text || "") };
}
function traced(id) {
	var lines = traceFile.isFile() ? String(FileUtils.readFileToString(traceFile, "UTF-8")).split("\n") : [];
	return lines.filter(function (line) { return line.trim(); }).map(function (line) { return JSON.parse(line); }).filter(function (entry) { return entry.id === id; });
}
function served(r, uri, text) { return !r.error && r.result.isError !== true && r.sc.uri === uri && r.sc.text === text && /flow:\/\/guide\//.test(String(r.sc.note || "")); }
function guideLine(r) { var hint = String(r.error && r.error.hint || ""); return { hint: hint, uris: hint.match(/flow:\/\/(?:guide|lib)\/[A-Za-z0-9_.\/-]+[A-Za-z0-9]/g) || [] }; }
try {
	// The guesses of the run.
	var block = call({ uri: "flow://_flow/blocks/app/entityAccess.block.js" }, true);
	check(!block.error && block.sc.path === "_flow/blocks/app/entityAccess.block.js" && block.sc.text === BLOCK &&
		/path _flow\/blocks\/app\/entityAccess\.block\.js/.test(String(block.sc.note || "")),
		"a project file asked as flow://_flow/<path> is read by its path, with a note", block.result);
	var guidePath = call({ path: "_flow/resources/guide/entities.md" }, true);
	check(served(guidePath, "flow://guide/entities", ENTITIES), "a guide asked by its path in a project that does not hold it is the guide, with a note", guidePath.result);
	var withProject = call({ uri: "flow://guide/entities" }, true);
	check(!withProject.error && withProject.sc.text === ENTITIES, "a guide asked with a project is read", withProject.result, false);
	var lines = traced(withProject.id), responses = lines.filter(function (entry) { return entry.direction === "response"; });
	check(lines.length === 2 && lines[0].direction === "request" && responses.length === 1 && JSON.stringify(responses[0].payload).indexOf("UNKNOWN_RESOURCE") < 0,
		"the trace has one response per request: the guide the client received", lines.map(function (entry) { return [entry.direction, entry.method, entry.summary]; }));
	var guidePathLines = traced(guidePath.id);
	check(guidePathLines.filter(function (entry) { return entry.direction === "response"; }).length === 1, "a guide path read is traced once", guidePathLines.length);
	// Spelling variants of an existing guide, with or without project.
	// The first two were already read under their alias; a ".md" suffix read flow://guide/entities, the guide of the prefix.
	[[{ uri: "flow://guide/Entities-Policy" }, false, false], [{ uri: "flow://guide/entities_policy" }, false, false], [{ uri: "flow://guide/entities-policy.md" }, false],
		[{ uri: "flow://guides/entities-policy" }, false], [{ uri: "flow://guide/entities-policy/" }, false], [{ uri: "flow://guide/ENTITIES_POLICY.md" }, true]].forEach(function (pair) {
		var r = call(pair[0], pair[1]);
		check(served(r, "flow://guide/entities-policy", GUIDE) && /flow:\/\/guide\/entities-policy/.test(r.sc.note),
			pair[0].uri + (pair[1] ? " with a project" : "") + " is the guide, with the exact URI in a note", r.result, pair[2]);
	});
	// A guess that is not one guide: the refusal names the nearest exact URIs and the index, in one line.
	var typo = call({ uri: "flow://guide/entites-polcy" }, false), typoLine = guideLine(typo);
	check(typo.error && typo.error.code === "UNKNOWN_RESOURCE" && !typo.sc.text && typoLine.uris[0] === "flow://guide/entities-policy" &&
		typoLine.uris.indexOf("flow://guide/start") > 0 && typoLine.hint.indexOf("\n") < 0, "a misspelt guide is refused with its nearest URI first and the index", typo.error);
	var related = call({ uri: "flow://guide/entity-policy" }, true), relatedLine = guideLine(related);
	check(related.error && related.error.code === "UNKNOWN_RESOURCE" && relatedLine.uris[0] === "flow://guide/entities-policy" &&
		relatedLine.uris.indexOf("flow://guide/start") > 0 && !/resources\/read/.test(relatedLine.hint) && relatedLine.hint.indexOf("\n") < 0,
		"with a project, an unknown guide is refused with the nearest URIs and the index, not resources/read", related.error);
	var unknownPath = call({ path: "_flow/resources/guide/entity-policy.md" }, true), pathLine = guideLine(unknownPath);
	check(unknownPath.error && unknownPath.error.code === "UNKNOWN_RESOURCE" && pathLine.uris[0] === "flow://guide/entities-policy" &&
		pathLine.uris.indexOf("flow://guide/start") > 0, "an unknown guide path in a project is refused with the nearest guide URIs and the index", unknownPath.error);
	var all = [typo, related, unknownPath].every(function (r) { var u = guideLine(r).uris; return u.length >= 2 && u.length <= 4 && u.every(function (uri) { return /^flow:\/\/(guide|lib)\//.test(uri); }); });
	check(all, "at most three nearest URIs, then the index", [typoLine.uris, relatedLine.uris, pathLine.uris]);
	// Unchanged: an exact guide, a project path, a missing project file.
	var exact = call({ uri: "flow://guide/entities-policy" }, false);
	check(!exact.error && exact.sc.text === GUIDE && !exact.sc.note, "an exact guide URI is read without a note", exact.result, false);
	var own = call({ path: "_flow/blocks/app/entityAccess.block.js" }, true);
	check(!own.error && own.sc.text === BLOCK && !own.sc.note, "a project path is read as it is", own.result, false);
	var missingFile = call({ uri: "flow://_flow/blocks/app/missing.block.js" }, true);
	check(missingFile.error && missingFile.error.code === "UNKNOWN_RESOURCE", "a flow://_flow/ guess of a missing project file stays refused", missingFile.result, false);
} finally {
	FileUtils.deleteDirectory(target);
}
var expected = results.filter(function (r) { return r.regression; }).length, failed = results.filter(function (r) { return !r.passed; });
var passed = negative ? failed.length === expected && results.filter(function (r) { return !r.regression; }).every(function (r) { return r.passed; }) : failed.length === 0;
print(JSON.stringify({ ok: passed, baseline: negative, checks: results.length, expectedBaselineFailures: expected, failures: failed.map(function (r) { return r.name; }) }));
if (!passed) throw Error("guide-address-guesses-1110 failed: " + failed.map(function (r) { return r.name; }).join(", "));
