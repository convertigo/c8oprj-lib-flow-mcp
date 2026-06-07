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

var mcpFlowSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flows/McpServer.flow.yaml"), "UTF-8"));
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
assertTrue(mcpFlowSource.indexOf("block: fragment.use") === -1 &&
	mcpFlowSource.indexOf("block: mcp.flow") === -1 &&
	mcpFlowSource.indexOf("block: mcp.batch") !== -1 &&
	mcpFlowSource.indexOf("block: mcp.handle") !== -1,
	"McpServer flow should route through graph composite MCP blocks");
assertTrue(batchBlockSource.indexOf("runtime\": \"flow\"") !== -1 &&
	/\bforEach\s*\(/.test(batchBlockSource) &&
	handleBlockSource.indexOf("mcp.tools.call") !== -1 &&
	handleBlockSource.indexOf("mcp.resources.read") !== -1 &&
	toolsCallBlockSource.indexOf("runtime\": \"rhino\"") !== -1 &&
	toolsCallBlockSource.indexOf("TOOL_PREFIX") !== -1 &&
	toolsCallBlockSource.indexOf("mcp.tools.call.inspect") === -1 &&
	toolsAvailableBlockSource.indexOf("runtime\": \"rhino\"") !== -1 &&
	toolsAvailableBlockSource.indexOf("TOOL_PREFIX") !== -1 &&
	toolsAvailableBlockSource.indexOf("name: \"flow-catalog\"") === -1 &&
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
	return tool.name === "flow-run";
}), "MCP Flow tools/list did not expose flow-run");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-search";
}), "MCP Flow tools/list did not expose flow-search");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-block-duplicate";
}) && list.result.result.tools.some(function (tool) {
	return tool.name === "flow-block-edit";
}), "MCP Flow tools/list did not expose block duplicate/edit");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-resource-patch";
}), "MCP Flow tools/list did not expose resource patching");
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
						limit: 200
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
assertTrue(typeGet.result.result.structuredContent.descriptor.editor.file === "engine:types/editors/expression.html",
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

var run = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: {
				name: "flow-run",
				arguments: {
					flowSource: [
						"version: 1",
						"nodes:",
						"  - id: hello",
						"    block: set",
						"    path: result.message",
						"    value: Hello from Flow MCP",
						""
					].join("\n")
				}
			}
		})
	}
})));
print(JSON.stringify(run));
assertTrue(run.result.result.structuredContent.result.message === "Hello from Flow MCP",
	"MCP Flow flow-run did not execute a simple flow");

var targetDir = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"),
	"lib_flow_mcp_target_" + java.lang.System.currentTimeMillis());
targetDir.mkdirs();
var targetProjectDir = String(targetDir.getAbsolutePath());
var set = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 3,
			method: "tools/call",
			params: {
				name: "flow-set",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke",
					flowSource: [
						"version: 1",
						"nodes:",
						"  - id: target",
						"    block: set",
						"    path: result.target",
						"    value: ok",
						""
					].join("\n")
				}
			}
		})
	}
})));
print(JSON.stringify(set));
assertTrue(set.result.result.structuredContent.ok === true,
	"MCP Flow flow-set did not accept a target projectDir");

var targetFile = new java.io.File(targetDir, "libs/flows/TargetSmoke.flow.yaml");
assertTrue(targetFile.isFile(), "MCP Flow flow-set did not write to the target projectDir");

var getTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 301,
			method: "tools/call",
			params: {
				name: "flow-get",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke"
				}
			}
		})
	}
})));
print(JSON.stringify(getTarget));
var targetDefinition = getTarget.result.result.structuredContent.definition;
assertTrue(targetDefinition.nodes[0].id === "target",
	"MCP Flow flow-get did not return the parsed definition");
targetDefinition.nodes.push({
	id: "modelRoundTrip",
	block: "set",
	path: "result.modelRoundTrip",
	value: "definition"
});
var setDefinitionTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 302,
			method: "tools/call",
			params: {
				name: "flow-set",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke",
					definition: targetDefinition
				}
			}
		})
	}
})));
print(JSON.stringify(setDefinitionTarget));
assertTrue(setDefinitionTarget.result.result.structuredContent.analysis.writes.indexOf("result.modelRoundTrip") !== -1,
	"MCP Flow flow-set did not accept flow-get.definition");

var listTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 4,
			method: "tools/call",
			params: {
				name: "flow-list",
				arguments: {
					projectDir: targetProjectDir
				}
			}
		})
	}
})));
print(JSON.stringify(listTarget));
assertTrue(listTarget.result.result.structuredContent.flows.some(function (flow) {
	return flow.name === "TargetSmoke";
}), "MCP Flow flow-list did not use the target projectDir");

var searchTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 5,
			method: "tools/call",
			params: {
				name: "flow-search",
				arguments: {
					projectDir: targetProjectDir,
					query: "result.target",
					kinds: ["node"],
					context: 1,
					doc: false,
					hints: false
				}
			}
		})
	}
})));
print(JSON.stringify(searchTarget));
assertTrue(searchTarget.result.result.structuredContent.matches[0].flow === "TargetSmoke" &&
	searchTarget.result.result.structuredContent.matches[0].path === "/nodes/0",
	"MCP Flow flow-search did not find a target Flow node");

var treeTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 6,
			method: "tools/call",
			params: {
				name: "flow-tree",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke"
				}
			}
		})
	}
})));
print(JSON.stringify(treeTarget));
assertTrue(treeTarget.result.result.structuredContent.children[0].name === "flow",
	"MCP Flow flow-tree did not describe the named target flow");

var editTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 7,
			method: "tools/call",
			params: {
				name: "flow-edit",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke",
					mutation: {
						op: "insert",
						afterNodeId: "target",
						value: {
							id: "setEdited",
							block: "set",
							path: "result.edited",
							value: true
						}
					}
				}
			}
		})
	}
})));
print(JSON.stringify(editTarget));
assertTrue(editTarget.result.result.structuredContent.written &&
	editTarget.result.result.structuredContent.analysis.writes.indexOf("result.edited") !== -1,
	"MCP Flow flow-edit did not write a named flow mutation");

var nodeAddTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 701,
			method: "tools/call",
			params: {
				name: "flow-node-add",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke",
					id: "nodeAdd",
					block: "set",
					afterNodeId: "target",
					properties: {
						path: "result.nodeAdd",
						value: "added"
					}
				}
			}
		})
	}
})));
print(JSON.stringify(nodeAddTarget));
assertTrue(nodeAddTarget.result.result.structuredContent.analysis.writes.indexOf("result.nodeAdd") !== -1,
	"MCP Flow flow-node-add did not add a set node");

var nodeEditTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 702,
			method: "tools/call",
			params: {
				name: "flow-node-edit",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke",
					nodeId: "nodeAdd",
					property: "value",
					value: "edited"
				}
			}
		})
	}
})));
print(JSON.stringify(nodeEditTarget));
assertTrue(nodeEditTarget.result.result.structuredContent.source.indexOf("edited") !== -1,
	"MCP Flow flow-node-edit did not replace a node property");

var nodeDuplicateTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 703,
			method: "tools/call",
			params: {
				name: "flow-node-duplicate",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke",
					nodeId: "nodeAdd",
					newId: "nodeCopy",
					afterNodeId: "nodeAdd",
					properties: {
						path: "result.nodeCopy",
						value: "copy"
					}
				}
			}
		})
	}
})));
print(JSON.stringify(nodeDuplicateTarget));
assertTrue(nodeDuplicateTarget.result.result.structuredContent.analysis.writes.indexOf("result.nodeCopy") !== -1,
	"MCP Flow flow-node-duplicate did not create a patched copy");

var nodeMoveTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 704,
			method: "tools/call",
			params: {
				name: "flow-node-move",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke",
					nodeId: "nodeCopy",
					beforeNodeId: "target"
				}
			}
		})
	}
})));
print(JSON.stringify(nodeMoveTarget));
assertTrue(nodeMoveTarget.result.result.structuredContent.children[0].children[0].definition.indexOf("nodeCopy") !== -1,
	"MCP Flow flow-node-move did not move the node before the target");

var nodeDeleteTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 705,
			method: "tools/call",
			params: {
				name: "flow-node-delete",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke",
					nodeId: "nodeCopy"
				}
			}
		})
	}
})));
print(JSON.stringify(nodeDeleteTarget));
assertTrue(nodeDeleteTarget.result.result.structuredContent.analysis.writes.indexOf("result.nodeCopy") === -1,
	"MCP Flow flow-node-delete did not delete the duplicated node");

var nodeWrapperRun = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 706,
			method: "tools/call",
			params: {
				name: "flow-test",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke"
				}
			}
		})
	}
})));
print(JSON.stringify(nodeWrapperRun));
assertTrue(nodeWrapperRun.result.result.structuredContent.result.nodeAdd === "edited",
	"MCP Flow node wrappers did not produce the edited runtime value");

var schemaTarget = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 8,
			method: "tools/call",
			params: {
				name: "flow-output-schema",
				arguments: {
					projectDir: targetProjectDir,
					name: "TargetSmoke"
				}
			}
		})
	}
})));
print(JSON.stringify(schemaTarget));
assertTrue(schemaTarget.result.result.structuredContent.schema.properties.edited.type === "boolean",
	"MCP Flow flow-output-schema did not expose the edited result schema");

var customBlockDescriptorSource = [
	"version: 1",
	"name: smoke.echo",
	"description: Project-local smoke block.",
	"props: {}",
	"implementation:",
	"  runtime: rhino",
	"  file: echo.js",
	""
].join("\n");
var customBlockImplementationSource = [
	"(function () {",
	"\treturn {",
	"\t\trun: function () {",
	"\t\t\treturn \"ok\";",
	"\t\t}",
	"\t};",
	"}())",
	""
].join("\n");
var blockCreate = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 9,
			method: "tools/call",
			params: {
				name: "flow-block-create",
				arguments: {
					projectDir: targetProjectDir,
					name: "smoke.echo",
					descriptorSource: customBlockDescriptorSource,
					implementationSource: customBlockImplementationSource
				}
			}
		})
	}
})));
print(JSON.stringify(blockCreate));
assertTrue(blockCreate.result.result.structuredContent.blockId === "smoke.echo" &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke/echo.block.js").isFile() &&
	!new java.io.File(targetDir, "libs/flow/blocks/smoke/echo.block.yaml").isFile() &&
	!new java.io.File(targetDir, "libs/flow/blocks/smoke/echo.js").isFile(),
	"MCP Flow flow-block-create did not write a canonical project-local block");

var blockDuplicate = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 10,
			method: "tools/call",
			params: {
				name: "flow-block-duplicate",
				arguments: {
					projectDir: targetProjectDir,
					fromName: "set",
					toName: "smoke.set"
				}
			}
		})
	}
})));
print(JSON.stringify(blockDuplicate));
assertTrue(blockDuplicate.result.result.structuredContent.blockId === "smoke.set" &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke/set.block.js").isFile() &&
	!new java.io.File(targetDir, "libs/flow/blocks/smoke/set.block.yaml").isFile() &&
	!new java.io.File(targetDir, "libs/flow/blocks/smoke/set.js").isFile(),
	"MCP Flow flow-block-duplicate did not copy a visible block");

var editedBlockDescriptorSource = customBlockDescriptorSource.replace("Project-local smoke block.", "Edited project-local smoke block.");
var blockEdit = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 11,
			method: "tools/call",
			params: {
				name: "flow-block-edit",
				arguments: {
					projectDir: targetProjectDir,
					name: "smoke.echo",
					descriptorSource: editedBlockDescriptorSource
				}
			}
		})
	}
})));
print(JSON.stringify(blockEdit));
assertTrue(blockEdit.result.result.structuredContent.description === "Edited project-local smoke block.",
	"MCP Flow flow-block-edit did not update a project-local block");

var blockGet = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 12,
			method: "tools/call",
			params: {
					name: "flow-block-code-get",
				arguments: {
					projectDir: targetProjectDir,
					name: "smoke.echo"
				}
			}
		})
	}
})));
print(JSON.stringify(blockGet));
assertTrue(blockGet.result.result.structuredContent.code.indexOf("Edited project-local smoke block.") !== -1 &&
	blockGet.result.result.structuredContent.format === "blockjs",
		"MCP Flow flow-block-code-get did not read the edited project-local block");

var resourceSearch = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1201,
			method: "tools/call",
			params: {
				name: "flow-resource-search",
				arguments: {
					projectDir: targetProjectDir,
					query: "Edited smoke",
					doc: false,
					hints: false
				}
			}
		})
	}
})));
print(JSON.stringify(resourceSearch));
assertTrue(resourceSearch.result.result.structuredContent.resources.some(function (resource) {
	return resource.path === "libs/flow/blocks/smoke/echo.block.js";
}), "MCP Flow flow-resource-search did not find the custom block source");

var resourceGet = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1202,
			method: "tools/call",
			params: {
				name: "flow-resource-get",
				arguments: {
					projectDir: targetProjectDir,
					path: "libs/flow/blocks/smoke/echo.block.js"
				}
			}
		})
	}
})));
print(JSON.stringify(resourceGet));
var resourceHash = resourceGet.result.result.structuredContent.hash;
assertTrue(resourceHash && resourceGet.result.result.structuredContent.content.indexOf("Edited project-local smoke block.") !== -1,
	"MCP Flow flow-resource-get did not return content and hash");

var resourcePatch = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1203,
			method: "tools/call",
			params: {
				name: "flow-resource-patch",
				arguments: {
					projectDir: targetProjectDir,
					path: "libs/flow/blocks/smoke/echo.block.js",
					baseHash: resourceHash,
					patch: [
						"--- a/libs/flow/blocks/smoke/echo.block.js",
						"+++ b/libs/flow/blocks/smoke/echo.block.js",
						"@@ -1,7 +1,7 @@",
						" const _meta = {",
						"   \"version\": 1,",
						"-  \"description\": \"Edited project-local smoke block.\",",
						"+  \"description\": \"Patched project-local smoke block.\",",
						"   \"properties\": {},",
						"   \"runtime\": \"rhino\","
					].join("\n")
				}
			}
		})
	}
})));
print(JSON.stringify(resourcePatch));
assertTrue(resourcePatch.result.result.structuredContent.ok === true &&
	resourcePatch.result.result.structuredContent.validation.ok === true,
	"MCP Flow flow-resource-patch did not patch and validate the custom block source");

var patchedBlockGet = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 1204,
			method: "tools/call",
			params: {
					name: "flow-block-code-get",
				arguments: {
					projectDir: targetProjectDir,
					name: "smoke.echo"
				}
			}
		})
	}
})));
print(JSON.stringify(patchedBlockGet));
assertTrue(patchedBlockGet.result.result.structuredContent.code.indexOf("Patched project-local smoke block.") !== -1,
	"MCP Flow flow-resource-patch did not persist the patched custom block");

var typeList = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 13,
			method: "tools/call",
			params: {
				name: "flow-type-list",
				arguments: {
					projectDir: targetProjectDir
				}
			}
		})
	}
})));
print(JSON.stringify(typeList));
assertTrue(typeList.result.result.structuredContent.types.some(function (type) {
	return type.name === "path";
}), "MCP Flow flow-type-list did not expose core property types");
assertTrue(typeList.result.result.structuredContent.types.every(function (type) {
	return type.uses === undefined && typeof type.useCount === "number";
}), "MCP Flow flow-type-list should return compact type usage counts");

var customTypeSource = [
	"version: 1",
	"name: custom.note",
	"label: Custom note",
	"type: string",
	"description: Project-local smoke test type.",
	""
].join("\n");
var typeCreate = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 14,
			method: "tools/call",
			params: {
				name: "flow-type-create",
				arguments: {
					projectDir: targetProjectDir,
					name: "custom.note",
					descriptorSource: customTypeSource
				}
			}
		})
	}
})));
print(JSON.stringify(typeCreate));
assertTrue(typeCreate.result.result.structuredContent.name === "custom.note" &&
	new java.io.File(targetDir, "libs/flow/types/custom.note.type.yaml").isFile(),
	"MCP Flow flow-type-create did not write a project-local type");

var typeGet = JSON.parse(engine.run(JSON.stringify({
	flowSource: mcpFlowSource,
	includeTrace: false,
	input: {
		request: JSON.stringify({
			jsonrpc: "2.0",
			id: 15,
			method: "tools/call",
			params: {
				name: "flow-type-get",
				arguments: {
					projectDir: targetProjectDir,
					name: "custom.note"
				}
			}
		})
	}
})));
print(JSON.stringify(typeGet));
assertTrue(typeGet.result.result.structuredContent.descriptor.description === "Project-local smoke test type.",
	"MCP Flow flow-type-get did not return the custom type descriptor");
