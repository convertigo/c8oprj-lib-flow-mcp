var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/libs/flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var engineFile = new java.io.File(engineDir, "Engine.js");
var engineSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(engineFile, "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(engineSource);
var mcpFlowSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flows/McpServer.flow.js"), "UTF-8"));
var targetDir = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"),
	"lib_flow_mcp_authoring_" + java.lang.System.currentTimeMillis());
targetDir.mkdirs();
var targetProjectDir = String(targetDir.getAbsolutePath());
var routeRoot = new java.io.File(targetDir, "libs/flow/frontbuilder/svelte/model/Headless/src/routes");
var resourceRoot = String(java.lang.System.getenv("FLOW_FRONTBUILDER_RESOURCE_ROOT") || "");

function assertTrue(condition, message) {
	if (!condition) throw new Error(message);
}

function callTool(id, name, args) {
	var response = JSON.parse(engine.run(JSON.stringify({
		flowSource: mcpFlowSource,
		includeTrace: false,
		input: {
			request: JSON.stringify({
				jsonrpc: "2.0",
				id: id,
				method: "tools/call",
				params: { name: name, arguments: args }
			})
		}
	})));
	assertTrue(response.result && response.result.result && response.result.result.structuredContent,
		name + " failed: " + JSON.stringify(response));
	return response.result.result.structuredContent;
}

function engineDefinition(sourceFile) {
	return [
		"version: 1",
		"config:",
		"  frontbuilder:",
		"    svelte:",
		"      target: svelte5",
		"      resourceRoot: " + resourceRoot,
		"      modelPath: " + sourceFile,
		""
	].join("\n");
}

function findNode(node, predicate) {
	if (!node) return null;
	if (predicate(node)) return node;
	var children = node.children || [];
	for (var index = 0; index < children.length; index++) {
		var found = findNode(children[index], predicate);
		if (found) return found;
	}
	return null;
}

try {
	var requestedSourceFile = "libs/flow/frontbuilder/svelte/model/Headless/src/routes/authoring/+page.flow.svelte";
	var definition = engineDefinition(requestedSourceFile);
	var created = callTool(1, "frontend-svelte-mutate", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		focusPath: "frontends.svelte.routes",
		mutation: {
			op: "insert",
			value: {
				__frontendCreateSource: {
					baseId: "authoring",
					directory: "${targetRouteDirectory}/${localName}",
					fileName: "+page.flow.svelte",
					targetSourcePath: String(routeRoot.getAbsolutePath()),
					source: [
						"<script module>",
						"  export const _flow = {",
						"    app: { id: \"Headless\", title: \"Headless\" },",
						"    page: { id: \"authoring\", route: \"/authoring\", title: \"Authoring\" },",
						"    builder: { id: \"lib_flow_frontbuilder_svelte\", generatedRoot: \"generated\", buildOutput: \"DisplayObjects/mobile\" }",
						"  };",
						"</script>",
						"",
						"<FlowComponent id=\"authoring\" label=\"Authoring\">",
						"  <Variables />",
						"  <Structure />",
						"</FlowComponent>",
						""
					].join("\n")
				}
			}
		}
	});
	assertTrue(created.created === true && created.written === true,
		"MCP did not create the headless source");
	var sourceFile = String(created.sourceFile || requestedSourceFile);
	var absoluteSourceFile = String(new java.io.File(targetDir, sourceFile).getAbsolutePath());
	definition = engineDefinition(sourceFile);
	assertTrue(sourceFile.indexOf("model/Headless/src/routes/authoring/+page.flow.svelte") !== -1,
		"MCP ignored the selected route target: " + sourceFile);
	var initialTree = callTool(2, "frontend-svelte-tree", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		sourceFile: absoluteSourceFile,
		detail: "compact",
		maxDepth: 8
	});
	var structureNode = findNode(initialTree, function (node) {
		return node.kind === "frontendStructure" && String(node.path || "").indexOf("frontends.svelte.routes.") === 0;
	});
	var variablesNode = findNode(initialTree, function (node) {
		return node.kind === "frontendActionVariables" && String(node.path || "").indexOf("frontends.svelte.routes.") === 0;
	});
	assertTrue(structureNode && structureNode.parentPath && variablesNode && variablesNode.parentPath,
		"Authoring tree did not expose the MCP-created route slots: " + JSON.stringify(initialTree));

	var structurePalette = callTool(3, "authoring-palette", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		parentPath: structureNode.parentPath,
		query: "Text"
	});
	var variablesPalette = callTool(4, "authoring-palette", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		parentPath: variablesNode.parentPath,
		query: "Text"
	});
	function isText(item) {
		return item.id === "svelte.text" || item.id === "frontbuilder.svelte.text" || item.tag === "Text";
	}
	assertTrue((structurePalette.items || []).some(isText) && !(variablesPalette.items || []).some(isText),
		"Generic palette did not filter candidates from parentPath: " + JSON.stringify({
			structure: structurePalette,
			variables: variablesPalette
		}));

	var loop = callTool(5, "frontend-svelte-mutate", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		sourceFile: absoluteSourceFile,
		mutation: {
			op: "insert",
			path: "frontAst.slots.structure.children",
			index: "end",
			value: {
				id: "componentLoop",
				kind: "each",
				tag: "ForEach",
				source: { mode: "literal", value: [{ icon: "star", description: "Featured" }] },
				context: "item",
				index: "index"
			}
		}
	});
	assertTrue(loop.ok === true && loop.written === true, "MCP did not insert the typed ForEach");

	var children = callTool(6, "frontend-svelte-mutate", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		sourceFile: absoluteSourceFile,
		mutations: [{
			op: "insert",
			path: "frontAst.slots.structure.children[0].slots.children.children",
			value: { id: "componentIcon", kind: "text", tag: "Text", text: { mode: "literal", value: "Icon" } }
		}, {
			op: "insert",
			path: "frontAst.slots.structure.children[0].slots.children.children",
			value: { id: "componentIndex", kind: "text", tag: "Text", text: { mode: "literal", value: "Index" } }
		}, {
			op: "insert",
			path: "frontAst.slots.structure.children[0].slots.children.children",
			value: { id: "componentDescription", kind: "text", tag: "Text", text: { mode: "literal", value: "Description" } }
		}, {
			op: "insert",
			path: "frontAst.slots.structure.children[0].slots.children.children",
			value: { id: "deleteMe", kind: "text", tag: "Text", text: { mode: "literal", value: "Delete me" } }
		}]
	});
	assertTrue(children.ok === true && children.mutationCount === 4,
		"MCP did not batch literal mutations");

	var bindings = callTool(7, "frontend-svelte-mutate", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		sourceFile: absoluteSourceFile,
		mutations: [{
			op: "replace",
			path: "frontAst.slots.structure.children[0].slots.children.children[0].props.text",
			value: {
				mode: "source",
				source: { category: "iteration", scopeId: "componentLoop", value: "item" },
				path: [{ kind: "property", name: "icon" }]
			}
		}, {
			op: "replace",
			path: "frontAst.slots.structure.children[0].slots.children.children[1].props.text",
			value: {
				mode: "expression",
				parts: [
					{ kind: "literal", value: "index[" },
					{ kind: "source", source: { category: "iteration", scopeId: "componentLoop", value: "index" }, path: [] },
					{ kind: "literal", value: "]" }
				]
			}
		}, {
			op: "replace",
			path: "frontAst.slots.structure.children[0].slots.children.children[2].props.text",
			value: { mode: "expression", expression: "String(item.description)" }
		}, {
			op: "move",
			from: "frontAst.slots.structure.children[0].slots.children.children[2]",
			path: "frontAst.slots.structure.children[0].slots.children.children",
			index: 0
		}, {
			op: "delete",
			path: "frontAst.slots.structure.children[0].slots.children.children[3]"
		}]
	});
	assertTrue(bindings.ok === true && bindings.mutationCount === 5,
		"MCP did not edit Source/Expression, move and delete");
	var canonical = callTool(8, "frontend-svelte-code-get", {
		project: "target",
		projectDir: targetProjectDir,
		sourceFile: absoluteSourceFile
	});
	var code = String(canonical.code || "");
	assertTrue(code.indexOf('"parts"') !== -1 &&
		code.indexOf('"value":"index["') !== -1 &&
		code.indexOf('"value":"]"') !== -1 &&
		code.indexOf("deleteMe") === -1 &&
		code.indexOf("String(item.description)") !== -1 &&
		code.indexOf("componentIcon") !== -1,
		"Bindings did not round-trip through MCP: " + code);

	var tree = callTool(9, "frontend-svelte-tree", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		sourceFile: absoluteSourceFile,
		detail: "inspect",
		maxDepth: 10
	});
	var iconNode = findNode(tree, function (node) {
		return node.id === "componentIcon" || node.name === "componentIcon" ||
			node.nodeId === "componentIcon" || node.summary === "componentIcon" ||
			(node.definition && node.definition.id === "componentIcon");
	});
	assertTrue(iconNode && iconNode.path,
		"Unfocused authoring tree did not return the MCP-created Text path");
	var picker = callTool(10, "frontend-svelte-tree", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		sourceFile: absoluteSourceFile,
		focusPath: iconNode.path,
		property: "text",
		detail: "inspect",
		maxDepth: 4
	});
	var pickerJson = JSON.stringify(picker);
	assertTrue(pickerJson.indexOf('"current":{"mode":"source"') !== -1 &&
		pickerJson.indexOf('"value":"item"') !== -1 &&
		pickerJson.indexOf('"value":"index"') !== -1 &&
		pickerJson.indexOf('"path":"icon"') !== -1 &&
		pickerJson.indexOf('"path":"description"') !== -1 &&
		pickerJson.indexOf('"type":"integer","scalar":true') !== -1,
		"Picker did not restore the Source selection or expose typed item fields and numeric index");

	var generated = callTool(11, "frontend-svelte-action", {
		project: "target",
		projectDir: targetProjectDir,
		engineSource: definition,
		sourceFile: absoluteSourceFile,
		actionId: "generate"
	});
	assertTrue(generated.ok === true && generated.details &&
		(generated.details.steps || []).some(function (step) { return step.ok === true; }),
		"MCP did not regenerate Svelte: " + JSON.stringify(generated));
	print(JSON.stringify({ ok: true, sourceFile: sourceFile, palette: true, mutations: 10, picker: true, generated: true }));
} finally {
	Packages.org.apache.commons.io.FileUtils.deleteDirectory(targetDir);
}
