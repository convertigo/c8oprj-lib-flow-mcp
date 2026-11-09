// flow-resource-get with format:"text" answers "Resource metadata: {...}", an empty line, then the text of a project
// resource. Sent back as the content of flow-resource-patch, that answer wrote the line into the file: an engine.yaml
// began with six of them, one per patch, and stayed valid YAML. A text that adds such a line is refused, whatever the
// mode; a patch that removes them is accepted.
// Run with Rhino: tests/resource-read-header-1109.js <lib_flow_mcp dir> <engine _flow dir>
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }
var __flowEngineDir = engineDir;
var __flowProjectDir = projectDir;
var engine = eval(read(engineDir, "Engine.js"));
var mcpFlowSource = read(projectDir, "_flow/flows/McpServer.flow.js");
var target = java.nio.file.Files.createTempDirectory("flow-resource-read-header-").toFile();
var targetDir = String(target.getAbsolutePath());
var ENGINE_YAML = ["version: 1", "engineQName: lib_flow_engine.Engine", "bindings: {}", "config:", "  demo:", "    login: false", ""].join("\n");
new java.io.File(target, "_flow").mkdirs();
FileUtils.writeStringToFile(new java.io.File(target, "_flow/engine.yaml"), ENGINE_YAML, "UTF-8");
function call(id, name, args) {
	args.projectDir = targetDir;
	var execution = JSON.parse(engine.run(JSON.stringify({ flowSource: mcpFlowSource, includeTrace: false,
		input: { request: JSON.stringify({ jsonrpc: "2.0", id: id, method: "tools/call", params: { name: name, arguments: args } }) } })));
	assert(execution.ok === true && execution.result && execution.result.result, name + " ran: " + JSON.stringify(execution).substring(0, 400));
	return execution.result.result;
}
try {
	var answer = call(1, "flow-resource-get", { path: "_flow/engine.yaml", format: "text" });
	var text = String(answer.content[0].text);
	assert(/^Resource metadata: \{"/.test(text) && text.indexOf("\n\n" + ENGINE_YAML) > 0, "the text answer has the header, then the file: " + text);
	var hash = JSON.parse(text.substring("Resource metadata: ".length, text.indexOf("\n"))).hash;

	// The whole answer, edited, sent back as content.
	var copied = call(2, "flow-resource-patch", { path: "_flow/engine.yaml", baseHash: hash, content: text.replace("login: false", "login: true") }).structuredContent;
	assert(copied.error && copied.error.code === "RESOURCE_CONTENT_READ_HEADER" && copied.error.details.line === 1 && copied.error.details.mode === "content" &&
		/not part of the file\. Nothing written\./.test(copied.error.message) && /first empty line/.test(copied.error.hint),
		"content carrying the header is refused: " + JSON.stringify(copied));
	assert(read(targetDir, "_flow/engine.yaml") === ENGINE_YAML, "nothing is written");

	// The header added by an edit or a patch is refused too.
	var edited = call(3, "flow-resource-patch", { path: "_flow/engine.yaml", baseHash: hash,
		edits: [{ oldText: "version: 1", newText: text.substring(0, text.indexOf("\n")) + "\nversion: 1" }] }).structuredContent;
	assert(edited.error && edited.error.code === "RESOURCE_CONTENT_READ_HEADER" && edited.error.details.mode === "edits", "an edit adding the header is refused: " + JSON.stringify(edited));
	assert(read(targetDir, "_flow/engine.yaml") === ENGINE_YAML, "nothing is written by the edit");

	// The text alone is written; a file that already has the header can be cleaned.
	var clean = call(4, "flow-resource-patch", { path: "_flow/engine.yaml", baseHash: hash,
		content: text.substring(text.indexOf("\n\n") + 2).replace("login: false", "login: true") }).structuredContent;
	assert(clean.ok === true && read(targetDir, "_flow/engine.yaml") === ENGINE_YAML.replace("login: false", "login: true"), "the text alone is written: " + JSON.stringify(clean));
	var polluted = text.substring(0, text.indexOf("\n")) + "\n\n" + ENGINE_YAML;
	FileUtils.writeStringToFile(new java.io.File(target, "_flow/engine.yaml"), polluted, "UTF-8");
	var pollutedHash = call(5, "flow-resource-get", { path: "_flow/engine.yaml" }).structuredContent.hash;
	var cleaned = call(6, "flow-resource-patch", { path: "_flow/engine.yaml", baseHash: pollutedHash, content: ENGINE_YAML }).structuredContent;
	assert(cleaned.ok === true && read(targetDir, "_flow/engine.yaml") === ENGINE_YAML, "removing the header is accepted: " + JSON.stringify(cleaned));
} finally {
	FileUtils.deleteQuietly(target);
}
print("resource-read-header-1109 OK (" + count + " checks)");
