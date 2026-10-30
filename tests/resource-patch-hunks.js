// flow-resource-patch on a project resource (F-05): a unified patch is applied hunk by hunk in order with offset
// tracking, --- a/ +++ b/ headers accepted, a hunk whose line numbers are off applied where its lines match uniquely,
// an empty context line that lost its space read as such, and what cannot be placed refused with the expected and
// actual lines around. content replaces the whole text, checked against baseHash. lib_flow_engine then writes the
// computed text line for line: the next read gives the same lines and the returned hash.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/resource-patch-hunks.js <engine _flow dir> <lib_flow_mcp dir>
var engineDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : "../lib_flow_engine/_flow").getCanonicalPath());
var projectDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : ".").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
function failure(callback) {
	try { callback(); } catch (e) { return e; }
	return null;
}

var patchLib = eval(read(projectDir, "_flow/lib/patch.js"));
var engineUtils = eval(read(engineDir, "modules/patch-utils.js"));
function engineApply(content, patch) {
	return engineUtils.applyUnifiedPatchText(content, patch, { raise: function (code, message) { var e = new Error(message); e.code = code; throw e; } }).content;
}

var ENGINE_YAML = [
	"version: 1",
	"engineQName: lib_flow_engine.Engine",
	"bindings: {}",
	"config:",
	"  data:",
	"    sources:",
	"      postes:",
	"        provider: sql",
	"        table: POSTE",
	"",
	"  sql:",
	"    connections:",
	"      app:",
	"        url: jdbc:hsqldb:file:_flow/resources/sql/app",
	"    writes:",
	"      posteInsert:",
	"        operation: insert",
	""
].join("\n");

// 1. The trial: several hunks with headers and right line numbers, the first one spanning an empty line sent without its
// space. lib_flow_engine alone refuses it at the first hunk.
var trialPatch = [
	"--- a/_flow/engine.yaml",
	"+++ b/_flow/engine.yaml",
	"@@ -8,5 +8,6 @@",
	"         provider: sql",
	"         table: POSTE",
	"+        versionColumn: REVISION",
	"",
	"   sql:",
	"     connections:",
	"@@ -16,2 +17,3 @@",
	"       posteInsert:",
	"         operation: insert",
	"+        maxAffectedRows: 1",
	""
].join("\n");
assert(engineApply(ENGINE_YAML, trialPatch) === patchLib.applyUnifiedPatch(ENGINE_YAML, trialPatch).content, "engine applies the trial patch");
var trial = patchLib.applyUnifiedPatch(ENGINE_YAML, trialPatch);
var expectedTrial = ENGINE_YAML.replace("        table: POSTE\n", "        table: POSTE\n        versionColumn: REVISION\n")
	.replace("        operation: insert\n", "        operation: insert\n        maxAffectedRows: 1\n");
assert(trial.content === expectedTrial, "both hunks applied in order: " + JSON.stringify(trial.content));
assert(trial.hunks.length === 2 && trial.hunks[0].line === 8 && trial.hunks[0].match === "exact" && trial.hunks[1].line === 16 && trial.hunks[1].match === "exact",
	"each hunk reports where it applied: " + JSON.stringify(trial.hunks));
assert(trial.notes.some(function (note) { return /empty patch line\(s\) read as unchanged empty line/.test(note); }), "the empty context line is reported: " + trial.notes);

// 2. The second hunk numbered on the new file, as after re-reading: it is still placed, with its offset.
var renumbered = patchLib.applyUnifiedPatch(ENGINE_YAML, [
	"@@ -2,1 +2,2 @@",
	" engineQName: lib_flow_engine.Engine",
	"+configVisibility: {}",
	"@@ -17,2 +18,3 @@",
	"       posteInsert:",
	"         operation: insert",
	"+        minAffectedRows: 1",
	""
].join("\n"));
assert(renumbered.content.indexOf("engineQName: lib_flow_engine.Engine\nconfigVisibility: {}\nbindings") !== -1 &&
	/operation: insert\n {8}minAffectedRows: 1\n$/.test(renumbered.content), "a hunk numbered on the new file is applied: " + renumbered.content);
assert(renumbered.hunks[1].line === 16 && renumbered.hunks[1].offset === -1 && renumbered.hunks[1].match === "offset", "its offset is reported: " + JSON.stringify(renumbered.hunks[1]));

// 3. Line numbers off, lines matching once: applied there. Hunks given bottom first are applied too.
var shifted = patchLib.applyUnifiedPatch(ENGINE_YAML, "@@ -40,2 +40,2 @@\n       app:\n-        url: jdbc:hsqldb:file:_flow/resources/sql/app\n+        url: jdbc:hsqldb:file:_flow/resources/sql/app;hsqldb.tx=mvcc\n");
assert(/app;hsqldb\.tx=mvcc\n/.test(shifted.content) && shifted.hunks[0].line === 13 && /instead of line 40/.test(shifted.notes[0]), "unique match despite wrong numbers: " + JSON.stringify(shifted));
var reversed = patchLib.applyUnifiedPatch(ENGINE_YAML, "@@ -16,1 +16,1 @@\n-      posteInsert:\n+      posteCreate:\n@@ -1,1 +1,1 @@\n-version: 1\n+version: 2\n");
assert(/^version: 2\n/.test(reversed.content) && reversed.content.indexOf("      posteCreate:\n") !== -1, "hunks in reverse order: " + reversed.content);
var bare = patchLib.applyUnifiedPatch(ENGINE_YAML, "@@\n   sql:\n+    defaultConnection: app\n");
assert(bare.content.indexOf("  sql:\n    defaultConnection: app\n    connections:") !== -1 && bare.hunks[0].match === "context", "a bare @@ hunk is placed by its unique lines");

// 4. What cannot be placed is refused with the lines around.
var mismatch = failure(function () { patchLib.applyUnifiedPatch(ENGINE_YAML, "@@ -11,2 +11,3 @@\n   sql:\n     connexions:\n+      other: {}\n"); });
assert(mismatch && mismatch.code === "PATCH_CONTEXT_MISMATCH" && mismatch.details.mismatch.line === 12 &&
	mismatch.details.mismatch.expected === "    connexions:" && mismatch.details.mismatch.actual === "    connections:",
	"a mismatch names the line, the expected and the actual text: " + JSON.stringify(mismatch && mismatch.details));
assert(/line 12 is "    connections:" where the patch expects "    connexions:"/.test(mismatch.message) && mismatch.details.actual.length >= 4 &&
	mismatch.details.actual[0].line === 8 && /flow-resource-get/.test(mismatch.hint), "with the numbered lines around: " + JSON.stringify(mismatch.details.actual));
var ambiguous = failure(function () { patchLib.applyUnifiedPatch("a: 1\nb: 2\na: 1\n", "@@ -9,1 +9,2 @@\n a: 1\n+c: 3\n"); });
assert(ambiguous && ambiguous.code === "PATCH_CONTEXT_AMBIGUOUS" && ambiguous.details.matchingLines.join() === "1,3", "an ambiguous match is refused: " + JSON.stringify(ambiguous && ambiguous.details));
var atExpected = patchLib.applyUnifiedPatch("a: 1\nb: 2\na: 1\n", "@@ -3,1 +3,2 @@\n a: 1\n+c: 3\n");
assert(atExpected.content === "a: 1\nb: 2\na: 1\nc: 3\n", "a repeated line is taken at its numbered position");

// 5. An insertion without context: -N,0 inserts after line N; +M must agree. The trial's -N,0 +N,1 put a block
// outside its parent: refused, with both readings.
var outside = failure(function () { patchLib.applyUnifiedPatch(ENGINE_YAML, "@@ -10,0 +10,1 @@\n+        readOnly: false\n"); });
assert(outside && outside.code === "PATCH_INSERT_AMBIGUOUS" && outside.details.oldSideAfterLine === 10 && outside.details.newSideAfterLine === 9,
	"disagreeing insertion numbers are refused: " + JSON.stringify(outside && outside.details));
assert(failure(function () { engineApply(ENGINE_YAML, "@@ -10,0 +10,1 @@\n+        readOnly: false\n"); }).code === "PATCH_INSERT_AMBIGUOUS", "engine refuses it too");
var inserted = patchLib.applyUnifiedPatch(ENGINE_YAML, "@@ -9,0 +10,1 @@\n+        readOnly: false\n");
assert(inserted.content.indexOf("        table: POSTE\n        readOnly: false\n\n  sql:") !== -1 && inserted.hunks[0].afterLine === 9, "agreeing numbers insert after the line");
var withContext = patchLib.applyUnifiedPatch(ENGINE_YAML, "@@ -10,0 +10,1 @@\n         table: POSTE\n+        readOnly: false\n");
assert(withContext.content === inserted.content, "one context line places the insertion whatever the numbers");
assert(failure(function () { patchLib.applyUnifiedPatch(ENGINE_YAML, "@@\n+x: 1\n"); }).code === "PATCH_INSERT_WITHOUT_CONTEXT", "a bare insertion is refused");

// 6. Whitespace, fences, line endings, final new line, several files.
var spaced = patchLib.applyUnifiedPatch("key: \nnext: 1\n", "```diff\n@@ -1,2 +1,3 @@\n key:\n next: 1\n+last: 2\n```\n");
assert(spaced.content === "key: \nnext: 1\nlast: 2\n" && spaced.hunks[0].match === "whitespace", "trailing spaces tolerated, the file text kept: " + JSON.stringify(spaced.content));
assert(patchLib.applyUnifiedPatch("a\r\nb\r\n", "@@ -1,2 +1,3 @@\r\n a\r\n b\r\n+c\r\n").content === "a\nb\nc\n", "CRLF text and patch");
assert(patchLib.applyUnifiedPatch("a\nb", "@@ -2,1 +2,2 @@\n-b\n\\ No newline at end of file\n+b\n+c\n").content === "a\nb\nc\n", "a replaced last line gets its new line");
assert(patchLib.applyUnifiedPatch("a\nb\n", "@@ -2,1 +2,2 @@\n b\n+c\n\\ No newline at end of file\n").content === "a\nb\nc", "the marker removes the final new line");
assert(patchLib.applyUnifiedPatch("a\nb", "@@ -1,1 +1,1 @@\n-a\n+z\n").content === "z\nb", "a text without final new line keeps that state");
assert(patchLib.applyUnifiedPatch("", "--- /dev/null\n+++ b/docs/notes.md\n@@ -0,0 +1,2 @@\n+# Notes\n+First.\n").content === "# Notes\nFirst.\n", "creation from an empty text");
var twoFiles = failure(function () { patchLib.applyUnifiedPatch(ENGINE_YAML, trialPatch + "--- a/other.yaml\n+++ b/other.yaml\n@@ -1,1 +1,1 @@\n-x\n+y\n"); });
assert(twoFiles && twoFiles.code === "INVALID_PATCH" && /one resource per call/.test(twoFiles.message), "a patch of several files is refused");
var garbage = failure(function () { patchLib.applyUnifiedPatch(ENGINE_YAML, "@@ -1,1 +1,1 @@\nversion: 1\n+version: 2\n"); });
assert(garbage && garbage.code === "INVALID_PATCH" && garbage.details.patchLine === 2, "a hunk line without marker is refused with its patch line");
assert(failure(function () { patchLib.applyUnifiedPatch(ENGINE_YAML, "replace version"); }).code === "INVALID_PATCH", "no hunk");

// 7. The replacement hunk handed to lib_flow_engine writes exactly the computed text.
[[ENGINE_YAML, expectedTrial], ["a\nb", "a\nc"], ["a\n", "a\nb"], ["", "x\n"], ["a\nb\n", ""]].forEach(function (pair) {
	var replacement = patchLib.replacementPatch(pair[0], pair[1]);
	assert(engineApply(pair[0], replacement.patch) === replacement.content, "the engine applies the replacement hunk as computed: " + JSON.stringify(pair));
});
assert(patchLib.replacementPatch("a\nb", "a\nc\n").finalNewlineKept === true, "a missing final new line the engine cannot add is reported");

// 8. The tool end to end, through McpServer and the resource service of lib_flow_engine (headless).
var __flowEngineDir = engineDir;
var __flowProjectDir = projectDir;
var engine = eval(read(engineDir, "Engine.js"));
var mcpFlowSource = read(projectDir, "_flow/flows/McpServer.flow.js");
var target = java.nio.file.Files.createTempDirectory("flow-resource-patch-").toFile();
new java.io.File(target, "_flow").mkdirs();
FileUtils.writeStringToFile(new java.io.File(target, "_flow/engine.yaml"), ENGINE_YAML, "UTF-8");
function tool(id, name, args) {
	var execution = JSON.parse(engine.run(JSON.stringify({ flowSource: mcpFlowSource, includeTrace: false,
		input: { request: JSON.stringify({ jsonrpc: "2.0", id: id, method: "tools/call", params: { name: name, arguments: args } }) } })));
	assert(execution.ok === true && execution.result && execution.result.result, name + " ran: " + JSON.stringify(execution).substring(0, 400));
	return execution.result.result.structuredContent;
}
var targetDir = String(target.getAbsolutePath());
try {
	var got = tool(1, "flow-resource-get", { projectDir: targetDir, path: "_flow/engine.yaml" });
	assert(got.ok === true && got.content === ENGINE_YAML && /^[0-9a-f]{64}$/.test(got.hash), "read: " + JSON.stringify(got).substring(0, 300));
	var patched = tool(2, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", baseHash: got.hash, patch: trialPatch });
	assert(patched.ok === true && patched.mode === "patch" && patched.hunks === 2 && patched.appliedHunks.length === 2 && patched.changed === true &&
		patched.validation && patched.validation.ok === true, "the trial patch is applied by the tool: " + JSON.stringify(patched));
	var written = read(targetDir, "_flow/engine.yaml");
	assert(written === expectedTrial, "the file holds the patched lines, unchanged otherwise: " + JSON.stringify(written));
	var reread = tool(3, "flow-resource-get", { projectDir: targetDir, path: "_flow/engine.yaml" });
	assert(reread.hash === patched.hash && patched.hash === patched.newHash && reread.content === written, "the returned hash is the next base hash");
	var stale = tool(4, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", baseHash: got.hash, patch: "@@ -1,1 +1,1 @@\n-version: 1\n+version: 2\n" });
	assert(stale.error && stale.error.code === "RESOURCE_BASE_HASH_MISMATCH" && stale.error.details.hash === reread.hash, "a stale base hash is refused: " + JSON.stringify(stale));
	var refused = tool(5, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", baseHash: reread.hash, patch: "@@ -10,0 +10,1 @@\n+        readOnly: false\n" });
	assert(refused.error && refused.error.code === "PATCH_INSERT_AMBIGUOUS" && read(targetDir, "_flow/engine.yaml") === written, "a refused patch writes nothing: " + JSON.stringify(refused));
	var invalidYaml = tool(6, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", baseHash: reread.hash, patch: "@@ -1,1 +1,2 @@\n version: 1\n+  bad: [\n" });
	assert(invalidYaml.error && read(targetDir, "_flow/engine.yaml") === written, "the engine still validates the YAML: " + JSON.stringify(invalidYaml).substring(0, 300));
	var withoutHash = tool(7, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", content: ENGINE_YAML });
	assert(withoutHash.error && withoutHash.error.code === "RESOURCE_BASE_HASH_REQUIRED" && withoutHash.error.details.hash === reread.hash, "content needs baseHash: " + JSON.stringify(withoutHash));
	var both = tool(8, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", baseHash: reread.hash, content: ENGINE_YAML, patch: trialPatch });
	assert(both.error && both.error.code === "INVALID_ARGUMENTS", "patch and content together are refused");
	var dry = tool(9, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", baseHash: reread.hash, content: ENGINE_YAML, dryRun: true });
	assert(dry.ok === true && dry.dryRun === true && dry.mode === "content" && read(targetDir, "_flow/engine.yaml") === written, "a dry run writes nothing: " + JSON.stringify(dry));
	var replaced = tool(10, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", baseHash: reread.hash, content: ENGINE_YAML.replace(/\n/g, "\r\n") });
	assert(replaced.ok === true && replaced.mode === "content" && read(targetDir, "_flow/engine.yaml") === ENGINE_YAML, "content replaces the text (LF lines): " + JSON.stringify(replaced));
	var same = tool(11, "flow-resource-patch", { projectDir: targetDir, path: "_flow/engine.yaml", baseHash: replaced.hash, content: ENGINE_YAML });
	assert(same.ok === true && same.changed === false && same.hash === replaced.hash, "the same text writes nothing: " + JSON.stringify(same));
	var created = tool(12, "flow-resource-patch", { projectDir: targetDir, path: "docs/notes.md", content: "# Notes\n" });
	assert(created.ok === true && created.created === true && read(targetDir, "docs/notes.md") === "# Notes\n", "content creates a project document: " + JSON.stringify(created));
	var listed = tool(13, "flow-resource-get", { projectDir: targetDir, path: "docs/notes.md" });
	assert(listed.hash === created.hash, "the hash of a created resource is the next base hash");
} finally {
	FileUtils.deleteQuietly(target);
}
print("resource-patch-hunks OK (" + count + " checks)");
