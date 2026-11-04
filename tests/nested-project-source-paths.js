// A standalone target may be nested in the MCP host, without its own project descriptor.
var File = java.io.File;
var files = Packages.org.apache.commons.io.FileUtils;
var project = new File(arguments[0]).getCanonicalFile();
var mcp = eval(String(files.readFileToString(new File(project, "_flow/lib/mcp.js"), "UTF-8")));
var temporary = java.nio.file.Files.createTempDirectory("mcp-source-paths-").toFile();
var host = new File(temporary, "Host");
var target = new File(host, "_private/tmp/Target");
var relative = "_flow/frontbuilder/svelte/model/Smoke/src/routes/+page.flow.svelte";
var source = new File(target, relative);
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
try {
	files.forceMkdir(source.getParentFile());
	files.writeStringToFile(source, "<FlowComponent />", "UTF-8");
	var descriptor = new File(host, "c8oProject.yaml");
	files.writeStringToFile(descriptor, "↓Host [core.Project]:\n", "UTF-8");
	assert(!new File(target, "c8oProject.yaml").exists(), "The target must have no project descriptor");
	var ctx = { scopes: { request: { projectDir: String(host) } } };
	function response(root) {
		return mcp.toolResponse({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
			name: "frontend-svelte-palette", arguments: { projectDir: String(root) }
		} }, { ok: true, focus: { sourcePath: String(source), sourceMutationPath: "frontAst.slots.structure.children" },
			items: [{ id: "svelte.text", insert: { type: "Text", props: { text: "Hello" } } }] }, ctx).result.structuredContent;
	}
	function checkTarget() {
		var palette = response(target);
		var apply = palette.items[0].apply;
		assert(apply.tool === "frontend-svelte-mutate", "Palette must return an executable mutation");
		assert(apply.arguments.sourceFile === relative, "Target-relative sourceFile expected, got " + apply.arguments.sourceFile);
		assert(palette.focus.sourcePath === relative, "Other source paths must use the same target root");
		assert(ctx.scopes.request.projectDir === String(host), "The host context must remain unchanged");
	}
	checkTarget();
	assert(response(host).items[0].apply.arguments.sourceFile === "_private/tmp/Target/" + relative,
		"Each request must use its own projectDir");
	checkTarget();
	files.forceDelete(descriptor);
	checkTarget(); // The descriptor's presence must not determine the response root.
	print("nested-project-source-paths OK (" + checks + " checks)");
} finally {
	files.deleteDirectory(temporary);
}
