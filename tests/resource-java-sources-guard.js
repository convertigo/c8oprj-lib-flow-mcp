// flow-resource-patch and flow-resource-delete refuse a source with unsaved Studio changes. The Java sources of the
// project (libs/src) are never working copies of the FlowEngine, which refuses to tell their state ("Unsupported Flow
// source file"): the guard lets them through without asking it.
var projectDir = new java.io.File(String(arguments[0] || ".")).getCanonicalFile();
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(projectDir, "_flow/lib/mcp.js"), "UTF-8"));
function assert(value, message) { if (!value) throw new Error(message); }
function extract(name) {
	var start = source.indexOf("\n\tfunction " + name + "(") + 2;
	assert(start >= 2, name + " must remain extractable");
	var end = source.lastIndexOf("\n\t}", source.indexOf("\n\tfunction ", start + 1)) + 3;
	return eval("(" + source.substring(start, end) + ")");
}
var File = java.io.File;
var asked = [];
var dirtyPaths = {};
function sourceStore() {
	return {
		drafts: true,
		project: { getFlowEngine: function () { return { isEngineSourceDirty: function () { return false; } }; } },
		dirty: function (file) {
			var path = String(file.getPath());
			asked.push(path);
			if (!/\.(?:flow\.svelte|flow\.css|js|yaml|json|svelte)$/.test(path)) {
				throw new Error("Unsupported Flow source file: " + path);
			}
			return dirtyPaths[path] === true;
		}
	};
}
var assertNoWorkingCopy = extract("assertNoWorkingCopy");
var args = { projectDir: String(projectDir) };

["libs/src/com/acme/Rows.java", "./libs/src/Root.java", "/libs/src/com/acme/Rows.java"].forEach(function (path) {
	assertNoWorkingCopy(args, path, "flow-resource-patch");
});
assert(asked.length === 0, "the FlowEngine is not asked about the Java sources: " + asked);

var block = String(new File(projectDir, "_flow/blocks/demo.block.js").getCanonicalPath());
assertNoWorkingCopy(args, "_flow/blocks/demo.block.js", "flow-resource-patch");
assert(asked.length === 1 && asked[0] === block, "the Flow sources are still checked: " + asked);
dirtyPaths[block] = true;
var refused = null;
try { assertNoWorkingCopy(args, "_flow/blocks/demo.block.js", "flow-resource-patch"); } catch (e) { refused = e; }
assert(refused && refused.code === "SOURCE_WORKING_COPY", "a Flow source with unsaved changes is still refused");
print("resource-java-sources-guard OK");
