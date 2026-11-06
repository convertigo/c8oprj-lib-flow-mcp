// code-get of a frontend source without sourceFile: the configured page (engine.yaml in YAML or JSON form), else the one
// page source of the project, else an error that names the exact call to make.
var projectDir = String(arguments[0]);
var engineDir = String(arguments[1]);
var io = Packages.org.apache.commons.io.FileUtils;
var engineSource = String(io.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(engineSource);
var mcpFlowSource = String(io.readFileToString(new java.io.File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
var root = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"), "lib_flow_mcp_code_get_default_" + java.lang.System.currentTimeMillis());
var resourceRoot = String(java.lang.System.getenv("FLOW_FRONTBUILDER_RESOURCE_ROOT") || "");
var page = "_flow/frontbuilder/svelte/model/Books/src/routes/+page.flow.svelte";
var other = "_flow/frontbuilder/svelte/model/Books/src/routes/about/+page.flow.svelte";
var pageSource = "<script>\n</script>\n\n<h1>Books</h1>\n";

function assertTrue(condition, message) {
	if (!condition) throw new Error(message);
}
function write(dir, path, text) {
	io.writeStringToFile(new java.io.File(dir, path), text, "UTF-8");
}
function fixture(name, engineYaml, pages) {
	var dir = new java.io.File(root, name);
	dir.mkdirs();
	write(dir, "_flow/engine.yaml", engineYaml);
	(pages || []).forEach(function (path) { write(dir, path, pageSource); });
	return String(dir.getAbsolutePath());
}
function codeGet(dir) {
	var response = JSON.parse(engine.run(JSON.stringify({
		flowSource: mcpFlowSource,
		includeTrace: false,
		input: { request: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call",
			params: { name: "code-get", arguments: { project: "Books", projectDir: dir, kind: "source" } } }) }
	})));
	assertTrue(response.result && response.result.result && response.result.result.structuredContent, "code-get answered: " + JSON.stringify(response));
	return response.result.result.structuredContent;
}
function svelteConfig(modelPath) {
	var svelte = { target: "svelte5", resourceRoot: resourceRoot || "_flow/frontbuilder/svelte" };
	if (modelPath) svelte.modelPath = modelPath;
	return svelte;
}

// The bootstrap keeps a JSON engine.yaml in JSON: its modelPath is the default source.
var json = codeGet(fixture("json", JSON.stringify({ version: 1, config: { frontbuilder: { svelte: svelteConfig(page) } } }, null, 2), [page]));
assertTrue(!json.error && String(json.code || json.text || json.source || "").indexOf("<h1>Books</h1>") !== -1,
	"A JSON engine.yaml gives its modelPath: " + JSON.stringify(json));

// Without modelPath, the one page source of the project is read.
var single = codeGet(fixture("single", JSON.stringify({ version: 1, config: { frontbuilder: { svelte: svelteConfig("") } } }), [page]));
assertTrue(!single.error && String(single.code || single.text || single.source || "").indexOf("<h1>Books</h1>") !== -1,
	"The one page source is read: " + JSON.stringify(single));

// Several page sources: the error lists them and asks for sourceFile.
var several = codeGet(fixture("several", "version: 1\nconfig:\n  frontbuilder:\n    svelte:\n      target: svelte5\n", [page, other]));
assertTrue(several.error && several.error.code === "FRONTEND_SOURCE_REQUIRED", "Several pages have a proper code: " + JSON.stringify(several));
assertTrue(several.error.hint.indexOf("sourceFile") !== -1 && several.error.hint.indexOf(page) !== -1 && several.error.hint.indexOf(other) !== -1 &&
	several.error.details.sources.length === 2, "The existing sources are listed: " + JSON.stringify(several));

// No frontend yet: the error gives the bootstrap call.
var none = codeGet(fixture("none", JSON.stringify({ version: 1, config: { sql: {} } }), []));
assertTrue(none.error && none.error.code === "FRONTEND_SOURCE_REQUIRED", "No frontend has a proper code: " + JSON.stringify(none));
assertTrue(none.error.hint.indexOf('flow-project-bootstrap({project:"Books", ui:true})') !== -1, "The bootstrap call is given: " + JSON.stringify(none));
print("frontend-code-get-default OK");
