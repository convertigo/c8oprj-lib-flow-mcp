var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/libs/flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var engineFile = new java.io.File(engineDir, "Engine.js");
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(engineFile, "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(source);
var smokeVerbose = java.lang.Boolean.getBoolean("flow.smoke.verbose") ||
	String(java.lang.System.getenv("FLOW_SMOKE_VERBOSE") || "").toLowerCase() === "true";

function debugPrint(value) {
	if (smokeVerbose) {
		print(value);
	}
}

function assertTrue(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

var fullSyncSchemaAttachSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/blocks/frontend/fullsync/schema.attach.block.js"), "UTF-8"));
var isolatedFullSyncSchemaAttach = eval(fullSyncSchemaAttachSource.substring(fullSyncSchemaAttachSource.indexOf("(function")));
var normalizedFullSyncSchema = isolatedFullSyncSchemaAttach.normalizeFullSyncSchema({
	type: "object",
	properties: {
		couchdb_output: {
			type: "object",
			properties: {
				rows: {
					type: "object",
					properties: {
						item: {
							type: "array",
							items: { type: "object", properties: { doc: { type: "object", properties: { name: { type: "object", properties: { text: { type: "string" }, attr: { type: "object" } } } } } } }
						},
						attr: { type: "object" }
					}
				},
				_c8oMeta: { type: "object" }
			}
		}
	}
});
assertTrue(normalizedFullSyncSchema.properties.rows.type === "array" &&
	normalizedFullSyncSchema.properties.rows.items.properties.doc.properties.name.type === "string" &&
	normalizedFullSyncSchema.properties._c8oMeta === undefined,
	"FullSync schema attachment did not normalize the XML transaction envelope to the PouchDB client contract");
var capturedFullSyncSchemaMutation = null;
var capturedFullSyncTreeRequest = null;
var capturedFullSyncSchemaRequest = null;
var resolvedFullSyncSchemaAttachment = isolatedFullSyncSchemaAttach.run({
	props: function () {
		return {
			sourceFile: "routes/+page.flow.svelte",
			actionId: "rootCategories",
			requestable: ".ReadCategories",
			projectDir: "/tmp/project",
			input: { _use_limit: 1 },
			out: "local.schemaAttachment"
		};
	},
	authoringTreeSource: function (request) {
		capturedFullSyncTreeRequest = request;
		var target = {
			type: "FullSyncView",
			sourceMutationPath: "frontAst.slots.structure.children[0]",
			definition: {
				id: "rootCategories"
			}
		};
		for (var depth = 0; depth < 24; depth++) {
			target = { type: "Children", children: [target] };
		}
		return { children: [target] };
	},
	requestableSchema: function (request) {
		capturedFullSyncSchemaRequest = request;
		return { ok: true, schema: { type: "object", properties: {} }, learned: true };
	},
	authoringMutateSource: function (request) {
		capturedFullSyncSchemaMutation = request;
		return { ok: true };
	},
	write: function () {}
}, {});
assertTrue(resolvedFullSyncSchemaAttachment.ok === true &&
	capturedFullSyncTreeRequest.internalDeep === true &&
	capturedFullSyncTreeRequest.maxDepth === 64 &&
	capturedFullSyncSchemaMutation.mutation.path === "frontAst.slots.structure.children[0].props.outputSchema" &&
	capturedFullSyncSchemaRequest.input._use_limit === 1 &&
	capturedFullSyncSchemaMutation.mutation.value.properties.rows.type === "array",
	"FullSync schema attachment did not resolve and execute a missing mutation path from the stable action id");
isolatedFullSyncSchemaAttach.run({
	props: function () {
		return {
			sourceFile: "routes/+page.flow.svelte",
			path: "frontAst.slots.structure.children[0].props.outputSchema",
			requestable: ".ReadProduct",
			projectDir: "/tmp/project",
			sampleDocId: "product-42",
			out: "local.schemaAttachment"
		};
	},
	requestableSchema: function (request) {
		capturedFullSyncSchemaRequest = request;
		return { ok: true, schema: { type: "object", properties: {} }, learned: true };
	},
	authoringMutateSource: function () {
		return { ok: true };
	},
	write: function () {}
}, {});
assertTrue(capturedFullSyncSchemaRequest.input._use_docid === "product-42",
	"FullSync schema attachment did not map sampleDocId to the safe Get request variable");
var fullSyncScaffoldSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/blocks/project/fullsync/scaffold.block.js"), "UTF-8"));
var isolatedFullSyncScaffold = eval(fullSyncScaffoldSource.substring(fullSyncScaffoldSource.indexOf("(function")));
assertTrue(isolatedFullSyncScaffold.canonicalVariableName("getView", "include_docs") === "_use_include_docs" &&
	isolatedFullSyncScaffold.canonicalVariableName("getView", "_use_startkey") === "_use_startkey" &&
	isolatedFullSyncScaffold.canonicalVariableName("postBulkDocuments", "documents") === "documents",
	"FullSync scaffold did not normalize CouchDB read query variables to Convertigo _use_ names");
assertTrue(isolatedFullSyncScaffold.designMismatches({
	_id: "_design/catalog",
	_rev: "1-live",
	views: { categories: { map: "function (doc) { emit(doc.type, doc); }" } }
}, {
	_id: "_design/catalog",
	views: { categories: { map: "function (doc) { emit(doc.type, doc); }" } }
}).length === 0 &&
	isolatedFullSyncScaffold.designMismatches({
		_id: "_design/catalog",
		views: { categories: { map: "stale" } }
	}, {
		_id: "_design/catalog",
		views: { categories: { map: "expected" } }
	})[0] === "views.categories.map",
	"FullSync readiness should compare the saved design contract with the live document while ignoring remote metadata");
var fullSyncViewWarnings = isolatedFullSyncScaffold.designWarnings([{
	name: "catalog",
	views: {
		itemsByParent: { map: "function (doc) { emit(String(doc.parents), doc); }" }
	}
}]);
assertTrue(fullSyncViewWarnings.length === 1 &&
	fullSyncViewWarnings[0].code === "FULLSYNC_VIEW_KEY_COERCION" &&
	fullSyncViewWarnings[0].field === "parents",
	"FullSync scaffold did not flag view keys that collapse multi-valued relations");

var mcpLibSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/lib/mcp.js"), "UTF-8"));
var mcpLib = eval(mcpLibSource);
var sanitizedCodePaths = mcpLib.sanitizeForMcp({
	codeFile: new java.io.File(projectDir, "libs/flows/Smoke.flow.js").getAbsolutePath(),
	workingCodeFile: new java.io.File(projectDir, "libs/flows/Smoke.flow.js").getAbsolutePath(),
	officialCodeFile: new java.io.File(projectDir, "libs/flows/Smoke.flow.js").getAbsolutePath()
}, {
	scopes: {
		request: {
			projectDir: projectDir
		}
	}
});
assertTrue(sanitizedCodePaths.codeFile === "libs/flows/Smoke.flow.js" &&
	sanitizedCodePaths.workingCodeFile === "libs/flows/Smoke.flow.js" &&
	sanitizedCodePaths.officialCodeFile === "libs/flows/Smoke.flow.js",
	"MCP should not expose absolute executable Flow working-copy paths");
var cleanFastSaveProject = { hasChanged: true };
var cleanFastSaveFlow = {
	hasChanged: true,
	bNew: true,
	isFlowSourceDirty: function () { return false; }
};
mcpLib._markFastSavedClean(cleanFastSaveProject, cleanFastSaveFlow, false, false);
assertTrue(cleanFastSaveFlow.hasChanged === false &&
	cleanFastSaveFlow.bNew === false &&
	cleanFastSaveProject.hasChanged === false,
	"MCP fast Flow save should clear only the dirty state introduced by registration");
var preDirtyFastSaveProject = { hasChanged: true };
var preDirtyFastSaveFlow = {
	hasChanged: true,
	bNew: false,
	isFlowSourceDirty: function () { return false; }
};
mcpLib._markFastSavedClean(preDirtyFastSaveProject, preDirtyFastSaveFlow, true, true);
assertTrue(preDirtyFastSaveFlow.hasChanged === true &&
	preDirtyFastSaveProject.hasChanged === true,
	"MCP fast Flow save should preserve pre-existing dirty state");
var isolatedPhaseBudget = mcpLib.phaseBudget({ timeoutMs: 50 }, "smoke-progress");
Packages.java.lang.Thread.sleep(60);
assertTrue(isolatedPhaseBudget.expired() === true,
	"MCP phase budget did not observe its response-generation deadline");
var isolatedPartialProgress = isolatedPhaseBudget.partial({ ok: true }, 1, "backend");
var resumedPhaseBudget = mcpLib.phaseBudget({ cursor: isolatedPartialProgress.nextCursor }, "smoke-progress");
assertTrue(isolatedPartialProgress.partial === true &&
	isolatedPartialProgress.warnings[0].code === "PARTIAL_RESULT_TIME_BUDGET" &&
	resumedPhaseBudget.phase === 1,
	"MCP phase budget did not produce a resumable progress checkpoint");
var normalizedProjectYaml = mcpLib._normalizeConvertigoYamlObjectHeaders([
	"↓Smoke [core.Project]:",
	"  ↓project [references.ProjectSchemaReference]:",
	"    projectName: lib_flow_engine",
	""
].join("\n"));
assertTrue(normalizedProjectYaml.indexOf("↓Smoke [core.Project]: \n") !== -1 &&
	normalizedProjectYaml.indexOf("  ↓project [references.ProjectSchemaReference]: \n") !== -1,
	"MCP should normalize empty Convertigo YAML object headers before rewriting c8oProject.yaml");
var normalizedFlowVersionYaml = mcpLib._normalizeConvertigoFlowProjectVersion([
	"↑convertigo: 8.0.0.m006",
	"↓Smoke [core.Project]: ",
	"  ↓GetFeed [flow.Flow]: 🗏 sequences/GetFeed.yaml",
	""
].join("\n"));
assertTrue(normalizedFlowVersionYaml.indexOf("↑convertigo: 8.5.0.m006\n") === 0,
	"MCP should bump Convertigo project version when Flow DBOs are declared");

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
debugPrint(JSON.stringify(list));
assertTrue(list.ok === true, "MCP Flow tools/list failed");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "code-run";
}), "MCP Flow tools/list did not expose code-run");
assertTrue(list.result.result.tools.some(function (tool) {
	return tool.name === "flow-search";
}), "MCP Flow tools/list did not expose flow-search");
var budgetedTool = list.result.result.tools.filter(function (tool) {
	return tool.name === "flow-resource-search";
})[0];
assertTrue(budgetedTool && budgetedTool.inputSchema.properties.answerBefore === undefined &&
	budgetedTool.inputSchema.properties.timeoutMs === undefined &&
	budgetedTool.inputSchema.properties.maxResponseKB === undefined &&
	budgetedTool.inputSchema.properties.minItems === undefined,
	"MCP tools/list exposed internal response budget controls to LLM clients");
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
	return tool.name === "flow-project-bootstrap";
}), "MCP Flow tools/list did not expose flow-project-bootstrap");
var fullSyncScaffoldTool = list.result.result.tools.filter(function (tool) {
	return tool.name === "flow-fullsync-scaffold";
})[0];
assertTrue(fullSyncScaffoldTool &&
	fullSyncScaffoldTool.inputSchema.properties.connector.type === "object" &&
	fullSyncScaffoldTool.inputSchema.properties.connector.properties.name.type === "string" &&
	fullSyncScaffoldTool.inputSchema.properties.transactions.items.properties.type.enum.indexOf("getView") !== -1,
	"MCP Flow tools/list did not expose the structured flow-fullsync-scaffold schema");
var appProgressTool = list.result.result.tools.filter(function (tool) {
	return tool.name === "flow-app-progress";
})[0];
assertTrue(appProgressTool && appProgressTool.inputSchema.properties.detail &&
	appProgressTool.inputSchema.properties.detail.enum.indexOf("compact") !== -1 &&
	appProgressTool.inputSchema.properties.detail.enum.indexOf("full") !== -1 &&
	appProgressTool.inputSchema.properties.mode.enum.indexOf("poc") !== -1 &&
	appProgressTool.inputSchema.properties.mode.enum.indexOf("hardening") !== -1,
	"MCP Flow tools/list did not expose flow-app-progress modes and detail");
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
assertTrue(["frontend-svelte-code-get", "frontend-svelte-code-check", "frontend-svelte-code-set", "frontend-svelte-code-patch"].every(function (name) {
	return list.result.result.tools.some(function (tool) { return tool.name === name; });
}), "MCP Flow tools/list did not expose whole-source Svelte authoring tools");
var unifiedCodeTools = {};
list.result.result.tools.forEach(function (tool) { unifiedCodeTools[tool.name] = tool; });
assertTrue(unifiedCodeTools["code-check"].inputSchema.properties.target.enum.indexOf("frontend") !== -1 &&
	unifiedCodeTools["code-set"].inputSchema.properties.finalize.type === "boolean" &&
	unifiedCodeTools["code-patch"].inputSchema.properties.target.enum.indexOf("backend") !== -1,
	"Unified code tools did not expose target-aware block implementation schemas");
var frontendSourceSetTool = list.result.result.tools.filter(function (tool) {
	return tool.name === "frontend-svelte-code-set";
})[0];
var frontendSourcePatchTool = list.result.result.tools.filter(function (tool) {
	return tool.name === "frontend-svelte-code-patch";
})[0];
assertTrue(frontendSourceSetTool.inputSchema.required[0] === "code" &&
	frontendSourcePatchTool.inputSchema.required.indexOf("revision") !== -1 &&
	frontendSourcePatchTool.inputSchema.required.indexOf("codepatch") !== -1 &&
	frontendSourcePatchTool.inputSchema.properties.codepatch.description.indexOf("numbered") !== -1 &&
	unifiedCodeTools["code-patch"].inputSchema.properties.codepatch.description.indexOf("numbered") !== -1,
	"MCP Flow tools/list should require complete source and revision-safe patches");
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
debugPrint(JSON.stringify(resources));
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/start";
}), "MCP Flow resources/list did not expose the start guide");
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/samples";
}), "MCP Flow resources/list did not expose the samples guide");
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/frontend-svelte";
}), "MCP Flow resources/list did not expose the Svelte frontend guide");
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/frontend-svelte-routing";
}), "MCP Flow resources/list did not expose the optional Svelte routing guide");
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/fullstack-paperboard";
}), "MCP Flow resources/list did not expose the full-stack paperboard guide");
assertTrue(resources.result.result.resources.some(function (resource) {
	return resource.uri === "flow://guide/portable-blocks";
}), "MCP Flow resources/list did not expose the portable block guide");

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
debugPrint(JSON.stringify(startGuide));
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
var targetFlowsDir = new java.io.File(targetDir, "libs/flows");
targetFlowsDir.mkdirs();
Packages.org.apache.commons.io.FileUtils.writeStringToFile(
	new java.io.File(targetFlowsDir, "TargetSmoke.flow.js"), targetFlowCode, "UTF-8");
function callTool(id, name, args) {
	if (name === "flow-app-progress" && args.mode === undefined) {
		args.mode = "hardening";
	}
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
var unusedBlockSet = callTool(135, "code-set", {
	projectDir: targetProjectDir,
	block: "smoke.unused",
	code: [
		"const _meta = { outputs: { out: { type: \"string\" } } }",
		"function unused() { return \"unused\" }",
		""
	].join("\n")
});
assertTrue(unusedBlockSet.result.result.structuredContent.ok === true,
	"MCP smoke setup should create the unused project block through the authoring API");

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
var appProgressEmpty = callTool(1391, "flow-app-progress", {
	projectDir: targetProjectDir
});
assertTrue(appProgressEmpty.result.result.structuredContent.ok === true &&
	appProgressEmpty.result.result.structuredContent.complete === false &&
	appProgressEmpty.result.result.structuredContent.partial === false &&
	appProgressEmpty.result.result.structuredContent.progressPhase === "action-required" &&
	appProgressEmpty.result.result.structuredContent.progress.total >= 5 &&
	appProgressEmpty.result.result.structuredContent.nextActions.length > 0 &&
	appProgressEmpty.result.result.structuredContent.recommendedCalls.some(function (call) {
		return call.tool === "flow-block-mock-list";
	}),
	"MCP flow-app-progress did not return a useful paperboard checklist");
var appProgressFullQName = callTool(13912, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	qname: "target.TargetSmoke",
	includeFrontend: false
});
assertTrue(appProgressFullQName.result.result.structuredContent.ok === true &&
	appProgressFullQName.result.result.structuredContent.tasks.some(function (task) {
		return task.id === "backendFlow" && task.done === true;
	}) && appProgressFullQName.result.result.structuredContent.backend.debt.unusedProjectBlocks.indexOf("smoke.unused") !== -1 &&
	appProgressFullQName.result.result.structuredContent.recommendedCalls.length === 0,
	"MCP flow-app-progress should normalize full executable Flow qnames");
var bootstrapDryRun = callTool(13911, "flow-project-bootstrap", {
	project: "FlowBootstrapSmoke",
	dryRun: true,
	ui: true
});
assertTrue(bootstrapDryRun.result.jsonrpc === "2.0" &&
	bootstrapDryRun.result.id === 13911 &&
	bootstrapDryRun.result.result.structuredContent.ok === true &&
	bootstrapDryRun.result.result.structuredContent.dryRun === true &&
	bootstrapDryRun.result.result.structuredContent.project === "FlowBootstrapSmoke" &&
	bootstrapDryRun.result.result.structuredContent.next.indexOf("once") !== -1,
	"MCP flow-project-bootstrap should preserve the JSON-RPC envelope instead of overwriting result scope");
var fullSyncScaffoldDryRun = callTool(139111, "flow-fullsync-scaffold", {
	project: "FlowFullSyncSmoke",
	connector: { name: "retaildb", anonymousReplication: "deny" },
	designDocuments: [{
		name: "design",
		views: {
			children_byFather: {
				map: "function (doc) { if (doc.father) emit(doc.father, doc); }"
			}
		}
	}],
	transactions: [{
		name: "GetChildren",
		type: "getView",
		view: "design/children_byFather",
		accessibility: "Public",
		variables: [{ name: "key", description: "View key" }]
	}],
	dryRun: true
});
assertTrue(fullSyncScaffoldDryRun.result.result.structuredContent.ok === true &&
	fullSyncScaffoldDryRun.result.result.structuredContent.dryRun === true &&
	fullSyncScaffoldDryRun.result.result.structuredContent.plan.connector === "FlowFullSyncSmoke.retaildb" &&
	fullSyncScaffoldDryRun.result.result.structuredContent.plan.designDocuments[0] === "FlowFullSyncSmoke.retaildb.design" &&
	fullSyncScaffoldDryRun.result.result.structuredContent.plan.transactions[0] === "FlowFullSyncSmoke.retaildb.GetChildren" &&
	fullSyncScaffoldDryRun.result.result.structuredContent.readiness.checked === false,
	"MCP flow-fullsync-scaffold dry-run did not return the expected plan");
var frontendEngineSource = [
	"version: 1",
	"config:",
	"  frontbuilder:",
	"    svelte:",
	"      target: svelte5",
	"      resourceRoot: " + frontendSvelteResourceRoot(),
	"      modelPath: libs/flow/frontbuilder/svelte/model/Smoke/src/routes/+page.flow.svelte",
	""
].join("\n");
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
var frontendSvelteDisable = callTool(139001, "frontend-svelte-mutate", {
	projectDir: targetProjectDir,
	sourceFile: String(frontendPageFile.getAbsolutePath()),
	mutation: {
		op: "setEnabled",
		path: "frontAst.slots.structure.children[0]",
		enabled: false
	}
});
assertTrue(frontendSvelteDisable.result.result.structuredContent.ok === true &&
	String(Packages.org.apache.commons.io.FileUtils.readFileToString(frontendPageFile, "UTF-8")).indexOf("enabled={false}") !== -1,
	"MCP frontend-svelte-mutate should persist a disabled authoring node");
var frontendSvelteEnable = callTool(139002, "frontend-svelte-mutate", {
	projectDir: targetProjectDir,
	sourceFile: String(frontendPageFile.getAbsolutePath()),
	mutation: {
		op: "setEnabled",
		path: "frontAst.slots.structure.children[0]",
		enabled: true
	}
});
assertTrue(frontendSvelteEnable.result.result.structuredContent.ok === true &&
	String(Packages.org.apache.commons.io.FileUtils.readFileToString(frontendPageFile, "UTF-8")).indexOf("enabled={false}") === -1,
	"MCP frontend-svelte-mutate should restore a disabled authoring node");
var frontendSvelteImplicitProps = callTool(13901, "frontend-svelte-mutate", {
	projectDir: targetProjectDir,
	sourceFile: String(frontendPageFile.getAbsolutePath()),
	mutation: {
		op: "merge",
		path: "frontAst.slots.structure.children[0]",
		value: { text: "Smoke text edited" }
	}
});
assertTrue(frontendSvelteImplicitProps.result.result.structuredContent.ok === true &&
	frontendSvelteImplicitProps.result.result.structuredContent.debug.propertyPathNormalized === true &&
	String(Packages.org.apache.commons.io.FileUtils.readFileToString(frontendPageFile, "UTF-8")).indexOf("Smoke text edited") !== -1,
	"MCP frontend-svelte-mutate should normalize property payloads when .props is omitted");
var frontendSvelteLegacyBinding = callTool(13902, "frontend-svelte-mutate", {
	projectDir: targetProjectDir,
	sourceFile: String(frontendPageFile.getAbsolutePath()),
	mutation: {
		op: "replace",
		path: "frontAst.slots.structure.children[0].props.source",
		value: "target"
	}
});
assertTrue(frontendSvelteLegacyBinding.result.error &&
	frontendSvelteLegacyBinding.result.error.data.code === "FRONTEND_BINDING_REQUIRED",
	"MCP frontend-svelte-mutate should reject new string bindings with a structured diagnostic: " +
		JSON.stringify(frontendSvelteLegacyBinding));
var frontendSvelteStructuredBinding = callTool(13903, "frontend-svelte-mutate", {
	projectDir: targetProjectDir,
	sourceFile: String(frontendPageFile.getAbsolutePath()),
	mutation: {
		op: "replace",
		path: "frontAst.slots.structure.children[0].props.source",
		value: {
			mode: "source",
			source: { category: "requestable", actionId: "readTarget" },
			path: [{ kind: "property", name: "target" }]
		}
	}
});
assertTrue(frontendSvelteStructuredBinding.result.result.structuredContent.ok === true &&
	String(Packages.org.apache.commons.io.FileUtils.readFileToString(frontendPageFile, "UTF-8")).indexOf("readTarget") !== -1,
	"MCP frontend-svelte-mutate should persist a structured picker binding: " + JSON.stringify(frontendSvelteStructuredBinding));
function frontendSvelteResourceRoot() {
	var root = new java.io.File(projectDir).getParentFile();
	var engineProject = new java.io.File(engineDir).getParentFile().getParentFile();
	var engineSiblings = engineProject ? engineProject.getParentFile() : null;
	var candidates = [
		new java.io.File(engineSiblings, "c8oprj-lib-flow-frontbuilder-svelte/libs/flow/frontbuilder/svelte"),
		new java.io.File(root, "c8oprj-lib-flow-frontbuilder-svelte/libs/flow/frontbuilder/svelte"),
		new java.io.File(root, "lib_flow_frontbuilder_svelte/libs/flow/frontbuilder/svelte"),
		new java.io.File(projectDir, "libs/flow/frontbuilder/svelte")
	];
	for (var i = 0; i < candidates.length; i++) {
		if (new java.io.File(candidates[i], "src-builder/frontDocumentCli.ts").isFile()) {
			return String(candidates[i].getAbsolutePath());
		}
	}
	return "libs/flow/frontbuilder/svelte";
}
function findCompactNode(node, predicate) {
	if (!node) {
		return null;
	}
	if (predicate(node)) {
		return node;
	}
	var children = node.children || [];
	for (var i = 0; i < children.length; i++) {
		var found = findCompactNode(children[i], predicate);
		if (found) {
			return found;
		}
	}
	return null;
}
var frontendSvelteInspect = callTool(1392, "frontend-svelte-tree", {
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	detail: "inspect",
	maxDepth: 6
});
var frontendSvelteInspectTree = frontendSvelteInspect.result.result.structuredContent;
var frontendSvelteInspectText = findCompactNode(frontendSvelteInspectTree, function (node) {
	return node.type === "Text" && node.props && node.props.text === "Smoke text edited";
});
assertTrue(frontendSvelteInspectTree.ok === true && frontendSvelteInspectText !== null,
	"MCP frontend-svelte-tree detail=inspect should expose visible frontend props without full metadata");
var frontendSvelteInspectStructure = findCompactNode(frontendSvelteInspectTree, function (node) {
	return node.kind === "frontendStructure";
});
assertTrue(frontendSvelteInspectStructure !== null && frontendSvelteInspectStructure.path,
	"MCP frontend-svelte-tree detail=inspect should expose a frontend structure focus path");
var frontendSvelteBoundedFull = callTool(13921, "frontend-svelte-tree", {
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	detail: "full",
	maxDepth: 64,
	internalDeep: true,
	includeDefinition: true
});
var frontendSvelteBoundedFullTree = frontendSvelteBoundedFull.result.result.structuredContent;
assertTrue(frontendSvelteBoundedFullTree.detail === "inspect" &&
	frontendSvelteBoundedFullTree.responseDetail === "inspect" &&
	frontendSvelteBoundedFullTree.warnings.some(function (warning) {
		return warning.code === "FULL_TREE_DETAIL_DOWNGRADED";
	}) && frontendSvelteBoundedFullTree.warnings.some(function (warning) {
		return warning.code === "TREE_RESPONSE_BOUNDED";
	}) && JSON.stringify(frontendSvelteBoundedFullTree).indexOf('"definition"') === -1 &&
	JSON.stringify(frontendSvelteBoundedFullTree).length < 100000,
	"MCP frontend-svelte-tree should bound accidental full responses and ignore public internalDeep flags");
var frontendSvelteMultiQueryPalette = callTool(1393, "frontend-svelte-palette", {
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	focusPath: frontendSvelteInspectStructure.path,
	query: "PageShell Card Text"
});
assertTrue(frontendSvelteMultiQueryPalette.result.result.structuredContent.ok === true &&
	frontendSvelteMultiQueryPalette.result.result.structuredContent.items.some(function (item) {
		return item.id === "svelte.text";
	}) &&
	frontendSvelteMultiQueryPalette.result.result.structuredContent.items.some(function (item) {
		return item.id === "svelte.card";
	}),
	"MCP frontend-svelte-palette should return useful token matches for multi-intent frontend queries");
var frontendSvelteTextPaletteItem = frontendSvelteMultiQueryPalette.result.result.structuredContent.items.filter(function (item) {
	return item.id === "svelte.text";
})[0];
assertTrue(frontendSvelteTextPaletteItem.apply &&
	frontendSvelteTextPaletteItem.apply.tool === "frontend-svelte-mutate" &&
	frontendSvelteTextPaletteItem.apply.arguments.sourceFile ===
		"libs/flow/frontbuilder/svelte/model/Smoke/src/routes/+page.flow.svelte" &&
	frontendSvelteTextPaletteItem.apply.arguments.mutation.op === "append" &&
	frontendSvelteTextPaletteItem.apply.arguments.mutation.path.indexOf("frontAst") === 0 &&
	JSON.stringify(frontendSvelteTextPaletteItem.apply.arguments.mutation.value) === JSON.stringify(frontendSvelteTextPaletteItem.insert),
	"MCP frontend-svelte-palette should return an executable source-backed mutation");
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <Text id=\"smokeText\" text=\"Smoke text\" />",
	"    <Button id=\"loadFeed\" label=\"Load feed\">",
	"      <Events>",
	"        <OnClick id=\"loadFeedClick\">",
	"          <Actions>",
	"            <CallSequence id=\"readTarget\" requestable=\".TargetSmoke\" outputSchema={{\"type\":\"object\",\"properties\":{\"target\":{\"type\":\"string\"},\"first\":{\"type\":\"number\"}}}}>",
	"              <Variables />",
	"            </CallSequence>",
	"          </Actions>",
	"        </OnClick>",
	"      </Events>",
		"    </Button>",
		"    <Text id=\"targetValue\" source={{\"mode\":\"source\",\"source\":{\"category\":\"requestable\",\"actionId\":\"readTarget\"},\"path\":[{\"kind\":\"property\",\"name\":\"target\"}]}} />",
		"    <Text id=\"intuitiveTargetValue\" source=\"@readTarget.target\" />",
		"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressFrontend = callTool(1394, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true,
	detail: "full"
});
assertTrue(appProgressFrontend.result.result.structuredContent.ok === true &&
	appProgressFrontend.result.result.structuredContent.frontend.structurePath &&
	appProgressFrontend.result.result.structuredContent.frontend.paperboard.routeCount === 1 &&
	appProgressFrontend.result.result.structuredContent.frontend.paperboard.pageCount === 1 &&
	appProgressFrontend.result.result.structuredContent.frontend.timing.sharedProjection === true &&
	appProgressFrontend.result.result.structuredContent.frontend.bindingSuggestions.some(function (suggestion) {
		return suggestion.actionId === "readTarget" && suggestion.leafPaths && suggestion.leafPaths.indexOf("target") !== -1 &&
			suggestion.bindings.some(function (candidate) {
				return candidate.path === "target" && candidate.binding && candidate.binding.mode === "source";
			});
	}) &&
	appProgressFrontend.result.result.structuredContent.frontend.bindingWarnings.length === 0 &&
	appProgressFrontend.result.result.structuredContent.tasks.some(function (task) {
		return task.id === "frontendBindings" && task.done === true;
	}) &&
	!appProgressFrontend.result.result.structuredContent.recommendedCalls.some(function (call) {
		return call.tool === "frontend-svelte-palette" || call.tool === "frontend-svelte-tree" ||
			call.tool === "frontend-svelte-action" && call.arguments.actionId === "generate";
	}),
	"MCP flow-app-progress should expose result-relative bindings without speculative tree, palette or generate calls: " +
		JSON.stringify(appProgressFrontend.result.result.structuredContent.frontend));
var appProgressPoc = callTool(13941, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true,
	detail: "full",
	mode: "poc"
});
assertTrue(appProgressPoc.result && appProgressPoc.result.result,
	"MCP flow-app-progress POC mode failed: " + JSON.stringify(appProgressPoc));
assertTrue(appProgressPoc.result.result.structuredContent.complete === true &&
	appProgressPoc.result.result.structuredContent.pocReady === true &&
	appProgressPoc.result.result.structuredContent.hardeningComplete === null &&
	appProgressPoc.result.result.structuredContent.tasks.every(function (task) {
		return task.id !== "mockDebt" && task.id !== "frontendBindings" &&
			task.id !== "frontendStructure" && task.id !== "frontendActions";
	}) &&
	appProgressPoc.result.result.structuredContent.deferredTasks.length === 4 &&
	appProgressPoc.result.result.structuredContent.mocks.checked === false &&
	appProgressPoc.result.result.structuredContent.backend.debt.checked === false &&
	appProgressPoc.result.result.structuredContent.frontend.timing.fastPath === true &&
	appProgressPoc.result.result.structuredContent.workflow.maxRepairPasses === 2,
	"MCP flow-app-progress POC mode should stop at a useful preview and defer hardening audits: " +
		JSON.stringify(appProgressPoc.result.result.structuredContent));
var appProgressStructured = callTool(1396, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
assertTrue(appProgressStructured.result.result.structuredContent.frontend.bindingWarnings.length === 0 &&
	appProgressStructured.result.result.structuredContent.detail === "compact" &&
	appProgressStructured.result.result.structuredContent.frontend.bindingSuggestions === undefined &&
	appProgressStructured.result.result.structuredContent.frontend.paperboard.blockCount >= 1 &&
	appProgressStructured.result.result.structuredContent.tasks.some(function (task) {
		return task.id === "frontendBindings" && task.done === true;
	}) && appProgressStructured.result.result.structuredContent.backend.debt.unusedFrontendOutputs.indexOf("first") !== -1 &&
	appProgressStructured.result.result.structuredContent.backend.debt.unusedFrontendOutputs.indexOf("target") === -1,
	"MCP flow-app-progress should accept the structured binding produced by its fix");
var frontendBindingInspect = callTool(1397, "frontend-svelte-tree", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	detail: "inspect",
	focusPath: appProgressFrontend.result.result.structuredContent.frontend.paperboard.dataSources.filter(function (source) {
		return source.id === "targetValue";
	})[0].path,
	property: "source",
	sourceId: "readTarget",
	maxDepth: 0
});
var inspectedBinding = frontendBindingInspect.result.result.structuredContent.children[0].bindings.source;
assertTrue(inspectedBinding && inspectedBinding.sources.some(function (source) {
	return source.binding && source.binding.mode === "source" && source.mutation && source.mutation.value.mode === "source";
	}), "MCP frontend-svelte-tree detail=inspect should expose executable schema-backed binding candidates: " +
		JSON.stringify(frontendBindingInspect));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <Text id=\"staticTitle\" text=\"Static title\" />",
	"    <Button id=\"loadFeed\" label=\"Load feed\">",
	"      <Events><OnClick id=\"loadFeedClick\"><Actions>",
	"        <CallSequence id=\"readTarget\" requestable=\".TargetSmoke\"><Variables /></CallSequence>",
	"      </Actions></OnClick></Events>",
	"    </Button>",
	"    <ForEach id=\"targetItems\" source={{\"mode\":\"source\",\"source\":{\"category\":\"requestable\",\"actionId\":\"readTarget\"},\"path\":[{\"kind\":\"property\",\"name\":\"target\"}]}} context=\"item\">",
	"      <Children>",
	"        <Image id=\"missingImage\" alt=\"Missing source\" />",
	"        <Text id=\"missingTitle\" text=\"Placeholder\" />",
	"        <Button id=\"missingButton\" label=\"Open item\" />",
	"      </Children>",
	"      <Else />",
	"    </ForEach>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressMissingBindings = callTool(13961, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
assertTrue(appProgressMissingBindings.result.result.structuredContent.frontend.bindingWarnings.filter(function (warning) {
	return warning.code === "FRONTEND_BINDING_MISSING";
}).length === 3 &&
	appProgressMissingBindings.result.result.structuredContent.tasks.some(function (task) {
		return task.id === "frontendBindings" && task.done === false;
	}),
	"MCP flow-app-progress should require explicit Image/Text/Button bindings inside a backend-bound iterator: " +
		JSON.stringify(appProgressMissingBindings.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <Button id=\"loadNews\" label=\"Load news\"><Events><OnClick id=\"loadNewsClick\"><Actions>",
	"      <CallSequence id=\"readNews\" requestable=\".TargetSmoke\" outputSchema={{\"type\":\"object\",\"properties\":{\"news\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"title\":{\"type\":\"string\"},\"description\":{\"type\":\"string\"},\"imageUrl\":{\"type\":\"string\"}}}}}}}><Variables /></CallSequence>",
	"    </Actions></OnClick></Events></Button>",
	"    <ForEach id=\"newsList\" context=\"newsItem\"><Each>",
	"      <Card id=\"newsCard\"><Children>",
	"        <Image id=\"newsImage\" alt=\"News image\" />",
	"        <Text id=\"newsTitle\" />",
	"        <Text id=\"newsDescription\" />",
	"      </Children></Card>",
	"    </Each></ForEach>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressBindingPlan = callTool(139611, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
var composedBindingPlan = appProgressBindingPlan.result.result.structuredContent.frontend.bindingPlan;
assertTrue(composedBindingPlan && composedBindingPlan.fixCount === 4 && composedBindingPlan.callCount === 1 &&
	composedBindingPlan.calls[0].tool === "frontend-svelte-mutate" &&
	composedBindingPlan.calls[0].arguments.mutations.length === 4 &&
	composedBindingPlan.calls[0].arguments.mutations[0].value.source.actionId === "readNews" &&
	composedBindingPlan.calls[0].arguments.mutations[1].value.source.scopeId === "newsList" &&
	composedBindingPlan.calls[0].arguments.mutations[1].value.path[0].name === "imageUrl" &&
	composedBindingPlan.calls[0].arguments.mutations[2].value.path[0].name === "title" &&
	composedBindingPlan.calls[0].arguments.mutations[3].value.path[0].name === "description" &&
	appProgressBindingPlan.result.result.structuredContent.recommendedCalls.filter(function (call) {
		return call.tool === "frontend-svelte-mutate";
	}).length === 1,
	"MCP flow-app-progress should compose one ordered schema-backed binding batch: " +
		JSON.stringify(appProgressBindingPlan.result.result.structuredContent.frontend));
var appliedBindingPlan = composedBindingPlan.calls[0];
appliedBindingPlan.arguments.projectDir = targetProjectDir;
var appliedBindingPlanResult = callTool(139612, appliedBindingPlan.tool, appliedBindingPlan.arguments);
assertTrue(appliedBindingPlanResult.result.result.structuredContent.ok === true &&
	appliedBindingPlanResult.result.result.structuredContent.mutationCount === 4,
	"MCP composed binding plan should be directly executable: " + JSON.stringify(appliedBindingPlanResult));
var appProgressAfterBindingPlan = callTool(139613, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
assertTrue(appProgressAfterBindingPlan.result.result.structuredContent.frontend.bindingWarnings.length === 0,
	"MCP composed binding plan should resolve all unambiguous iterator bindings: " +
		JSON.stringify(appProgressAfterBindingPlan.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <OnMount id=\"start\"><Actions><UpdateList id=\"clearCrumbs\" target=\"breadcrumb\" operation=\"clear\" value={{\"mode\":\"literal\",\"value\":null}} /></Actions></OnMount>",
	"    <ForEach id=\"breadcrumbItems\" source={{\"mode\":\"literal\",\"value\":[]}}><Each><Text id=\"crumbLabel\" text=\"Crumb\" /></Each></ForEach>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressLocalList = callTool(139614, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
var localListWarning = appProgressLocalList.result.result.structuredContent.frontend.bindingWarnings.filter(function (warning) {
	return warning.code === "FRONTEND_ITERATOR_EMPTY_SOURCE";
})[0];
assertTrue(localListWarning && localListWarning.suggestedBinding &&
	localListWarning.suggestedBinding.source.category === "action" &&
	localListWarning.suggestedBinding.source.actionId === "breadcrumb" &&
	localListWarning.fix && localListWarning.fix.arguments.mutation.value.path.length === 0,
	"MCP flow-app-progress should prefer semantically matched UpdateList state over an unrelated backend array: " +
		JSON.stringify(appProgressLocalList.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <ForEach id=\"catalogItems\" source={{\"mode\":\"source\",\"source\":{\"category\":\"action\",\"actionId\":\"breadcrumb\"},\"path\":[]}}>",
	"      <Each><Text id=\"itemName\" source={{\"mode\":\"source\",\"source\":{\"category\":\"iteration\",\"scopeId\":\"catalogItems\",\"value\":\"item\"},\"path\":[{\"kind\":\"property\",\"name\":\"name\"}]}} /></Each>",
	"      <Else><Text id=\"emptyText\" text=\"No catalog items are available.\" /></Else>",
	"    </ForEach>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressForEachElse = callTool(1396141, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
assertTrue(!appProgressForEachElse.result.result.structuredContent.frontend.bindingWarnings.some(function (warning) {
	return String(warning.path || "").indexOf("emptyText") !== -1;
}), "MCP flow-app-progress should not bind static ForEach Else content to the unavailable iterator item: " +
	JSON.stringify(appProgressForEachElse.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <GoBack id=\"invalidBack\" fallback=\"/store\" />",
	"    <OnMount id=\"initialize\"><Actions>",
	"      <FullSyncView id=\"rootCategories\" database=\"retailstore\" ddoc=\"catalog\" view=\"categories\" />",
	"      <UpdateList id=\"clearCrumbs\" target=\"breadcrumb\" operation=\"clear\" value={{\"mode\":\"literal\",\"value\":null}} />",
	"    </Actions></OnMount>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressStructure = callTool(139615, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
var structureWarnings = appProgressStructure.result.result.structuredContent.frontend.structureWarnings || [];
assertTrue(structureWarnings.some(function (warning) {
	return warning.code === "FRONTEND_ACTION_OUTSIDE_ACTIONS";
}) && structureWarnings.some(function (warning) {
	return warning.code === "FRONTEND_LATE_STATE_INITIALIZATION";
}) && appProgressStructure.result.result.structuredContent.tasks.some(function (task) {
	return task.id === "frontendStructure" && task.done === false;
}), "MCP flow-app-progress should block unsafe action placement and late lifecycle state resets: " +
	JSON.stringify(appProgressStructure.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <Button id=\"loadCatalog\" label=\"Load catalog\"><Events><OnClick id=\"loadCatalogClick\"><Actions>",
	"      <CallSequence id=\"loadNews\" requestable=\".LoadNews\" />",
	"    </Actions></OnClick></Events></Button>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressNestedAction = callTool(139616, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
assertTrue(!appProgressNestedAction.result.result.structuredContent.frontend.structureWarnings.some(function (warning) {
	return warning.code === "FRONTEND_ACTION_OUTSIDE_ACTIONS";
}), "MCP flow-app-progress should accept actions below a stable Actions path: " +
	JSON.stringify(appProgressNestedAction.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <Button id=\"loadCatalog\" label=\"Load catalog\"><Events><OnClick id=\"loadCatalogClick\"><Actions>",
	"      <FullSyncView id=\"rootCategories\" database=\"retailstore\" ddoc=\"catalog\" view=\"categories\" schemaRequestable=\".retailstore.ReadCategories\"><Variables /></FullSyncView>",
	"    </Actions></OnClick></Events></Button>",
	"    <ForEach id=\"categories\" source={{\"mode\":\"literal\",\"value\":[]}} context=\"item\"><Children /></ForEach>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressPendingFullSync = callTool(13962, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
var pendingFullSyncWarnings = appProgressPendingFullSync.result.result.structuredContent.frontend.bindingWarnings;
assertTrue(pendingFullSyncWarnings.some(function (warning) {
	return warning.code === "FRONTEND_FULLSYNC_SCHEMA_PENDING" && warning.fix &&
		warning.fix.tool === "frontend-svelte-fullsync-schema" &&
		warning.fix.arguments.actionId === "rootCategories" && warning.fix.arguments.input &&
		warning.fix.arguments.input._use_include_docs === true;
}) && pendingFullSyncWarnings.some(function (warning) {
	return warning.code === "FRONTEND_ITERATOR_EMPTY_SOURCE" && warning.fix &&
		warning.fix.tool === "frontend-svelte-mutate" && warning.suggestedBinding &&
		warning.suggestedBinding.source.category === "fullsync";
	}) && !pendingFullSyncWarnings.some(function (warning) {
		return warning.code === "FRONTEND_FULLSYNC_SCHEMA_LOCATION_MISSING";
	}) && appProgressPendingFullSync.result.result.structuredContent.tasks.some(function (task) {
	return task.id === "frontendBindings" && task.done === false;
}) && appProgressPendingFullSync.result.result.structuredContent.complete === false &&
	appProgressPendingFullSync.result.result.structuredContent.progressPhase === "action-required" &&
	appProgressPendingFullSync.result.result.structuredContent.progress.percent < 100 &&
	pendingFullSyncWarnings.every(function (warning) {
		return !warning.fix || warning.fix.tool !== "frontend-svelte-fullsync-schema" ||
			!!warning.fix.arguments.path || !!warning.fix.arguments.actionId;
	}) && appProgressPendingFullSync.result.result.structuredContent.recommendedCalls.some(function (call) {
		return call.tool === "frontend-svelte-mutate" && call.arguments.mutations &&
			call.arguments.mutations[0].value.source.category === "fullsync";
	}), "MCP flow-app-progress should keep pending FullSync schemas and empty iterators actionable: " +
	JSON.stringify(appProgressPendingFullSync.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <OnMount id=\"initialize\"><Actions><FullSyncSync id=\"syncCatalog\" database=\"retailstore\" mode=\"pull\" /></Actions></OnMount>",
	"    <Progress id=\"syncProgress\" value=\"@syncCatalog.progress.current\" max={100} />",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressFullSyncProgress = callTool(139620, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true,
	detail: "full"
});
assertTrue(appProgressFullSyncProgress.result.result.structuredContent.frontend.bindingSuggestions.some(function (suggestion) {
	return suggestion.actionId === "syncCatalog" && suggestion.sourcePaths.indexOf("progress.current") !== -1;
}) && !appProgressFullSyncProgress.result.result.structuredContent.frontend.bindingWarnings.some(function (warning) {
	return warning.code === "FRONTEND_BINDING_UNKNOWN_SCHEMA_PATH";
}), "MCP flow-app-progress should expose FullSync replication progress as a bindable schema path: " +
	JSON.stringify(appProgressFullSyncProgress.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <ForEach id=\"catalog\" source={{\"mode\":\"literal\",\"value\":[]}} context=\"item\"><Children>",
	"      <Card id=\"productCard\"><Children><If id=\"isProduct\" test={{\"mode\":\"literal\",\"value\":true}}><Then>",
	"        <Button id=\"openProduct\" label=\"Open\"><Events><OnClick id=\"openProductClick\"><Actions>",
	"          <FullSyncGet id=\"selectedProduct\" database=\"retailstore\" docid={{\"mode\":\"source\",\"source\":{\"category\":\"iteration\",\"scopeId\":\"catalog\",\"value\":\"item\"},\"path\":[{\"kind\":\"property\",\"name\":\"id\"}]}} schemaRequestable=\".retailstore.ReadProduct\" />",
	"        </Actions></OnClick></Events></Button>",
	"      </Then><Else /></If></Children></Card>",
	"    </Children></ForEach>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressDeepFullSync = callTool(139621, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
assertTrue(appProgressDeepFullSync.result.result.structuredContent.frontend.bindingWarnings.some(function (warning) {
	return warning.actionId === "selectedProduct" &&
		warning.code === "FRONTEND_FULLSYNC_SCHEMA_INPUT_REQUIRED" &&
		warning.repair && warning.repair.tool === "frontend-svelte-fullsync-schema" &&
		warning.repair.arguments.actionId === "selectedProduct" &&
		warning.repair.needsInput && warning.repair.needsInput.name === "sampleDocId" &&
		warning.repair.needsInput.requestVariable === "_use_docid";
}), "MCP flow-app-progress should discover deeply nested FullSync actions: " +
	JSON.stringify(appProgressDeepFullSync.result.result.structuredContent.frontend));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <OnMount id=\"initialize\"><Actions><UpdateNumber id=\"quantity\" operation=\"set\" value={1} /></Actions></OnMount>",
	"    <Text id=\"quantityValue\" source={{\"mode\":\"source\",\"source\":{\"category\":\"action\",\"actionId\":\"quantity\"},\"path\":[]}} />",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressNumericState = callTool(139622, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true,
	detail: "full"
});
assertTrue(appProgressNumericState.result.result.structuredContent.frontend.bindingSuggestions.some(function (suggestion) {
	return suggestion.actionId === "quantity" && suggestion.operation === "state.number";
}) && appProgressNumericState.result.result.structuredContent.frontend.timing.pickerCalls === 0,
	"MCP flow-app-progress should index UpdateNumber state without reopening the picker tree: " +
		JSON.stringify(appProgressNumericState.result.result.structuredContent.frontend.timing));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"home\" label=\"Home\">",
	"  <Structure>",
	"    <Button id=\"loadCatalog\" label=\"Load catalog\"><Events><OnClick id=\"loadCatalogClick\"><Actions>",
	"      <FullSyncView id=\"rootCategories\" database=\"retailstore\" ddoc=\"catalog\" view=\"categories\" outputSchema={{\"type\":\"object\",\"properties\":{\"rows\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"doc\":{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"},\"imageUrl\":{\"type\":\"string\"}}}}}}}}}><Variables /></FullSyncView>",
	"    </Actions></OnClick></Events></Button>",
	"    <ForEach id=\"categories\" source={{\"mode\":\"source\",\"source\":{\"category\":\"fullsync\",\"actionId\":\"rootCategories\",\"operation\":\"view\"},\"path\":[{\"kind\":\"property\",\"name\":\"rows\"}]}} context=\"item\"><Children>",
	"      <Text id=\"categoryName\" text=\"Category\" source={{\"mode\":\"source\",\"source\":{\"category\":\"iteration\",\"scopeId\":\"categories\",\"value\":\"item\"},\"path\":[]}} />",
	"    </Children></ForEach>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n"), "UTF-8");
var appProgressWholeIteration = callTool(13963, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
var wholeIterationWarning = appProgressWholeIteration.result.result.structuredContent.frontend.bindingWarnings.filter(function (warning) {
	return warning.code === "FRONTEND_ITERATION_OBJECT_SOURCE";
})[0];
assertTrue(wholeIterationWarning && wholeIterationWarning.fix &&
	wholeIterationWarning.fix.arguments.mutation.value.path[0].name === "doc" &&
	wholeIterationWarning.fix.arguments.mutation.value.path[1].name === "name",
	"MCP flow-app-progress should replace whole iterator object bindings with an exact schema-backed scalar mutation: " +
		JSON.stringify(appProgressWholeIteration.result.result.structuredContent.frontend));
var wholeIterationSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(frontendPageFile, "UTF-8"));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile,
	wholeIterationSource.replace('source={{"mode":"source","source":{"category":"iteration","scopeId":"categories","value":"item"},"path":[]}}',
		'source={{"mode":"literal","value":"Category"}}'), "UTF-8");
var appProgressLiteralIteration = callTool(13964, "flow-app-progress", {
	project: "target",
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	includeFrontend: true
});
var literalIterationWarning = appProgressLiteralIteration.result.result.structuredContent.frontend.bindingWarnings.filter(function (warning) {
	return warning.code === "FRONTEND_ITERATION_LITERAL_PLACEHOLDER";
})[0];
assertTrue(literalIterationWarning && literalIterationWarning.fix &&
	literalIterationWarning.fix.arguments.mutation.value.path[0].name === "doc" &&
	literalIterationWarning.fix.arguments.mutation.value.path[1].name === "name",
	"MCP flow-app-progress should replace semantically matched literals inside schema-backed iterators: " +
		JSON.stringify(appProgressLiteralIteration.result.result.structuredContent.frontend));
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
	definition: {
		localName: "store"
	},
	mutation: {
		value: {
			__frontendCreateSource: {
				baseId: "segment",
				directory: "${targetRouteDirectory}/${localName}",
				directoryOnly: true,
				targetSourcePath: String(frontendRouteRoot.getAbsolutePath()),
				markerFile: ".flow-route.json",
				markerSource: "{\n  \"kind\": \"segment\"\n}\n"
			}
		}
	}
});
var frontendDetailDir = new java.io.File(frontendRouteRoot, "store");
assertTrue(frontendRouteSegment.created === true &&
	frontendRouteSegment.written === true &&
	new java.io.File(frontendDetailDir, ".flow-route.json").isFile(),
	"MCP frontend source creation should apply the requested localName to route segment folders");
var frontendRoutePage = mcpLib.createFrontendSource({
	projectDir: targetProjectDir,
	sourcePath: String(new java.io.File(frontendDetailDir, ".flow-route.json").getAbsolutePath()),
	mutation: {
		value: {
			__frontendCreateSource: {
				baseId: "detailPage",
				directory: "${targetRouteDirectory}",
				fileName: "+page.flow.svelte",
				targetSourcePath: String(frontendRouteRoot.getAbsolutePath()),
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
var frontendTreeAfterRouteCreation = callTool(13931, "frontend-svelte-tree", {
	projectDir: targetProjectDir,
	engineSource: frontendEngineSource,
	detail: "compact",
	maxDepth: 10
});
assertTrue(findCompactNode(frontendTreeAfterRouteCreation.result.result.structuredContent, function (node) {
		return node.kind === "frontendRouteSegment" && node.summary === "store";
}) !== null,
	"MCP frontend document cache should invalidate when a sibling route is created: " +
		JSON.stringify(frontendTreeAfterRouteCreation.result.result.structuredContent));
var targetEngineFile = new java.io.File(targetDir, "libs/flow/engine.yaml");
targetEngineFile.getParentFile().mkdirs();
Packages.org.apache.commons.io.FileUtils.writeStringToFile(targetEngineFile, frontendEngineSource, "UTF-8");
var frontendSourceGet = callTool(1381, "frontend-svelte-code-get", {
	projectDir: targetProjectDir,
	sourceFile: "libs/flow/frontbuilder/svelte/model/Smoke/src/routes/+page.flow.svelte"
});
var frontendSourceRevision = frontendSourceGet.result.result.structuredContent.revision;
assertTrue(frontendSourceGet.result.result.structuredContent.ok === true &&
	frontendSourceGet.result.result.structuredContent.code.indexOf("<FlowComponent") !== -1 &&
	frontendSourceRevision &&
	frontendSourceGet.result.result.structuredContent.authoringContract &&
	frontendSourceGet.result.result.structuredContent.authoringContract.version === 2 &&
	frontendSourceGet.result.result.structuredContent.authoringContract.pages.some(function (page) {
		return page.id === "home" && page.path === "/";
	}) &&
	frontendSourceGet.result.result.structuredContent.authoringContract.pages.some(function (page) {
		return page.path === "/store";
	}) &&
	frontendSourceGet.result.result.structuredContent.authoringContract.navigation.readParameter === "@route.params.id" &&
	frontendSourceGet.result.result.structuredContent.authoringContract.blocks.some(function (block) {
		return block.tag === "Text" && String(block.properties.text).indexOf("literal") !== -1;
	}) && frontendSourceGet.result.result.structuredContent.authoringContract.blocks.some(function (block) {
		return block.tag === "Image" && block.properties.alt &&
			String(block.properties.alt).indexOf("source") !== -1;
	}) && frontendSourceGet.result.result.structuredContent.authoringContract.blocks.some(function (block) {
		return block.tag === "ForEach" && block.slots.indexOf("Children") !== -1 &&
			block.slots.indexOf("default") === -1;
	}) && frontendSourceGet.result.result.structuredContent.authoringContract.blocks.some(function (block) {
		return block.tag === "If" && block.slots.indexOf("Then") !== -1 && block.slots.indexOf("Else") !== -1;
	}) && frontendSourceGet.result.result.structuredContent.authoringContract.blocks.some(function (block) {
		return block.tag === "Navigate" && block.properties.page &&
			block.slots.indexOf("Params") !== -1 && block.slots.indexOf("Query") !== -1;
	}),
	"MCP frontend-svelte-code-get should return source, revision and a compact canonical authoring contract");
var frontendSourceInvalid = callTool(1382, "frontend-svelte-code-check", {
	projectDir: targetProjectDir,
	code: [
		"<FlowComponent id=\"home\" label=\"Home\">",
		"  <Structure>",
		"    <Text id=\"duplicate\" text=\"One\" />",
		"    <Text id=\"duplicate\" text=\"Two\" />",
		"  </Structure>",
		"</FlowComponent>"
	].join("\n")
});
assertTrue(frontendSourceInvalid.result.result.structuredContent.ok === false &&
	frontendSourceInvalid.result.result.structuredContent.diagnostics.some(function (diagnostic) {
		return diagnostic.code === "FRONTEND_DUPLICATE_ID";
	}), "MCP frontend-svelte-code-check should diagnose duplicate low-code ids");
var frontendSourceUnknownProperty = callTool(13820, "frontend-svelte-code-check", {
	projectDir: targetProjectDir,
	code: [
		"<FlowComponent id=\"home\" label=\"Home\">",
		"  <Structure>",
		"    <Status id=\"status\" actionId=\"load\" loadingLabel=\"Loading\" successLabel=\"Done\" />",
		"  </Structure>",
		"</FlowComponent>"
	].join("\n")
});
assertTrue(frontendSourceUnknownProperty.result.result.structuredContent.ok === false &&
	frontendSourceUnknownProperty.result.result.structuredContent.diagnostics.filter(function (diagnostic) {
		return diagnostic.code === "FRONTEND_PROPERTY_UNKNOWN" &&
			(diagnostic.property === "loadingLabel" || diagnostic.property === "successLabel") &&
			diagnostic.acceptedProperties.indexOf("loadingText") !== -1 &&
			diagnostic.acceptedProperties.indexOf("successText") !== -1;
	}).length === 2,
	"MCP frontend-svelte-code-check should reject unknown catalog properties with accepted alternatives: " +
		JSON.stringify(frontendSourceUnknownProperty.result.result.structuredContent));
var frontendSourceUnknownVariableProperty = callTool(13821, "frontend-svelte-code-check", {
	projectDir: targetProjectDir,
	code: [
		"<FlowComponent id=\"home\" label=\"Home\">",
		"  <Structure><OnMount id=\"load\"><Actions>",
		"    <CallSequence id=\"read\" requestable=\".TargetSmoke\"><Variables>",
		"      <Variable name=\"target\" source=\"@event.value\" />",
		"    </Variables></CallSequence>",
		"  </Actions></OnMount></Structure>",
		"</FlowComponent>"
	].join("\n")
});
assertTrue(frontendSourceUnknownVariableProperty.result.result.structuredContent.ok === false &&
	frontendSourceUnknownVariableProperty.result.result.structuredContent.diagnostics.some(function (diagnostic) {
		return diagnostic.code === "FRONTEND_PROPERTY_UNKNOWN" && diagnostic.property === "source" &&
			diagnostic.acceptedProperties.indexOf("value") !== -1;
	}), "MCP frontend-svelte-code-check should reject Variable source and expose canonical value: " +
		JSON.stringify(frontendSourceUnknownVariableProperty.result.result.structuredContent));
var frontendSourceUnknownBlock = callTool(13822, "frontend-svelte-code-check", {
	projectDir: targetProjectDir,
	code: [
		"<FlowComponent id=\"home\" label=\"Home\">",
		"  <Structure><OnMount><Actions>",
		"    <TextTrm id=\"trim\" />",
		"  </Actions></OnMount></Structure>",
		"</FlowComponent>"
	].join("\n")
});
assertTrue(frontendSourceUnknownBlock.result.result.structuredContent.ok === false &&
	frontendSourceUnknownBlock.result.result.structuredContent.diagnostics.some(function (diagnostic) {
		return diagnostic.code === "FRONTEND_BLOCK_UNKNOWN" &&
			diagnostic.candidates[0].tag === "TextTrim" &&
			diagnostic.create.tool === "flow-block-mock" &&
			diagnostic.create.arguments.targets[0] === "frontend";
	}), "MCP frontend-svelte-code-check should suggest a palette block or explicit frontend mock: " +
		JSON.stringify(frontendSourceUnknownBlock.result.result.structuredContent));
var frontendPersistedSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(frontendPageFile, "UTF-8"));
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, [
	"<FlowComponent id=\"broken\" label=\"Broken\">",
	"  <Structure>",
	"    <If id=\"brokenIf\" test={{{\"mode\":\"source\"}}} />",
	"  </Structure>",
	"</FlowComponent>"
].join("\n"), "UTF-8");
var frontendSourceRecoveryCheck = callTool(13821, "frontend-svelte-code-check", {
	projectDir: targetProjectDir,
	code: [
		"<FlowComponent id=\"home\" label=\"Recovered\">",
		"  <Structure />",
		"</FlowComponent>",
		""
	].join("\n")
});
assertTrue(frontendSourceRecoveryCheck.result.result.structuredContent.ok === true,
	"MCP frontend-svelte-code-check should validate the supplied draft instead of a persisted invalid source");
Packages.org.apache.commons.io.FileUtils.writeStringToFile(frontendPageFile, frontendPersistedSource, "UTF-8");
var frontendSetCode = [
	"<FlowComponent id=\"home\" label=\"Home source\">",
	"  <Structure>",
	"  </Structure>",
	"</FlowComponent>",
	""
].join("\n");
var frontendSourceSet = callTool(1383, "frontend-svelte-code-set", {
	projectDir: targetProjectDir,
	revision: frontendSourceRevision,
	code: frontendSetCode
});
var frontendSourceSetRevision = frontendSourceSet.result.result.structuredContent.revision;
assertTrue(frontendSourceSet.result.result.structuredContent.written === true &&
	frontendSourceSetRevision !== frontendSourceRevision &&
	frontendSourceSet.result.result.structuredContent.code === undefined &&
	frontendSourceSet.result.result.structuredContent.sourceChars > 0,
	"MCP frontend-svelte-code-set should persist source and return a compact response");
var frontendSourcePatch = callTool(1384, "frontend-svelte-code-patch", {
	projectDir: targetProjectDir,
	revision: frontendSourceSetRevision,
	codepatch: [
		"--- a/+page.flow.svelte",
		"+++ b/+page.flow.svelte",
		"@@ -1,4 +1,4 @@",
		"-<FlowComponent id=\"home\" label=\"Home source\">",
		"+<FlowComponent id=\"home\" label=\"Home patched\">",
		"   <Structure>",
		"   </Structure>",
		" </FlowComponent>"
	].join("\n")
});
var frontendSourceAfterPatch = callTool(13841, "frontend-svelte-code-get", {
	projectDir: targetProjectDir
});
assertTrue(frontendSourcePatch.result.result.structuredContent.written === true &&
	frontendSourcePatch.result.result.structuredContent.code === undefined &&
	frontendSourcePatch.result.result.structuredContent.sourceChars > 0 &&
	frontendSourceAfterPatch.result.result.structuredContent.code.indexOf("Home patched") !== -1,
	"MCP frontend-svelte-code-patch should persist a unified patch and omit source by default");
var frontendSourceStale = callTool(1385, "frontend-svelte-code-set", {
	projectDir: targetProjectDir,
	revision: frontendSourceRevision,
	code: frontendSetCode
});
assertTrue(frontendSourceStale.result.error,
	"MCP frontend-svelte-code-set should reject a stale revision");
var frontendSourceImplicit = callTool(1386, "frontend-svelte-code-get", {
	projectDir: targetProjectDir
});
assertTrue(frontendSourceImplicit.result.result.structuredContent.ok === true &&
	frontendSourceImplicit.result.result.structuredContent.sourceFile === "libs/flow/frontbuilder/svelte/model/Smoke/src/routes/+page.flow.svelte",
	"MCP frontend-svelte-code-get should infer sourceFile from config.frontbuilder.svelte.modelPath");

var codeSet = callTool(3, "code-set", {
	projectDir: targetProjectDir,
	name: "TargetSmoke",
	code: targetFlowCode
});
debugPrint(JSON.stringify(codeSet));
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
debugPrint(JSON.stringify(codeRun));
assertTrue(codeRun.result.result.structuredContent.result.target === "ok" &&
	codeRun.result.result.structuredContent.result.first === "a",
	"MCP Flow code-run did not execute the working copy");

var draftNodeSchemaSet = callTool(51, "code-set", {
	projectDir: targetProjectDir,
	name: "DraftNodeSchemaSmoke",
	code: [
		"function DraftNodeSchemaSmoke({ result }) {",
		"  var sorted = list.sort({ items: [\"b\", \"a\"], by: current, direction: \"asc\" })",
		"  result.sorted = sorted",
		"  return result",
		"}",
		""
	].join("\n")
});
assertTrue(draftNodeSchemaSet.result.result.structuredContent.ok === true,
	"MCP Flow code-set did not create the node-schema working copy");
var draftNodeSchema = callTool(52, "flow-node-output-schema", {
	projectDir: targetProjectDir,
	qname: "DraftNodeSchemaSmoke",
	nodePointer: "/nodes/0",
	detail: "full"
});
assertTrue(draftNodeSchema.result.result.structuredContent.schema.type === "array" &&
	draftNodeSchema.result.result.structuredContent.target.nodeId === "sorted" &&
	draftNodeSchema.result.result.structuredContent.target.block === "list.sort",
	"MCP flow-node-output-schema did not inspect an unpromoted FlowScript working copy");

var codePromote = callTool(6, "code-promote", {
	projectDir: targetProjectDir,
	name: "TargetSmoke"
});
debugPrint(JSON.stringify(codePromote));
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
assertTrue(treeTarget.result.result.structuredContent.children.some(function (child) {
	return child.name === "flow";
}),
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
var schemaTargetQName = callTool(1101, "flow-output-schema", {
	project: "target",
	projectDir: targetProjectDir,
	qname: "target.TargetSmoke",
	detail: "full"
});
assertTrue(schemaTargetQName.result.result.structuredContent.ok === true &&
	schemaTargetQName.result.result.structuredContent.sources.effective.schema.properties.target.type === "string",
	"MCP Flow flow-output-schema did not accept a full executable Flow qname");

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
debugPrint(JSON.stringify(adoptTargetSchema));
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
debugPrint(JSON.stringify(blockSet));
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

var blockSignatureByAlias = callTool(131, "flow-block-get", {
	projectDir: targetProjectDir,
	block: "smoke.echo"
});
assertTrue(blockSignatureByAlias.result.result.structuredContent.name === "smoke.echo",
	"MCP flow-block-get did not accept the code-tool block alias");

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
debugPrint(JSON.stringify(mockSet));
var mockStructured = mockSet.result.result.structuredContent;
assertTrue(mockStructured.ok === true &&
	mockStructured.mock === true &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke/todoWeather.block.js").isFile(),
	"MCP Flow flow-block-mock did not write a canonical project-local mock block");
assertTrue((mockStructured.warnings || []).some(function (warning) {
	return warning.code === "FLOW_BLOCK_MOCK_CREATED";
}), "MCP Flow flow-block-mock did not return an explicit mock warning");

var frontendMockSet = callTool(1321, "flow-block-mock", {
	projectDir: targetProjectDir,
	name: "smoke.normalizeLabel",
	targets: ["frontend"],
	properties: {
		value: { kind: "value", type: "string", description: "Value to normalize." }
	},
	outputs: { out: { type: "string" } },
	mockValue: "mock label",
	overwrite: true
});
var frontendMockStructured = frontendMockSet.result.result.structuredContent;
assertTrue(frontendMockStructured.ok === true &&
	frontendMockStructured.targets.length === 1 && frontendMockStructured.targets[0] === "frontend" &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke/normalizeLabel.block.js").isFile() &&
	new java.io.File(targetDir, "libs/flow/blocks/smoke/normalizeLabel.browser.js").isFile(),
	"MCP flow-block-mock should create a canonical frontend block and browser implementation: " + JSON.stringify(frontendMockStructured));
var frontendMockDescriptor = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(targetDir, "libs/flow/blocks/smoke/normalizeLabel.block.js"), "UTF-8"));
assertTrue(frontendMockDescriptor.indexOf('"targets": [\n    "frontend"') !== -1 &&
	frontendMockDescriptor.indexOf('"file": "normalizeLabel.browser.js"') !== -1,
	"Frontend mock descriptor should expose the frontend target and adjacent implementation.");
var frontendBlockRead = callTool(1322, "code-get", {
	projectDir: targetProjectDir,
	block: "smoke.normalizeLabel",
	target: "frontend"
}).result.result.structuredContent;
assertTrue(frontendBlockRead.ok === true && frontendBlockRead.code.indexOf("TODO: replace this explicit frontend mock") !== -1,
	"Unified code-get did not read the browser implementation: " + JSON.stringify(frontendBlockRead));
var frontendBlockInvalid = callTool(1323, "code-check", {
	projectDir: targetProjectDir,
	block: "smoke.normalizeLabel",
	target: "frontend",
	code: "function () { return Packages.java.lang.System }"
}).result.result.structuredContent;
assertTrue(frontendBlockInvalid.ok === false && frontendBlockInvalid.diagnostics.some(function (diagnostic) {
	return diagnostic.code === "FRONTEND_BLOCK_RUNTIME_FORBIDDEN";
}), "Unified code-check did not reject JVM APIs in browser code: " + JSON.stringify(frontendBlockInvalid));
var frontendBlockWrite = callTool(1324, "code-set", {
	projectDir: targetProjectDir,
	block: "smoke.normalizeLabel",
	target: "frontend",
	revision: frontendBlockRead.revision,
	code: "function (input) { return String(input.value || '').trim() }",
	finalize: true
}).result.result.structuredContent;
assertTrue(frontendBlockWrite.ok === true && frontendBlockWrite.finalized === true,
	"Unified code-set did not write and finalize browser code: " + JSON.stringify(frontendBlockWrite));
assertTrue(frontendBlockWrite.target === "frontend" && frontendBlockWrite.runtime === "browser",
	"Unified code-set compact response did not preserve implementation target metadata");
var frontendBlockPatch = callTool(1325, "code-patch", {
	projectDir: targetProjectDir,
	block: "smoke.normalizeLabel",
	target: "frontend",
	revision: frontendBlockWrite.revision,
	code: "function (input) { return String(input.value || '').trim().toLowerCase() }"
}).result.result.structuredContent;
assertTrue(frontendBlockPatch.ok === true && frontendBlockPatch.oldRevision === frontendBlockWrite.revision,
	"Unified code-patch did not update browser code: " + JSON.stringify(frontendBlockPatch));

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

print("lib_flow_mcp smoke tests passed");
