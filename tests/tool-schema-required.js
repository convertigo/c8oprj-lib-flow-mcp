// A tool property declared "required": true (a boolean on the property, not an array on the object) is not JSON
// Schema: the Claude API refuses the whole input schema and Claude Code drops the tool without a word. In a trial the
// two CRUD tools vanished for a Claude agent, which rebuilt the CRUD by hand, while Vibe, more lenient, kept them.
// Every MCP tool block keeps "required" for arrays on an object; a property named "required" stays allowed.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/tool-schema-required.js <lib_flow_mcp dir>
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }

var root = new java.io.File(projectDir, "_flow/blocks/mcp/tool");
var files = FileUtils.listFiles(root, ["js"], true).toArray();
var offenders = [];
for (var i = 0; i < files.length; i++) {
	var text = String(FileUtils.readFileToString(files[i], "UTF-8"));
	var lines = text.split("\n");
	for (var n = 0; n < lines.length; n++) {
		// "required": true|false, the value of a "required" key, not an object or an array
		if (/"required"\s*:\s*(true|false)\b/.test(lines[n])) {
			offenders.push(String(root.toPath().relativize(files[i].toPath())) + ":" + (n + 1));
		}
	}
	assert(true, "scanned");
}
assert(files.length > 20, "MCP tool blocks found under " + root);
assert(offenders.length === 0, "property-level required flags make the tool schema invalid for Claude: " + offenders.join(", "));
print("tool-schema-required: " + count + " checks, " + files.length + " tool blocks");
