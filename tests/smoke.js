var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/libs/flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var engineFile = new java.io.File(engineDir, "Engine.js");
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(engineFile, "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(source);

function assertTrue(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

var mcpLibSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/lib/mcp.js"), "UTF-8"));
var mcpLib = eval(mcpLibSource);
var normalizedProjectYaml = mcpLib._normalizeConvertigoYamlObjectHeaders([
	"↓Smoke [core.Project]:",
	"  ↓project [references.ProjectSchemaReference]:",
	"    projectName: lib_flow_engine",
	""
].join("\n"));
assertTrue(normalizedProjectYaml.indexOf("↓Smoke [core.Project]: \n") !== -1 &&
	normalizedProjectYaml.indexOf("  ↓project [references.ProjectSchemaReference]: \n") !== -1,
	"MCP should normalize empty Convertigo YAML object headers before rewriting c8oProject.yaml");

var mcpFlowSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flows/McpServer.flow.js"), "UTF-8"));
var batchBlockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/blocks/mcp/batch.block.js"), "UTF-8"));
var handleBlockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/blocks/mcp/handle.block.js"), "UTF-8"));
var toolsCallBlockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/blocks/mcp/tools/call.block.js"), "UTF-8"));
var toolsAvailableBlockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/blocks/mcp/tools/available.block.js"), "UTF-8"));
var toolIdentifyBlockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/blocks/mcp/tool/identify.block.js"), "UTF-8"));
assertTrue(mcpFlowSource.indexOf("fragment.use(") === -1 &&
	mcpFlowSource.indexOf("mcp.flow(") === -1 &&
	mcpFlowSource.indexOf("mcp.batch(") !== -1 &&
	mcpFlowSource.indexOf("mcp.handle(") !== -1,
	"McpServer flow should route through graph composite MCP blocks");
assertTrue(/\bfunction\s+mcp_batch\b/.test(batchBlockSource) &&
	/\bforEach\s*\(/.test(batchBlockSource) &&
	handleBlockSource.indexOf("mcp.tools.call") !== -1 &&
	handleBlockSource.indexOf("mcp.resources.read") !== -1 &&
	toolsCallBlockSource.indexOf("runtime\": \"rhino\"") !== -1 &&
	toolsCallBlockSource.indexOf("TOOL_PREFIX") !== -1 &&
	toolsCallBlockSource.indexOf("mcp.tools.call.inspect") === -1 &&
	toolsAvailableBlockSource.indexOf("runtime\": \"rhino\"") !== -1 &&
	toolsAvailableBlockSource.indexOf("TOOL_PREFIX") !== -1 &&
	toolIdentifyBlockSource.indexOf("runtime\": \"rhino\"") !== -1 &&
	toolIdentifyBlockSource.indexOf("flow-resource-search") === -1,
	"MCP graph blocks should use catalog introspection instead of generated hard-coded tool lists");

var list = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	config: {},
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/list"
		})
	}
})));
print(JSON.stringify(list));
assertTrue(list.ok === true, "MCP Flow tools/list failed");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "code-run";
}), "MCP Flow tools/list did not expose code-run");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-search";
}), "MCP Flow tools/list did not expose flow-search");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "code-get";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "code-set";
}), "MCP Flow tools/list did not expose code get/set");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-resource-patch";
}), "MCP Flow tools/list did not expose resource patching");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-output-schema";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "flow-node-output-schema";
}), "MCP Flow tools/list did not expose schema tools");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-block-mock";
}), "MCP Flow tools/list did not expose flow-block-mock");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-block-mock-list";
}), "MCP Flow tools/list did not expose flow-block-mock-list");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "authoring-tree";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "authoring-palette";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "authoring-mutate";
}), "MCP Flow tools/list did not expose generic authoring tools");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "frontend-svelte-tree";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "frontend-svelte-palette";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "frontend-svelte-mutate";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "frontend-svelte-actions";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "frontend-svelte-action";
}), "MCP Flow tools/list did not expose Svelte frontend authoring tools");
var batch = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	config: {},
	input: {
		request: JSON.stringify([
			{
				jsonrpc: "2.0",
				id: 2,
				method: "tools/list"
			},
			{
				jsonrpc: "2.0",
				id: 3,
				method: "resources/list"
			}
		])
	}
})));
assertTrue(batch.ok === true &&
	batch.result.length === 2 &&
	batch.result[0].id === 2 &&
	batch.result[1].id === 3,
	"MCP Flow batch graph block did not iterate and collect responses");

var publicCatalog = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1001,
			method: "tools/call",
			params: {
				name: "flow-catalog",
				arguments: {
					projectDir: projectDir,
					detail: "summary"
				}
			}
		})
	}
})));
assertTrue(!publicCatalog.result.result.structuredContent.blocks.some(function (block) {
	return block.blockId === "mcp.tools.call";
}), "MCP private blocks should be hidden from the public Flow catalog");
var privateCatalog = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1002,
				method: "tools/call",
				params: {
					name: "flow-catalog",
					arguments: {
						projectDir: projectDir,
						detail: "compact",
						includePrivate: true,
						q: "mcp.tools.call",
						limit: 10
					}
				}
			})
	}
})));
assertTrue(privateCatalog.result.result.structuredContent.blocks.some(function (block) {
	return block.blockId === "mcp.tools.call" && block.implementation === "rhino";
}), "MCP private dynamic blocks should be visible when includePrivate=true");
var traceFile = java.io.File.createTempFile("flow-mcp-trace", ".jsonl");
traceFile["delete"]();
var typeGet = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	includeFlow: false,
	config: {
		mcp: {
			traceJsonl: String(traceFile.getAbsolutePath())
		}
	},
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1003,
			method: "tools/call",
			params: {
				name: "flow-type-get",
				arguments: {
					projectDir: projectDir,
					name: "expression"
				}
			}
		})
	}
})));
var typeResponsePayload = JSON.stringify(typeGet.result.result);
assertTrue(typeResponsePayload.indexOf("/Users/") === -1 &&
	typeResponsePayload.indexOf(String(new java.io.File(engineDir).getAbsolutePath())) === -1,
	"MCP Flow type response leaked absolute paths");
assertTrue(typeResponsePayload.indexOf("\"mode\":\"\"") === -1,
	"MCP Flow type response leaked empty mode metadata");
assertTrue(typeGet.result.result.structuredContent.descriptor.editor.file === "libs/flow/types/editors/expression.html",
	"MCP Flow type response did not shorten type resource paths");
var traceContent = String(Packages.org.apache.commons.io.FileUtils.readFileToString(traceFile, "UTF-8"));
assertTrue(traceContent.indexOf("\"direction\":\"request\"") !== -1 &&
	traceContent.indexOf("\"direction\":\"response\"") !== -1 &&
	traceContent.indexOf("flow-type-get") !== -1,
	"MCP Flow trace JSONL was not written");
assertTrue(traceContent.indexOf("/Users/") === -1,
	"MCP Flow trace JSONL leaked absolute paths");
var traceLines = traceContent.trim().split(/\r?\n/).map(function (line) {
	return JSON.parse(line);
});
var traceResponse = traceLines.filter(function (line) {
	return line.direction === "response" && line.tool === "flow-type-get";
})[0];
assertTrue(traceResponse &&
	traceResponse.summary &&
	traceResponse.summary.ok === true &&
	traceResponse.durationMs >= 0 &&
	traceResponse.payloadChars > 0 &&
	traceResponse.payloadTruncated === false,
	"MCP Flow trace JSONL did not include response metrics");
var treeResponse = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	includeFlow: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1004,
			method: "tools/call",
			params: {
				name: "flow-tree",
				arguments: {
					projectDir: projectDir,
					definition: {
						version: 1,
						nodes: [{
							id: "treeSet",
							block: "set",
							path: "result.value",
							value: "ok"
						}]
					}
				}
			}
		})
	}
})));
assertTrue(JSON.stringify(treeResponse.result.result).indexOf("/Users/") === -1,
	"MCP Flow tree response leaked absolute paths through virtual info strings");

var resources = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	config: {},
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 101,
			method: "resources/list"
		})
	}
})));
print(JSON.stringify(resources));
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/start";
}), "MCP Flow resources/list did not expose the start guide");
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/samples";
}), "MCP Flow resources/list did not expose the samples guide");
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/frontend-svelte";
}), "MCP Flow resources/list did not expose the Svelte frontend guide");

var methodNotFound = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	config: {},
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 103,
			method: "unknown/method"
		})
	}
})));
assertTrue(methodNotFound.result.error.code === -32601 &&
	methodNotFound.result.error.message === "Method not found: unknown/method",
	"MCP Flow method-not-found graph block did not return a JSON-RPC error");

var toolNotFound = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	config: {},
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 104,
			method: "tools/call",
			params: {
				name: "flow-does-not-exist",
				arguments: {}
			}
		})
	}
})));
assertTrue(toolNotFound.result.error.code === -32000 &&
	toolNotFound.result.error.message === "Unknown Flow MCP tool: flow-does-not-exist" &&
	toolNotFound.result.error.data.code === "FLOW_MCP_TOOL_ERROR",
	"MCP Flow tool-not-found graph block did not return a JSON-RPC error");

var startGuide = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	config: {},
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 102,
			method: "resources/read",
			params: {
				uri: "flow://guide/search-and-edit"
			}
		})
	}
})));
print(JSON.stringify(startGuide));
assertTrue(startGuide.result.result.contents[0].text.indexOf("flow-search") !== -1 &&
	startGuide.result.result.contents[0].text.indexOf("nodeId") !== -1,
	"MCP Flow resources/read did not return semantic edit guidance");

var samplesGuide = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	config: {},
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1022,
			method: "resources/read",
			params: {
				uri: "flow://guide/samples"
			}
		})
	}
})));
assertTrue(samplesGuide.result.result.contents[0].text.indexOf("sample_blocks_flow_and_rhino") !== -1 &&
	samplesGuide.result.result.contents[0].text.indexOf("sample.formatGreeting") !== -1 &&
	samplesGuide.result.result.contents[0].text.indexOf("sample.sha256") !== -1,
	"MCP Flow samples guide did not point to real sample sources");

var sampleFlowCode = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1023,
			method: "tools/call",
			params: {
				name: "code-get",
				arguments: {
					projectDir: projectDir,
					qname: "sample_blocks_flow_and_rhino"
				}
			}
		})
	}
})));
assertTrue(sampleFlowCode.result.result.structuredContent.code.indexOf("const _flow") !== -1 &&
	sampleFlowCode.result.result.structuredContent.code.indexOf("Only call Flow blocks with one object containing named parameters") !== -1,
	"MCP Flow code-get did not expose the executable sample FlowScript");

var sampleFlowBlockCode = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1024,
			method: "tools/call",
			params: {
				name: "code-get",
				arguments: {
					projectDir: projectDir,
					block: "sample.formatGreeting"
				}
			}
		})
	}
})));
assertTrue(sampleFlowBlockCode.result.result.structuredContent.code.indexOf("function sample_formatGreeting") !== -1,
	"MCP Flow code-get did not expose the FlowScript sample block");

var sampleRhinoBlockCode = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1025,
			method: "tools/call",
			params: {
				name: "code-get",
				arguments: {
					projectDir: projectDir,
					block: "sample.sha256"
				}
			}
		})
	}
})));
assertTrue(sampleRhinoBlockCode.result.result.structuredContent.code.indexOf("Use Rhino 1.9.0 features") !== -1 &&
	sampleRhinoBlockCode.result.result.structuredContent.code.indexOf("Packages.java.security.MessageDigest") !== -1,
	"MCP Flow code-get did not expose the Rhino sample block");

var guideResourceSearch = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1021,
			method: "tools/call",
			params: {
				name: "flow-resource-search",
				arguments: {
					projectDir: projectDir,
					query: "Flow Authoring Cycle",
					doc: false,
					hints: false
				}
			}
		})
	}
})));
assertTrue(guideResourceSearch.result.result.structuredContent.resources.some(function (resource) {
	return resource.path === "libs/flow/resources/guide/authoring.md";
}), "MCP Flow guides should be searchable as project resources");

var targetDir = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"),
	"lib_flow_mcp_target_" + java.lang.System.currentTimeMillis());
targetDir.mkdirs();
var targetProjectDir = String(targetDir.getAbsolutePath());
function callTool(id, name, args) {
	return JSON.parse(engine.run(JSON.stringify({
		flowSource: mcpFlowSource,
		includeTrace: false,
		input: {
			request: JSON.stringify({
				jsonrpc: "2.0",
				id: id,
				method: "tools/call",
				params: {
					name: name,
					arguments: args
				}
			})
		}
	})));
}

var authoringPalette = callTool(136, "authoring-palette", {
	projectDir: targetProjectDir,
	engineSource: "version: 1\n",
	focusPath: "engine"
});
assertTrue(authoringPalette.result.result.structuredContent.ok === true &&
	authoringPalette.result.result.structuredContent.items.some(function (item) {
		return item.id === "frontbuilder.svelte.builder";
	}),
	"MCP authoring-palette did not dispatch to the generic engine authoring contract");
var frontendSveltePalette = callTool(137, "frontend-svelte-palette", {
	projectDir: targetProjectDir,
	engineSource: "version: 1\n",
	focusPath: "engine"
});
assertTrue(frontendSveltePalette.result.result.structuredContent.ok === true &&
	frontendSveltePalette.result.result.structuredContent.surface === "frontend" &&
	frontendSveltePalette.result.result.structuredContent.builder === "svelte" &&
	frontendSveltePalette.result.result.structuredContent.items.some(function (item) {
		return item.id === "frontbuilder.svelte.builder";
	}),
	"MCP frontend-svelte-palette did not dispatch to the Svelte authoring contract");
var frontendSvelteActions = callTool(138, "frontend-svelte-actions", {
	projectDir: targetProjectDir,
	engineSource: "version: 1\n"
});
assertTrue(frontendSvelteActions.result.result.structuredContent.ok === true &&
	frontendSvelteActions.result.result.structuredContent.protocol === "flow.studio.menu.v1",
	"MCP frontend-svelte-actions did not dispatch to the dynamic context menu contract");
var frontendPageFile = new java.io.File(targetDir,
	"libs/flow/frontbuilder/svelte/model/Smoke/src/routes/+page.flow.svelte");
frontendPageFile.getParentFile().mkdirs();
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var frontendSvelteMutate = callTool(139, "frontend-svelte-mutate", {
	projectDir: targetProjectDir,
	sourceFile: String(frontendPageFile.getAbsolutePath()),
	mutation: {
		op: "insert",
		path: "frontAst.slots.structure.children",
		index: "end",
		value: {
			id: "smokeText",
			kind: "text",
			tag: "Text",
			text: "Smoke text"
		}
	}
});
assertTrue(frontendSvelteMutate.result.result.structuredContent.ok === true &&
	frontendSvelteMutate.result.result.structuredContent.written === true &&
	String(Packages.org.apache.commons.io.FileUtils.readFileToString(frontendPageFile, "UTF-8")).indexOf("Smoke text") !== -1,
	"MCP frontend-svelte-mutate should persist source-backed mutations");
var frontendSvelteCreate = callTool(140, "frontend-svelte-mutate", {
	projectDir: targetProjectDir,
	focusPath: "frontends.svelte.catalog.target.project.uiBlocks",
	mutation: {
		op: "insert",
		value: {
			__frontendCreateSource: {
				baseId: "project.smokeFlowUi",
				directory: "components/${namespacePath}",
				fileName: "${tag}.flow.svelte",
				source: [
					"<script module>",
					"  export const _meta = {",
					"    id: \"${id}\",",
					"    tag: \"${tag}\",",
					"    runtime: \"flow-svelte\",",
					"    insert: { id: \"${localName}\", kind: \"${localName}\", tag: \"${tag}\" }",
					"  };",
					"</script>",
					""
				].join("\n")
			}
		}
	}
});
var frontendCreatedFile = new java.io.File(targetDir,
	"libs/flow/frontbuilder/svelte/components/project/SmokeFlowUi.flow.svelte");
assertTrue(frontendSvelteCreate.result.result.structuredContent.created === true &&
	frontendSvelteCreate.result.result.structuredContent.written === true &&
	frontendCreatedFile.isFile(),
	"MCP frontend-svelte-mutate should create source-backed frontend blocks from palette payloads");
var frontendRouteRoot = new java.io.File(targetDir, "libs/flow/frontbuilder/svelte/model/Smoke/src/routes");
var frontendRouteSegment = mcpLib.createFrontendSource({
	projectDir: targetProjectDir,
	mutation: {
		value: {
			__frontendCreateSource: {
				baseId: "detail",
				directory: "${targetRouteDirectory}/${localName}",
				directoryOnly: true,
				targetSourcePath: String(frontendRouteRoot.getAbsolutePath()),
				markerFile: ".flow-route.json",
				markerSource: "{\n  \"kind\": \"segment\"\n}\n"
			}
		}
	}
});
var frontendDetailDir = new java.io.File(frontendRouteRoot, "detail");
assertTrue(frontendRouteSegment.created === true &&
	frontendRouteSegment.written === true &&
	new java.io.File(frontendDetailDir, ".flow-route.json").isFile(),
	"MCP frontend source creation should create route segment folders from targetSourcePath");
var frontendRoutePage = mcpLib.createFrontendSource({
	projectDir: targetProjectDir,
	mutation: {
		value: {
			__frontendCreateSource: {
				baseId: "detailPage",
				directory: "${targetRouteDirectory}",
				fileName: "+page.flow.svelte",
				targetSourcePath: String(frontendDetailDir.getAbsolutePath()),
				source: [
					"<script module>",
					"  export const _flow = {",
					"    page: {",
					"      id: \"${localName}\",",
					"      title: \"${LocalName}\"",
					"    }",
					"  };",
					"</script>",
					"",
					"<FlowComponent id=\"${localName}\" label=\"${LocalName}\">",
					"  <Structure />",
					"</FlowComponent>",
					""
				].join("\n")
			}
		}
	}
});
var frontendDetailPageFile = new java.io.File(frontendDetailDir, "+page.flow.svelte");
var frontendDetailPageSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(frontendDetailPageFile, "UTF-8"));
assertTrue(frontendRoutePage.created === true &&
	frontendRoutePage.written === true &&
	frontendDetailPageFile.isFile() &&
	frontendDetailPageSource.indexOf("route:") === -1,
	"MCP frontend source creation should create route pages in the selected route folder without hard-coded route metadata");

var targetFlowCode = [
	"const _flow = {",
	"  inputs: {",
	"    target: { type: \"string\", description: \"Target value.\", default: \"ok\" }",
	"  },",
	"  tests: {",
	"    smoke: { input: { target: \"ok\" } }",
	"  }",
	"}",
	"",
	"function TargetSmoke({ input, config, result }) {",
	"  // Only call Flow blocks with one object containing named parameters.",
	"  var items = [\"b\", \"a\"]",
	"  var sorted = list.sort({ items: items, by: current, direction: \"asc\" })",
	"  result.target = input.target",
	"  result.first = sorted[0]",
	"  return result",
	"}",
	""
].join("\n");
var codeSet = callTool(3, "code-set", {
	projectDir: targetProjectDir,
	name: "TargetSmoke",
	code: targetFlowCode
});
print(JSON.stringify(codeSet));
assertTrue(codeSet.result.result.structuredContent.ok === true &&
	codeSet.result.result.structuredContent.diagnostics.length === 0,
	"MCP Flow code-set did not accept a target projectDir working copy");

var codeCheck = callTool(4, "code-check", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
assertTrue(codeCheck.result.result.structuredContent.ok === true,
	"MCP Flow code-check did not validate the working copy");

var codeRun = callTool(5, "code-run", {
	projectDir: targetProjectDir,
	name: "TargetSmoke",
	input: {
		target: "ok"
	}
});
print(JSON.stringify(codeRun));
assertTrue(codeRun.result.result.structuredContent.result.target === "ok" &&
	codeRun.result.result.structuredContent.result.first === "a",
	"MCP Flow code-run did not execute the working copy");

var codePromote = callTool(6, "code-promote", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
print(JSON.stringify(codePromote));
assertTrue(codePromote.result.result.structuredContent.ok === true,
	"MCP Flow code-promote did not save the working copy");

var targetFile = new java.io.File(targetDir, "libs/flows/TargetSmoke.flow.js");
assertTrue(targetFile.isFile(), "MCP Flow code-promote did not write the target FlowScript");

var codeGet = callTool(7, "code-get", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
assertTrue(codeGet.result.result.structuredContent.code.indexOf("function TargetSmoke") !== -1 &&
	codeGet.result.result.structuredContent.code.indexOf("description: \"Target value.\"") !== -1,
	"MCP Flow code-get did not return the saved FlowScript");

var listTarget = callTool(8, "flow-list", {
	projectDir: targetProjectDir
});
assertTrue(listTarget.result.result.structuredContent.flows.some(function (flow) {
	return flow.name === "TargetSmoke";
}), "MCP Flow flow-list did not use the target projectDir");

var searchTarget = callTool(9, "flow-search", {
	projectDir: targetProjectDir,
	query: "result.target",
	kinds: ["node"],
	context: 1
});
assertTrue(searchTarget.result.result.structuredContent.matches.some(function (match) {
	return match.flow === "TargetSmoke";
}), "MCP Flow flow-search did not find the target FlowScript");

var treeTarget = callTool(10, "flow-tree", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
assertTrue(treeTarget.result.result.structuredContent.children[0].name === "flow",
	"MCP Flow flow-tree did not describe the named target FlowScript");

var schemaTarget = callTool(11, "flow-output-schema", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
assertTrue(schemaTarget.result.result.structuredContent.schema.properties.target.type === "string",
	"MCP Flow flow-output-schema did not expose the target result schema");
var schemaTargetFull = callTool(110, "flow-output-schema", {
	projectDir: targetProjectDir,
	name: "TargetSmoke",
	detail: "full"
});
assertTrue(schemaTargetFull.result.result.structuredContent.sources.static.available === true &&
	schemaTargetFull.result.result.structuredContent.sources.effective.schema.properties.target.type === "string",
	"MCP Flow flow-output-schema did not expose full source details");

var inlineTemplateSource = [
	"version: 1",
	"nodes:",
	"  - id: sourcePerson",
	"    block: set",
	"    path: local.person",
	"    value:",
	"      name: Ada",
	"      age: 36",
	"  - id: buildCard",
	"    block: json.object",
	"    out: result.card",
	"    fields:",
	"      - id: fieldAge",
	"        block: json.field",
	"        key: age",
	"        value: \"{{ local.person.age }}\"",
	""
].join("\n");
var inlineTemplateRun = callTool(113, "flow-test", {
	projectDir: targetProjectDir,
	flowSource: inlineTemplateSource,
	includeFullResult: true,
	detail: "full"
});
assertTrue(inlineTemplateRun.result.result.structuredContent.result.card.age === 36,
	"MCP Flow flow-test rendered nested flowSource templates before execution");
var inlineTemplateSchema = callTool(114, "flow-output-schema", {
	projectDir: targetProjectDir,
	flowSource: inlineTemplateSource,
	detail: "full"
});
assertTrue(inlineTemplateSchema.result.result.structuredContent.schema.properties.card.properties.age.type === "integer",
	"MCP Flow flow-output-schema rendered nested flowSource templates before analysis");

var nodeSchemaSource = [
	"version: 1",
	"nodes:",
	"  - id: sourceItems",
	"    block: set",
	"    path: local.items",
	"    value:",
	"      - city: Paris",
	"        temperature: 36",
	"  - id: copyItems",
	"    block: set",
	"    path: result.items",
	"    value: \"{{ local.items }}\"",
	""
].join("\n");
var nodeSchemaTarget = callTool(111, "flow-node-output-schema", {
	projectDir: targetProjectDir,
	flowSource: nodeSchemaSource,
	nodeId: "sourceItems",
	detail: "full"
});
assertTrue(nodeSchemaTarget.result.result.structuredContent.target.property === "path" &&
	nodeSchemaTarget.result.result.structuredContent.schema.type === "array" &&
	nodeSchemaTarget.result.result.structuredContent.schema.items.properties.city.type === "string",
	"MCP Flow flow-node-output-schema did not expose the node output schema");
var nodePointerSchemaTarget = callTool(112, "flow-node-output-schema", {
	projectDir: targetProjectDir,
	flowSource: nodeSchemaSource,
	nodePointer: "/nodes/0",
	detail: "full"
});
assertTrue(nodePointerSchemaTarget.result.result.structuredContent.target.nodePointer === "/nodes/0" &&
	nodePointerSchemaTarget.result.result.structuredContent.schema.items.properties.temperature.type === "integer",
	"MCP Flow flow-node-output-schema did not accept a node pointer");
var adoptNodeSchemaTarget = callTool(115, "flow-node-output-schema", {
	projectDir: targetProjectDir,
	flowName: "NodeSchemaAdoptSmoke",
	flowSource: nodeSchemaSource,
	nodeId: "sourceItems",
	action: "adopt",
	schema: {
		type: "array",
		items: {
			type: "object",
			properties: {
				city: { type: "string" },
				temperature: { type: "number" },
				source: { type: "string" }
			}
		}
	}
});
assertTrue(adoptNodeSchemaTarget.result.result.structuredContent.action === "adopt" &&
	adoptNodeSchemaTarget.result.result.structuredContent.source === "schema",
	"MCP Flow flow-node-output-schema did not adopt a manual node schema");
var learnedNodeSchemaTarget = callTool(116, "flow-node-output-schema", {
	projectDir: targetProjectDir,
	flowName: "NodeSchemaAdoptSmoke",
	flowSource: nodeSchemaSource,
	nodeId: "sourceItems",
	source: "learned",
	detail: "full"
});
assertTrue(learnedNodeSchemaTarget.result.result.structuredContent.source === "learned" &&
	learnedNodeSchemaTarget.result.result.structuredContent.schema.items.properties.source.type === "string",
	"MCP Flow flow-node-output-schema did not read the adopted node schema");
var removeNodeSchemaTarget = callTool(117, "flow-node-output-schema", {
	projectDir: targetProjectDir,
	flowName: "NodeSchemaAdoptSmoke",
	flowSource: nodeSchemaSource,
	nodeId: "sourceItems",
	action: "remove"
});
assertTrue(removeNodeSchemaTarget.result.result.structuredContent.action === "remove" &&
	removeNodeSchemaTarget.result.result.structuredContent.deleted === true,
	"MCP Flow flow-node-output-schema did not remove the adopted node schema");

var adoptTargetSchema = callTool(101, "flow-output-schema", {
	projectDir: targetProjectDir,
	name: "TargetSmoke",
	action: "adopt",
	source: "static"
});
print(JSON.stringify(adoptTargetSchema));
assertTrue(adoptTargetSchema.result.result.structuredContent.action === "adopt" &&
	adoptTargetSchema.result.result.structuredContent.written.file.indexOf("TargetSmoke.flow.js") !== -1,
	"MCP Flow flow-output-schema did not adopt _flow.outputs");

var adoptedTargetCode = callTool(102, "code-get", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
assertTrue(adoptedTargetCode.result.result.structuredContent.code.indexOf("outputs") !== -1 &&
	adoptedTargetCode.result.result.structuredContent.code.indexOf("target") !== -1,
	"MCP Flow flow-output-schema adopt did not write outputs in FlowScript metadata");

var adoptedSchemaTarget = callTool(103, "flow-output-schema", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
assertTrue(adoptedSchemaTarget.result.result.structuredContent.declared === true &&
	adoptedSchemaTarget.result.result.structuredContent.source === "declared",
	"MCP Flow flow-output-schema did not read the adopted _flow.outputs contract");

var removeTargetSchema = callTool(104, "flow-output-schema", {
	projectDir: targetProjectDir,
	name: "TargetSmoke",
	action: "remove"
});
assertTrue(removeTargetSchema.result.result.structuredContent.action === "remove",
	"MCP Flow flow-output-schema did not remove _flow.outputs");

var removedTargetCode = callTool(105, "code-get", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
assertTrue(removedTargetCode.result.result.structuredContent.code.indexOf("outputs") === -1,
	"MCP Flow flow-output-schema remove left outputs in FlowScript metadata");

var targetSchemaDir = new java.io.File(targetDir, "libs/flow/schemas/TargetSmoke");
targetSchemaDir.mkdirs();
var targetLearnedResultFile = new java.io.File(targetSchemaDir, "result.out.schema.json");
Packages.org.apache.commons.io.FileUtils.writeStringToFile(targetLearnedResultFile, JSON.stringify({
	type: "object",
	properties: {
		learnedOnly: { type: "string" }
	}
}, null, 2), "UTF-8");
assertTrue(targetLearnedResultFile.isFile(),
	"MCP Flow smoke did not create a learned result schema fixture");
var learnedBeforeReset = callTool(106, "flow-output-schema", {
	projectDir: targetProjectDir,
	name: "TargetSmoke",
	source: "learned"
});
assertTrue(learnedBeforeReset.result.result.structuredContent.source === "learned" &&
	learnedBeforeReset.result.result.structuredContent.schema.properties.learnedOnly.type === "string",
	"MCP Flow flow-output-schema did not read the learned result schema fixture");
var resetTargetSchema = callTool(107, "flow-output-schema", {
	projectDir: targetProjectDir,
	name: "TargetSmoke",
	action: "reset"
});
assertTrue(resetTargetSchema.result.result.structuredContent.action === "reset" &&
	resetTargetSchema.result.result.structuredContent.reset === "learned" &&
	resetTargetSchema.result.result.structuredContent.deleted === true &&
	!targetLearnedResultFile.isFile(),
	"MCP Flow flow-output-schema reset did not delete learned result schemas");

var customBlockCode = [
	"const _meta = {",
	"  \"version\": 1,",
	"  \"description\": \"Project-local smoke block.\",",
	"  \"icon\": \"mdi:message-outline\",",
	"  \"properties\": {",
	"    \"text\": { \"kind\": \"template\", \"type\": \"string\", \"description\": \"Text to echo.\" }",
	"  },",
	"  \"outputs\": {",
	"    \"out\": { \"type\": \"string\" }",
	"  }",
	"}",
	"",
	"function smoke_echo({ input, config, result }) {",
	"  // Only call Flow blocks with one object containing named parameters.",
	"  return input.text",
	"}",
	""
].join("\n");
var blockSet = callTool(12, "code-set", {
	projectDir: targetProjectDir,
	block: "smoke.echo",
	code: customBlockCode,
	overwrite: true
});
print(JSON.stringify(blockSet));
assertTrue(blockSet.result.result.structuredContent.name === "smoke.echo" &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke/echo.block.js").isFile(),
	"MCP Flow code-set did not write a canonical project-local block");

var candidateDecisionSet = callTool(135, "code-set", {
	projectDir: targetProjectDir,
	name: "CandidateDecisionSmoke",
	code: [
		"function CandidateDecisionSmoke({ input, config, result }) {",
		"  var item = domain.fetchWeatherItem({ zone: input.zone, forecastUrl: config.services.weather.forecastUrl })",
		"  result.item = item",
		"  return result",
		"}",
		""
	].join("\n"),
	maxDiagnostics: 5
});
var candidateDecisionStructured = candidateDecisionSet.result.result.structuredContent;
var candidateDecisionDiagnostics = candidateDecisionStructured.diagnostics ||
	candidateDecisionStructured.error && candidateDecisionStructured.error.diagnostics ||
	[];
assertTrue(candidateDecisionStructured.ok === false &&
	candidateDecisionDiagnostics.some(function (diagnostic) {
	return diagnostic.code === "UNKNOWN_BLOCK" &&
		diagnostic.candidateDecision &&
		diagnostic.candidateDecision.recommendation === "mock" &&
		diagnostic.candidateDecision.bestScore < diagnostic.candidateDecision.preferExistingScore &&
		diagnostic.candidates &&
		diagnostic.candidates[0] &&
		diagnostic.candidates[0].score > 0 &&
		diagnostic.create &&
		diagnostic.create.tool === "flow-block-mock" &&
		diagnostic.create.candidateTool === "flow-block-get";
}), "MCP Flow code-set did not expose scored UNKNOWN_BLOCK mock guidance");

var blockGet = callTool(13, "code-get", {
	projectDir: targetProjectDir,
	block: "smoke.echo"
});
assertTrue(blockGet.result.result.structuredContent.code.indexOf("function smoke_echo") !== -1 &&
	(blockGet.result.result.structuredContent.format === "blockjs" ||
		blockGet.result.result.structuredContent.format === "flowscript"),
	"MCP Flow code-get did not read the project-local block");

var mockSet = callTool(132, "flow-block-mock", {
	projectDir: targetProjectDir,
	name: "smoke.todoWeather",
	properties: {
		city: { kind: "template", type: "string", description: "City name." }
	},
	outputs: {
		out: {
			type: "object",
			properties: {
				city: { type: "string" },
				temperature: { type: "number" },
				unit: { type: "string" }
			}
		}
	},
	overwrite: true
});
print(JSON.stringify(mockSet));
var mockStructured = mockSet.result.result.structuredContent;
assertTrue(mockStructured.ok === true &&
	mockStructured.mock === true &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke/todoWeather.block.js").isFile(),
	"MCP Flow flow-block-mock did not write a canonical project-local mock block");
assertTrue((mockStructured.warnings || []).some(function (warning) {
	return warning.code === "FLOW_BLOCK_MOCK_CREATED";
}), "MCP Flow flow-block-mock did not return an explicit mock warning");

var mockGet = callTool(133, "code-get", {
	projectDir: targetProjectDir,
	block: "smoke.todoWeather",
	detail: "full"
});
var mockContent = JSON.stringify(mockGet.result.result.structuredContent);
assertTrue(mockContent.indexOf("\"mock\":true") !== -1 &&
	mockContent.indexOf("TODO: replace this explicit mock") !== -1,
	"MCP Flow code-get did not expose mock metadata and TODO source");

var mockList = callTool(134, "flow-block-mock-list", {
	projectDir: targetProjectDir
});
assertTrue(mockList.result.result.structuredContent.count >= 1 &&
	mockList.result.result.structuredContent.mocks.some(function (mock) {
		return mock.block === "smoke.todoWeather";
	}),
	"MCP Flow flow-block-mock-list did not report generated mock blocks");

var invalidBlockQName = callTool(131, "code-get", {
	projectDir: targetProjectDir,
	qname: "blocks.smoke.echo"
});
assertTrue(invalidBlockQName.result.error &&
	invalidBlockQName.result.error.data &&
	invalidBlockQName.result.error.data.code === "INVALID_CODE_QNAME",
	"MCP Flow code-get should reject block names passed as qname");

var resourceSearch = callTool(14, "flow-resource-search", {
	projectDir: targetProjectDir,
	query: "Project-local smoke",
	doc: false,
	hints: false
});
assertTrue(resourceSearch.result.result.structuredContent.resources.some(function (resource) {
	return resource.path === "libs/flow/blocks/smoke/echo.block.js";
}), "MCP Flow flow-resource-search did not find the custom block source");
