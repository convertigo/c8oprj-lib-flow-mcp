// A page that calls a Flow using entity.list is offered the exact fields of the entity: the Flow output schema
// (flow-output-schema, the effective schema the Studio gives a CallSequence of that Flow) is derived from the
// model, and the frontbuilder picker and binding diagnostics read it. Relation labels stay optional.
var projectDir = arguments.length > 0 ? arguments[0] : ".";
var engineDir = arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow";
var FileUtils = Packages.org.apache.commons.io.FileUtils, Files = java.nio.file.Files, File = java.io.File;
var __flowEngineDir = String(new File(engineDir).getCanonicalPath());
var __flowProjectDir = String(new File(projectDir).getCanonicalPath());
var engine = eval(String(FileUtils.readFileToString(new File(engineDir, "Engine.js"), "UTF-8")));
var mcpSource = String(FileUtils.readFileToString(new File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
var cache = new File(projectDir, "../.cache/entity-tests").getCanonicalFile();
cache.mkdirs();
var workspace = Files.createTempDirectory(cache.toPath(), "entity-picker-").toFile();
var target = new File(workspace, "EntityPicker"), targetDir = String(target.getAbsolutePath());
["lib_flow_engine", "lib_flow_entity", "lib_flow_sql", "lib_flow_crud_data"].forEach(function (n) {
	Files.createSymbolicLink(new File(workspace, "c8oprj-" + n.replace(/_/g, "-")).toPath(), new File(projectDir, "../" + n).getCanonicalFile().toPath());
});
var resourceRoot = String(java.lang.System.getenv("FLOW_FRONTBUILDER_RESOURCE_ROOT") || "");
var sourceFile = "_flow/frontbuilder/svelte/model/EntityPicker/src/routes/+page.flow.svelte";
var absoluteSourceFile = String(new File(target, sourceFile).getAbsolutePath());
var definition = ["version: 1", "config:", "  frontbuilder:", "    svelte:", "      target: svelte5", "      resourceRoot: " + resourceRoot,
	"      modelPath: " + sourceFile, ""].join("\n");
var calls = 0, assertions = 0;
function assert(value, message) { assertions++; if (!value) throw new Error(message); }
function tool(name, args) {
	var execution = JSON.parse(engine.run(JSON.stringify({flowSource: mcpSource, includeTrace: false, input: {request: JSON.stringify({
		jsonrpc: "2.0", id: ++calls, method: "tools/call", params: {name: name, arguments: args}})}})));
	assert(execution.ok === true && execution.result && execution.result.result, name + " failed: " + JSON.stringify(execution).substring(0, 600));
	return execution.result.result.structuredContent;
}
function find(node, predicate) {
	if (!node || typeof node !== "object") return null;
	if (predicate(node)) return node;
	var keys = Object.keys(node);
	for (var i = 0; i < keys.length; i++) { var found = find(node[keys[i]], predicate); if (found) return found; }
	return null;
}
function at(schema, path) {
	return path.split(".").reduce(function (s, key) {
		if (!s) return null;
		if (key === "[]") return s.items || null;
		return s.properties && s.properties[key] || null;
	}, schema);
}
try {
	FileUtils.writeStringToFile(new File(target, "c8oProject.yaml"), "convertigo: 8.5.0.m006\n↓EntityPicker [core.Project]:\n  version: 1.0\n  ↓entities [references.ProjectSchemaReference]:\n    projectName: lib_flow_entity\n", "UTF-8");
	FileUtils.writeStringToFile(new File(target, "_flow/engine.yaml"), definition, "UTF-8");
	// The published example model of the entities guide.
	var guide = String(FileUtils.readFileToString(new File(projectDir, "_flow/resources/guide/entities.md"), "UTF-8"));
	var example = /<!-- example: model-format -->\s*```json\n([\s\S]*?)```/.exec(guide);
	assert(example, "The entities guide publishes its model example");
	var saved = tool("flow-entity-model-set", {projectDir: targetDir, model: JSON.parse(example[1]), expectedRevision: "missing"});
	assert(saved.ok === true, "Example model written: " + JSON.stringify(saved));
	var flowSource = "const _flow = { sourceVersion: 2 }\n\nfunction ListTasks({ input, config, result }) {\n" +
		"  local.page = entity.list({ entity: \"Task\", checkAccess: true })\n" +
		"  return { tasks: local.page.rows, hasMore: local.page.hasMore }\n}\n";

	// 1. The Flow output schema has the fields of Task, typed as the model declares them.
	var output = tool("flow-output-schema", {project: "EntityPicker", projectDir: targetDir, name: "ListTasks", flowSource: flowSource, detail: "full"});
	var schema = output.schema && output.schema.type ? output.schema : {type: "object", properties: output.schema || output.properties};
	var item = at(schema, "tasks.[]");
	var FIELDS = "due,id,requester,revision,status,team,title";
	assert(item && Object.keys(at(item, "values").properties || {}).sort().join() === FIELDS && at(item, "values.title").type === "string" && at(item, "values.status")["enum"].join() === "OPEN,DONE" &&
		at(item, "values.due").nullable === true && at(item, "values.team").type === "string" && at(item, "key.id").type === "string",
		"Flow output schema has the Task fields: " + JSON.stringify(schema));
	assert(at(item, "labels.team") && (item.required || []).indexOf("labels") < 0 && !at(item, "labels").required,
		"Relation labels are optional: " + JSON.stringify(item));

	function binding(name) {
		return {mode: "source", source: {category: "requestable", actionId: ".ListTasks"}, path: [{kind: "property", name: "tasks"},
			{kind: "index", index: 0}, {kind: "property", name: "values"}, {kind: "property", name: name}]};
	}
	// 2. A page calling that Flow: the Studio gives the CallSequence this effective schema; the picker offers its fields.
	FileUtils.writeStringToFile(new File(absoluteSourceFile), [
		"<script module>",
		"  export const _flow = { sourceVersion: 2 };",
		"</script>",
		"",
		"<FlowComponent $$id=\"tasksPage\" label=\"Tasks\">",
		"  <Variables />",
		"  <Events>",
		"    <OnMount $$id=\"load\"><Actions>",
		"      <CallSequence $$id=\"listTasks\" requestable=\".ListTasks\" outputSchema={" + JSON.stringify(schema) + "}><Variables /></CallSequence>",
		"    </Actions></OnMount>",
		"  </Events>",
		"  <Structure>",
		"    <Text $$id=\"firstTitle\" text={" + JSON.stringify(binding("title")) + "} />",
		"  </Structure>",
		"</FlowComponent>",
		""
	].join("\n"), "UTF-8");
	var tree = tool("frontend-svelte-tree", {project: "EntityPicker", projectDir: targetDir, engineSource: definition, sourceFile: absoluteSourceFile, detail: "inspect", maxDepth: 10});
	var text = find(tree, function (node) { return node.id === "firstTitle" || node.nodeId === "firstTitle" || node.name === "firstTitle"; });
	assert(text && text.path, "Text node found: " + JSON.stringify(tree).substring(0, 600));
	var picker = tool("frontend-svelte-tree", {project: "EntityPicker", projectDir: targetDir, engineSource: definition, sourceFile: absoluteSourceFile,
		focusPath: text.path, property: "text", detail: "inspect", maxDepth: 4});
	var offered = find(picker, function (node) { return node.id === ".ListTasks" && Array.isArray(node.bindings); });
	var paths = {};
	(offered && offered.bindings || []).forEach(function (b) { paths[b.path] = b.type; });
	assert(Object.keys(paths).filter(function (p) { return /^tasks\[0\]\.values\./.test(p); }).map(function (p) { return p.substring(16); }).sort().join() === FIELDS &&
		paths["tasks[0].values.title"] === "string" && paths["tasks[0].key.id"] === "string" && paths["tasks[0].labels.team"] === "string" && paths.hasMore === "boolean",
		"The picker offers the exact fields of Task: " + JSON.stringify(paths));

	// 3. A wrong field is refused with the exact source schema.
	var checked = tool("code-check", {project: "EntityPicker", projectDir: targetDir, engineSource: definition, sourceFile: sourceFile,
		code: String(FileUtils.readFileToString(new File(absoluteSourceFile), "UTF-8")).replace('"name":"title"', '"name":"titel"')});
	var unknown = (checked.diagnostics || []).filter(function (d) { return d.code === "FRONTEND_BINDING_PATH_UNKNOWN"; })[0];
	var offeredItem = unknown && at(unknown.sourceSchema, "tasks.[]");
	assert(checked.ok === false && offeredItem && Object.keys(at(offeredItem, "values").properties).sort().join() === FIELDS &&
		(offeredItem.required || []).indexOf("labels") < 0 && !at(offeredItem, "labels").required && at(offeredItem, "labels.team"),
		"A wrong field is refused with the exact schema, labels optional: " + JSON.stringify(checked).substring(0, 1500));
	print(JSON.stringify({ok: true, protocolCalls: calls, assertions: assertions}));
} finally {
	FileUtils.deleteDirectory(workspace);
}
