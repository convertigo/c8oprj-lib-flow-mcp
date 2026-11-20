// FlowScript v3 conformance of the guides and skills of lib_flow_mcp (lot L4). Every v3 example they teach, the generated
// zones included, is read by the Rhino 1.9.2 parser of the engine (after the const -> let rewrite of for...of heads),
// uses no construct the grammar refuses, and no guide shows a bare default( call. No example is run by Rhino.
// The checks are shared with lib_flow_engine (tests/support/flowscript-v3-conformance.js and the same waiting list).
var root = new java.io.File(String(arguments[0])).getCanonicalFile(), engineDir = new java.io.File(String(arguments[1])).getCanonicalFile();
var __flowEngineDir = String(engineDir.getAbsolutePath());
var __flowProjectDir = String(java.nio.file.Files.createTempDirectory("flow-v3-guides-conformance-").toFile().getAbsolutePath());
var files = Packages.org.apache.commons.io.FileUtils;
var reader = Packages.com.convertigo.libflowengine.FlowScriptV3Reader;
var engineRoot = engineDir.getParentFile();
load(new java.io.File(engineRoot, "tests/support/flowscript-v3-conformance.js"));
var v3 = flowscriptV3Conformance({ reader: reader, waitingFile: new java.io.File(engineRoot, "tests/support/flowscript-v3-waiting.json") });

var waiting = {};
v3.waiting.waiting.forEach(function (item) { waiting[item.id] = item.reason; });
var guides = v3.guideExamples(new java.io.File(root, "_flow/resources"));
var failures = guides.problems.slice(), checked = 0, refused = 0, waited = 0, cleared = [], zones = 0;
guides.examples.forEach(function (example) {
	var result = example.refused ? v3.checkRefused(example.code, example.refused, false) : v3.checkAccepted(example.code);
	if (example.refused) refused++; else checked++;
	if (!result.parse) failures.push(example.id + ": " + result.problems.join("; "));
	else if (example.id in waiting) { if (result.problems.length) waited++; else cleared.push(example.id); }
	else if (result.problems.length) failures.push(example.id + ": " + result.problems.join("; "));
});
// The guides teach v3: at least the loops, list and error examples are there, and generated zones carry the specification.
v3.guidePaths.forEach(function (path) {
	var text = v3.read(new java.io.File(new java.io.File(root, "_flow/resources"), path));
	zones += (text.match(/<!-- generated:v3-/g) || []).length;
});
// Every other guide and skill (20/11): no backend Flow nor FlowScript block in sourceVersion 2, and each FlowScript
// fence is read by the v3 reader. A .flow.svelte page keeps sourceVersion 2 (its own format), as a Rhino block
// ("runtime": "rhino") or a portable block ("implementations"): they are not FlowScript.
var covered = {}, others = 0;
v3.guidePaths.forEach(function (path) { covered[path] = true; });
function markdownPaths(dir, rel, out) {
	dir.listFiles().forEach(function (file) {
		var name = rel + "/" + file.getName();
		if (file.isDirectory()) markdownPaths(file, name, out);
		else if (/\.md$/.test(name)) out.push(name);
	});
	return out;
}
var resources = new java.io.File(root, "_flow/resources");
markdownPaths(new java.io.File(resources, "guide"), "guide", []).concat(markdownPaths(new java.io.File(resources, "skills"), "skills", [])).sort().forEach(function (path) {
	v3.fences(v3.read(new java.io.File(resources, path))).forEach(function (fence) {
		var code = fence.code, where = path + ":" + fence.line;
		if (!v3.isV3Lang(fence.lang) || /<script/.test(code)) return;
		var version = code.match(/\b_(flow|meta)\s*=\s*\{[\s\S]*?"?sourceVersion"?\s*:\s*(\d)/);
		if (version && version[2] === "2" && (version[1] === "flow" || !/"?(runtime"?\s*:\s*"rhino"|implementations"?\s*:)/.test(code))) {
			failures.push(where + ": FlowScript in sourceVersion 2, write it in v3");
			return;
		}
		if (covered[path]) return;
		if (/\b_meta\s*=/.test(code)) {
			if (!/\bconst _flow\s*=/.test(code)) return; // a Rhino or portable block: not FlowScript
			code = code.substring(code.search(/\bconst _flow\s*=/));
		}
		if (!/\bconst _flow\s*=/.test(code) && !/^guide\//.test(path)) return;
		var result = v3.checkAccepted(v3.complete(code, "OtherGuideExample" + others++));
		if (!result.parse || result.problems.length) failures.push(where + ": " + result.problems.join("; "));
	});
});
if (others < 20) failures.push("too few examples in the other guides: " + others);
if (checked < 6) failures.push("too few v3 guide examples: " + checked);
if (zones < 10) failures.push("too few generated zones: " + zones);
if (cleared.length) print("NOTICE: examples of the waiting list that the reader accepts now (remove them): " + cleared.join(", "));
if (failures.length) throw new Error("FlowScript v3 guide conformance failed (" + failures.length + "):\n" + failures.join("\n"));
print("flowscript-v3-guides-conformance OK: " + checked + " guide examples, " + others + " in the other guides (+ " + refused + " refused), " + waited + " waiting, " + zones + " generated zones, " + v3.incompleteScans + " scans left to the reader");
