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

var customBlockSource = [
	"(function () {",
	"\treturn {",
	"\t\tname: \"smoke.echo\",",
	"\t\tcatalog: function () {",
	"\t\t\treturn {",
	"\t\t\t\tname: \"smoke.echo\",",
	"\t\t\t\tprops: {},",
	"\t\t\t\tdescription: \"Project-local smoke block.\"",
	"\t\t\t};",
	"\t\t},",
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
					source: customBlockSource
				}
			}
		})
	}
})));
print(JSON.stringify(blockCreate));
assertTrue(blockCreate.result.result.structuredContent.name === "smoke.echo" &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke.echo.js").isFile(),
	"MCP Flow flow-block-create did not write a project-local block");

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
assertTrue(blockDuplicate.result.result.structuredContent.name === "smoke.set" &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke.set.js").isFile(),
	"MCP Flow flow-block-duplicate did not copy a visible block");

var editedBlockSource = customBlockSource.replace("Project-local smoke block.", "Edited project-local smoke block.");
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
					source: editedBlockSource
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
				name: "flow-block-get",
				arguments: {
					projectDir: targetProjectDir,
					name: "smoke.echo"
				}
			}
		})
	}
})));
print(JSON.stringify(blockGet));
assertTrue(blockGet.result.result.structuredContent.source.indexOf("Edited project-local smoke block.") !== -1,
	"MCP Flow flow-block-get did not read the edited project-local block");

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

var customTypeSource = [
	"(function () {",
	"\treturn {",
	"\t\tname: \"custom.note\",",
	"\t\tlabel: \"Custom note\",",
	"\t\ttype: \"string\",",
	"\t\tdescription: \"Project-local smoke test type.\"",
	"\t};",
	"}())",
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
					source: customTypeSource
				}
			}
		})
	}
})));
print(JSON.stringify(typeCreate));
assertTrue(typeCreate.result.result.structuredContent.name === "custom.note" &&
	new java.io.File(targetDir, "libs/flow/types/custom.note.js").isFile(),
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
