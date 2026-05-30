(function () {
	function jsonRpcResult(id, result) {
		return {
			jsonrpc: "2.0",
			id: id === undefined ? null : id,
			result: result
		};
	}

	function jsonRpcError(id, code, message, data) {
		return {
			jsonrpc: "2.0",
			id: id === undefined ? null : id,
			error: {
				code: code,
				message: String(message || "MCP Flow error"),
				data: data || null
			}
		};
	}

	function textContent(value) {
		return [{
			type: "text",
			text: JSON.stringify(value)
		}];
	}

	function projectProperties() {
		return {
			project: { type: "string", description: "Target Convertigo project name." },
			projectDir: { type: "string", description: "Target project directory for standalone tests." }
		};
	}

	function addProjectProperties(properties) {
		properties = properties || {};
		var project = projectProperties();
		Object.keys(project).forEach(function (key) {
			properties[key] = project[key];
		});
		return properties;
	}

	function resolveProjectDir(args) {
		args = args || {};
		if (args.projectDir || !args.project) {
			return args;
		}
		if (typeof Packages === "undefined") {
			throw new Error("Cannot resolve project without a live Convertigo runtime: " + args.project);
		}
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		var project = Engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(args.project), true);
		if (project == null) {
			throw new Error("Unknown Convertigo project: " + args.project);
		}
		args.projectDir = String(project.getDirPath());
		return args;
	}

	function loadedProjectTargets() {
		var targets = [];
		if (typeof Packages === "undefined") {
			return targets;
		}
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		var dbom = Engine.theApp.databaseObjectsManager;
		var names = Engine.isStudioMode()
			? dbom.getStudioProjects().getProjects(true).keySet()
			: dbom.getAllProjectNamesList(false);
		var iterator = names.iterator();
		while (iterator.hasNext()) {
			var projectName = String(iterator.next());
			try {
				var project = dbom.getOriginalProjectByName(projectName, false);
				if (project != null) {
					targets.push({
						project: projectName,
						projectDir: String(project.getDirPath())
					});
				}
			} catch (e) {
			}
		}
		targets.sort(function (a, b) {
			return a.project.localeCompare(b.project);
		});
		return targets;
	}

	function resources() {
		return [
			{
				uri: "flow://guide/start",
				name: "Flow MCP start guide",
				description: "Minimal bootstrap for an agent editing Convertigo Flow projects.",
				mimeType: "text/markdown"
			},
			{
				uri: "flow://guide/authoring",
				name: "Flow authoring cycle",
				description: "Recommended search, edit, test cycle for Flow authoring.",
				mimeType: "text/markdown"
			},
			{
				uri: "flow://guide/search-and-edit",
				name: "Search and semantic edits",
				description: "How to use flow-search results with nodeId/path mutations.",
				mimeType: "text/markdown"
			},
			{
				uri: "flow://guide/custom-blocks",
				name: "Custom blocks and types",
				description: "Rules for project-local blocks and property types.",
				mimeType: "text/markdown"
			}
		];
	}

	function resourceText(uri) {
		switch (String(uri || "")) {
		case "flow://guide/start":
			return [
				"# Flow MCP Start",
				"",
				"Default route for an unknown Flow project:",
				"1. Call `flow-search` first. Prefer `project` scope; use `scope:\"workspace\"` only for discovery across loaded Studio projects.",
				"2. Inspect only useful matches with `flow-tree` or `flow-get`.",
				"3. Call `flow-context` before writing expressions or templates.",
				"4. Edit with `flow-edit`, then validate with `flow-test` or `flow-output-schema`.",
				"",
				"Keep responses small: after reading this guide, pass `doc:false,hints:false` on repeated tool calls."
			].join("\n");
		case "flow://guide/authoring":
			return [
				"# Flow Authoring Cycle",
				"",
				"Create or modify a Flow sidecar with the smallest loop that proves behavior:",
				"- `flow-list` only to enumerate known Flow names.",
				"- `flow-search` to locate nodes, schemas, block docs or existing examples.",
				"- `flow-catalog` or `flow-block-get` only when a block contract is needed.",
				"- `flow-context` at the target node to know `input`, `config`, `flow`, `current` and `result` paths.",
				"- Prefer `flow-node-add/edit/move/delete/duplicate` for common node operations.",
				"- Use `flow-edit` for lower-level mutations; use `dryRun:true` when unsure.",
				"- `flow-test` with realistic input and `includeTrace:true` only while debugging.",
				"",
				"Do not read every Flow sidecar up front. Search first, then open the narrow target."
			].join("\n");
		case "flow://guide/search-and-edit":
			return [
				"# Search And Edit",
				"",
				"`flow-search` is the Flow equivalent of `rg`.",
				"Useful arguments: `query`, `kinds:[\"node\"]`, `context:1`, `limit`, `cursor`.",
				"Each node match returns `flowQName`, `flow`, `nodeId`, canonical JSON Pointer `path`, `summary` and `snippet`.",
				"",
				"Preferred mutations:",
				"- Change a node property: `{op:\"replace\", nodeId:\"setMessage\", property:\"value\", value:\"Hello\"}`.",
				"- Merge node properties: `{op:\"merge\", nodeId:\"setMessage\", value:{comment:\"...\"}}`.",
				"- Insert near a node: `{op:\"insert\", afterNodeId:\"setMessage\", value:{id:\"log\", block:\"log\", message:\"done\"}}`.",
				"- Insert in a container: `{op:\"append\", parentNodeId:\"loopItems\", slot:\"nodes\", value:{id:\"push\", block:\"json.push\"}}`.",
				"",
				"Common MCP tools wrap those mutations: `flow-node-add`, `flow-node-edit`, `flow-node-move`, `flow-node-delete`, `flow-node-duplicate`.",
				"`flow-node-add` requires a stable id. `flow-node-duplicate` requires `newId` or `properties.id`.",
				"",
				"Use `path` only for low-level mutations or when no stable `nodeId` exists."
			].join("\n");
		case "flow://guide/custom-blocks":
			return [
				"# Custom Blocks And Types",
				"",
				"Prefer core blocks and core property types. Add project-local vocabulary only when it expresses a reusable domain concept.",
				"",
				"Blocks live under `libs/flow/blocks/*.js` and expose `catalog`, optional `analyze`, and `run`.",
				"Types live under `libs/flow/types/*.js` and may point to HTML editors under `libs/flow/types/editors/*.html`.",
				"",
				"Use `flow-block-create` or `flow-type-create` for project-local additions, then validate with `flow-block-test`, `flow-catalog` or `flow-type-get`.",
				"Duplicate a core/shared block with `flow-block-duplicate` before editing it with `flow-block-edit`.",
				"Keep one-off procedural code exceptional; prefer a small Flow made of existing blocks."
			].join("\n");
		default:
			throw new Error("Unknown Flow MCP resource: " + uri);
		}
	}

	function readResource(uri) {
		return {
			contents: [{
				uri: String(uri || ""),
				mimeType: "text/markdown",
				text: resourceText(uri)
			}]
		};
	}

	function tools() {
		return [
			{
				name: "flow-catalog",
				description: "List Flow blocks exposed by the current Flow engine.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({})
				}
			},
			{
				name: "flow-analyze",
				description: "Analyze a Flow YAML source and return reads, writes and nodes.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						flowSource: { type: "string" }
					}),
					required: ["flowSource"]
				}
			},
			{
				name: "flow-search",
				description: "Search Flow sidecars, nodes, catalog entries and learned schemas. Returns flowQName, nodeId, path and snippets; use context=1 like rg -C 1.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						scope: { type: "string", description: "project or workspace. Workspace scans loaded Studio projects only." },
						query: { type: "string" },
						q: { type: "string" },
						name: { type: "string", description: "Optional Flow sidecar name to search." },
						kinds: {
							type: "array",
							items: { type: "string" },
							description: "Optional kinds: flow, node, block, type, schema."
						},
						context: { type: "number", description: "Nearby node summaries, like rg -C. Default 0." },
						includeDefinition: { type: "boolean" },
						limit: { type: "number" },
						cursor: { type: "string" },
						doc: { type: "boolean" },
						hints: { type: "boolean" }
					})
				}
			},
			{
				name: "flow-context",
				description: "Return visible scope paths at a Flow node for Studio pickers or LLM guidance.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowSource: { type: "string" },
						flowName: { type: "string" },
						node: { type: "string" },
						path: { type: "string" },
						property: { type: "string" },
						mode: { type: "string" },
						include: {
							type: "array",
							items: { type: "string" }
						},
						detail: { type: "string" }
					}),
				}
			},
			{
				name: "flow-tree",
				description: "Describe the virtual Flow or FlowEngine tree an authoring UI or agent should see.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						target: { type: "string", description: "flow or engine. Defaults to flow." },
						name: { type: "string" },
						flowSource: { type: "string" },
						engineSource: { type: "string" },
						engineQName: { type: "string" }
					})
				}
			},
			{
				name: "flow-apply",
				description: "Apply one or more mutations to Flow or FlowEngine YAML and return the updated source without writing it.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						target: { type: "string", description: "flow or engine. Defaults to flow." },
						name: { type: "string" },
						flowSource: { type: "string" },
						engineSource: { type: "string" },
						mutation: { type: "object" },
						mutations: { type: "array", items: { type: "object" } }
					})
				}
			},
			{
				name: "flow-edit",
				description: "Apply one or more mutations to a named project Flow sidecar and write it back unless dryRun=true.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowSource: { type: "string" },
						mutation: { type: "object" },
						mutations: { type: "array", items: { type: "object" } },
						dryRun: { type: "boolean" }
					}),
					required: ["name"]
				}
			},
			{
				name: "flow-node-add",
				description: "Add one Flow node to a named Flow sidecar using beforeNodeId, afterNodeId or parentNodeId+slot.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						id: { type: "string" },
						block: { type: "string" },
						node: { type: "object" },
						properties: { type: "object" },
						beforeNodeId: { type: "string" },
						afterNodeId: { type: "string" },
						parentNodeId: { type: "string" },
						slot: { type: "string" },
						index: { type: "string" },
						dryRun: { type: "boolean" }
					}),
					required: ["name"]
				}
			},
			{
				name: "flow-node-edit",
				description: "Edit one Flow node property or merge node properties by nodeId.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						nodeId: { type: "string" },
						property: { type: "string" },
						value: {},
						properties: { type: "object" },
						dryRun: { type: "boolean" }
					}),
					required: ["name", "nodeId"]
				}
			},
			{
				name: "flow-node-move",
				description: "Move one Flow node by nodeId near another node or into a parent slot.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						nodeId: { type: "string" },
						beforeNodeId: { type: "string" },
						afterNodeId: { type: "string" },
						parentNodeId: { type: "string" },
						slot: { type: "string" },
						index: { type: "string" },
						dryRun: { type: "boolean" }
					}),
					required: ["name", "nodeId"]
				}
			},
			{
				name: "flow-node-delete",
				description: "Delete one Flow node by nodeId.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						nodeId: { type: "string" },
						dryRun: { type: "boolean" }
					}),
					required: ["name", "nodeId"]
				}
			},
			{
				name: "flow-node-duplicate",
				description: "Duplicate one Flow node by nodeId, optionally patching id/properties while copying.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						nodeId: { type: "string" },
						newId: { type: "string" },
						properties: { type: "object" },
						beforeNodeId: { type: "string" },
						afterNodeId: { type: "string" },
						parentNodeId: { type: "string" },
						slot: { type: "string" },
						index: { type: "string" },
						dryRun: { type: "boolean" }
					}),
					required: ["name", "nodeId"]
				}
			},
			{
				name: "flow-output-schema",
				description: "Return the best known JSON output schema for a Flow source or named Flow sidecar.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowName: { type: "string" },
						flowSource: { type: "string" }
					})
				}
			},
			{
				name: "flow-schema-reset",
				description: "Delete learned schema files for a Flow or one Flow node so the next successful run learns them again.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						flowName: { type: "string" },
						name: { type: "string" },
						node: { type: "string" },
						property: { type: "string" },
						out: { type: "string" }
					})
				}
			},
			{
				name: "flow-run",
				description: "Run a Flow YAML source with optional input and config objects.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						flowSource: { type: "string" },
						input: { type: "object" },
						config: { type: "object" },
						includeFlow: { type: "boolean" },
						includeTrace: { type: "boolean" }
					}),
					required: ["flowSource"]
				}
			},
			{
				name: "flow-list",
				description: "List project Flow sidecars.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({})
				}
			},
			{
				name: "flow-get",
				description: "Read one project Flow sidecar.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" }
					}),
					required: ["name"]
				}
			},
			{
				name: "flow-set",
				description: "Validate and write one project Flow sidecar.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowSource: { type: "string" }
					}),
					required: ["name", "flowSource"]
				}
			},
			{
				name: "flow-test",
				description: "Run a named project Flow sidecar or a provided Flow source.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowSource: { type: "string" },
						input: { type: "object" },
						config: { type: "object" },
						includeFlow: { type: "boolean" },
						includeTrace: { type: "boolean" }
					})
				}
			},
			{
				name: "flow-block-list",
				description: "List Flow blocks with their origin.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({})
				}
			},
			{
				name: "flow-block-get",
				description: "Read one Flow block source.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" }
					}),
					required: ["name"]
				}
			},
			{
				name: "flow-block-create",
				description: "Create or replace a project-local Flow block.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						source: { type: "string" },
						overwrite: { type: "boolean" }
					}),
					required: ["name", "source"]
				}
			},
			{
				name: "flow-block-duplicate",
				description: "Duplicate an existing Flow block into a project-local block with a new name.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						fromName: { type: "string" },
						toName: { type: "string" },
						overwrite: { type: "boolean" }
					}),
					required: ["fromName", "toName"]
				}
			},
			{
				name: "flow-block-edit",
				description: "Replace the source of an existing project-local Flow block.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						source: { type: "string" }
					}),
					required: ["name", "source"]
				}
			},
			{
				name: "flow-type-list",
				description: "List Flow property types with descriptors and usage counts.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({})
				}
			},
			{
				name: "flow-type-get",
				description: "Read one Flow property type source and descriptor.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" }
					}),
					required: ["name"]
				}
			},
			{
				name: "flow-type-create",
				description: "Create or replace a project-local Flow property type source.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						source: { type: "string" },
						overwrite: { type: "boolean" }
					}),
					required: ["name", "source"]
				}
			},
			{
				name: "flow-block-test",
				description: "Run a Flow YAML source, typically to validate a custom block.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						flowSource: { type: "string" },
						input: { type: "object" },
						config: { type: "object" },
						includeFlow: { type: "boolean" },
						includeTrace: { type: "boolean" }
					}),
					required: ["flowSource"]
				}
			}
		];
	}

	function toolResult(value) {
		return {
			content: textContent(value),
			structuredContent: value
		};
	}

	function withNamedFlowSource(ctx, args) {
		args = args || {};
		if ((args.flowSource === undefined || args.flowSource === null || String(args.flowSource).trim() === "") && args.name) {
			var flow = ctx.flowGet(args.name, args);
			args.flowSource = flow.source;
			if (!args.flowName) {
				args.flowName = args.name;
			}
		}
		return args;
	}

	function applyNamedFlowMutation(ctx, args) {
		args = withNamedFlowSource(ctx, args || {});
		var mutationResult = ctx.applyMutationSource(args);
		if (args.dryRun === true || !args.name) {
			return mutationResult;
		}
		var write = ctx.flowSet(args.name, mutationResult.source, args);
		mutationResult.written = {
			name: write.name,
			file: write.file,
			analysis: write.analysis
		};
		return mutationResult;
	}

	function copyJson(value) {
		return value === undefined || value === null ? {} : JSON.parse(JSON.stringify(value));
	}

	function nodeFromArgs(args) {
		var node = copyJson(args.node || {});
		if (args.id !== undefined && args.id !== null && String(args.id) !== "") {
			node.id = String(args.id);
		}
		if (args.block !== undefined && args.block !== null && String(args.block) !== "") {
			node.block = String(args.block);
		}
		Object.keys(args.properties || args.props || {}).forEach(function (key) {
			node[key] = (args.properties || args.props)[key];
		});
		if (!node.block) {
			throw new Error("flow-node-add requires block or node.block.");
		}
		if (!node.id) {
			throw new Error("flow-node-add requires id or node.id for stable future edits.");
		}
		return node;
	}

	function copyPositionArgs(args, mutation) {
		["beforeNodeId", "afterNodeId", "parentNodeId", "slot", "index"].forEach(function (key) {
			if (args[key] !== undefined && args[key] !== null && String(args[key]) !== "") {
				mutation[key] = args[key];
			}
		});
		return mutation;
	}

	function nodeAddMutation(args) {
		return copyPositionArgs(args, {
			op: "insert",
			value: nodeFromArgs(args)
		});
	}

	function nodeEditMutation(args) {
		if (args.property !== undefined && args.property !== null && String(args.property) !== "") {
			return {
				op: "replace",
				nodeId: args.nodeId,
				property: args.property,
				value: args.value
			};
		}
		var patch = args.properties || args.props;
		if (!patch || typeof patch !== "object") {
			throw new Error("flow-node-edit requires property+value or properties.");
		}
		return {
			op: "merge",
			nodeId: args.nodeId,
			value: patch
		};
	}

	function nodeMoveMutation(args) {
		if (!args.beforeNodeId && !args.afterNodeId && !args.parentNodeId && args.index === undefined) {
			throw new Error("flow-node-move requires beforeNodeId, afterNodeId, parentNodeId or index.");
		}
		return copyPositionArgs(args, {
			op: "move",
			fromNodeId: args.nodeId
		});
	}

	function nodeDuplicateMutation(args) {
		var patch = copyJson(args.properties || args.props || {});
		if (args.newId || args.newNodeId) {
			patch.id = String(args.newId || args.newNodeId);
		}
		if (!patch.id) {
			throw new Error("flow-node-duplicate requires newId or properties.id to avoid duplicate node ids.");
		}
		return copyPositionArgs(args, {
			op: "copy",
			fromNodeId: args.nodeId,
			patch: patch
		});
	}

	function applyNodeMutation(ctx, args, mutation) {
		args = args || {};
		var request = {};
		Object.keys(args).forEach(function (key) {
			request[key] = args[key];
		});
		request.mutation = mutation;
		delete request.node;
		delete request.properties;
		delete request.props;
		return applyNamedFlowMutation(ctx, request);
	}

	function searchWorkspace(ctx, args) {
		args = args || {};
		var all = [];
		loadedProjectTargets().forEach(function (target) {
			var searchArgs = {};
			Object.keys(args).forEach(function (key) {
				searchArgs[key] = args[key];
			});
			searchArgs.scope = "project";
			searchArgs.project = target.project;
			searchArgs.projectDir = target.projectDir;
			searchArgs.limit = 500;
			searchArgs.cursor = 0;
			searchArgs.doc = false;
			searchArgs.hints = false;
			try {
				var result = ctx.searchFlow(searchArgs);
				(result.matches || []).forEach(function (match) {
					all.push(match);
				});
			} catch (e) {
			}
		});
		var offset = Math.max(0, parseInt(args.cursor || "0", 10) || 0);
		var limit = Math.max(1, Math.min(500, parseInt(args.limit || "50", 10) || 50));
		var page = all.slice(offset, offset + limit);
		var out = {
			ok: true,
			query: String(args.query || args.q || ""),
			scope: "workspace",
			count: page.length,
			total: all.length,
			matches: page,
			nextCursor: offset + limit < all.length ? String(offset + limit) : null
		};
		if (args.doc !== false) {
			out.doc = "Workspace search scans loaded Studio projects only, without opening closed projects.";
		}
		if (args.hints !== false) {
			out.hints = [
				"Use project='Name' for faster focused search.",
				"Use kinds=['node'] and context=1 to emulate rg -C 1 over Flow nodes."
			];
		}
		return out;
	}

	function callTool(ctx, name, args) {
		args = args || {};
		if (!(name === "flow-search" && String(args.scope || "") === "workspace" && !args.project && !args.projectDir)) {
			args = resolveProjectDir(args);
		}
		switch (name) {
		case "flow-catalog":
			return toolResult(ctx.blockList(args));
		case "flow-analyze":
			return toolResult(ctx.analyzeFlowSource(args.flowSource || "", args));
		case "flow-search":
			if (String(args.scope || "") === "workspace" && !args.project && !args.projectDir) {
				return toolResult(searchWorkspace(ctx, args));
			}
			return toolResult(ctx.searchFlow(args));
		case "flow-context":
			args = withNamedFlowSource(ctx, args);
			return toolResult(ctx.contextFlowSource(args));
		case "flow-tree":
			args = withNamedFlowSource(ctx, args);
			return toolResult(ctx.describeTreeSource(args));
		case "flow-apply":
			args = withNamedFlowSource(ctx, args);
			return toolResult(ctx.applyMutationSource(args));
		case "flow-edit":
			return toolResult(applyNamedFlowMutation(ctx, args));
		case "flow-node-add":
			return toolResult(applyNodeMutation(ctx, args, nodeAddMutation(args)));
		case "flow-node-edit":
			return toolResult(applyNodeMutation(ctx, args, nodeEditMutation(args)));
		case "flow-node-move":
			return toolResult(applyNodeMutation(ctx, args, nodeMoveMutation(args)));
		case "flow-node-delete":
			return toolResult(applyNodeMutation(ctx, args, {
				op: "delete",
				nodeId: args.nodeId
			}));
		case "flow-node-duplicate":
			return toolResult(applyNodeMutation(ctx, args, nodeDuplicateMutation(args)));
		case "flow-output-schema":
			args = withNamedFlowSource(ctx, args);
			return toolResult(ctx.outputSchemaSource(args));
		case "flow-schema-reset":
			return toolResult(ctx.schemaReset(args));
		case "flow-run":
			var execution = ctx.runFlowSource(args.flowSource || "", args.config || {}, {
				input: args.input || {},
				projectDir: args.projectDir,
				includeTrace: args.includeTrace === true
			});
			if (args.includeFlow !== true) {
				delete execution.flow;
			}
			if (args.includeTrace !== true) {
				delete execution.trace;
			}
			return toolResult(execution);
		case "flow-list":
			return toolResult(ctx.flowList(args));
		case "flow-get":
			return toolResult(ctx.flowGet(args.name, args));
		case "flow-set":
			return toolResult(ctx.flowSet(args.name, args.flowSource || "", args));
		case "flow-test":
			var flowTest = ctx.flowTest(args);
			if (args.includeFlow !== true) {
				delete flowTest.flow;
			}
			if (args.includeTrace !== true) {
				delete flowTest.trace;
			}
			return toolResult(flowTest);
		case "flow-block-list":
			return toolResult(ctx.blockList(args));
		case "flow-block-get":
			return toolResult(ctx.blockGet(args.name, args));
		case "flow-block-create":
			return toolResult(ctx.blockCreate(args.name, args.source || "", args.overwrite === true, args));
		case "flow-block-duplicate":
			return toolResult(ctx.blockDuplicate(args.fromName || args.from, args.toName || args.name, args.overwrite === true, args));
		case "flow-block-edit":
			return toolResult(ctx.blockEdit(args.name, args.source || "", args));
		case "flow-type-list":
			return toolResult(ctx.typeList(args));
		case "flow-type-get":
			return toolResult(ctx.typeGet(args.name, args));
		case "flow-type-create":
			return toolResult(ctx.typeCreate(args.name, args.source || "", args.overwrite === true, args));
		case "flow-block-test":
			var test = ctx.blockTest(args.flowSource || "", args.config || {}, {
				input: args.input || {},
				projectDir: args.projectDir,
				includeTrace: args.includeTrace === true
			});
			if (args.includeFlow !== true) {
				delete test.flow;
			}
			if (args.includeTrace !== true) {
				delete test.trace;
			}
			return toolResult(test);
		default:
			throw new Error("Unknown Flow MCP tool: " + name);
		}
	}

	function handle(ctx, request) {
		var id = request.id;
		switch (request.method) {
		case "initialize":
			return jsonRpcResult(id, {
				protocolVersion: "2025-06-18",
				serverInfo: {
					name: "convertigo-flow-mcp",
					version: "0.1.0"
				},
				capabilities: {
					tools: {},
					resources: {}
				}
			});
		case "tools/list":
			return jsonRpcResult(id, { tools: tools() });
		case "tools/call":
			try {
				return jsonRpcResult(id, callTool(ctx, request.params && request.params.name,
					request.params && request.params.arguments));
			} catch (e) {
				return jsonRpcError(id, -32000, String(e.message || e), {
					code: String(e.code || "FLOW_MCP_TOOL_ERROR"),
					hint: e.hint ? String(e.hint) : ""
				});
			}
		case "resources/list":
			return jsonRpcResult(id, { resources: resources() });
		case "resources/read":
			try {
				return jsonRpcResult(id, readResource(request.params && request.params.uri));
			} catch (e) {
				return jsonRpcError(id, -32000, String(e.message || e), {
					code: "FLOW_MCP_RESOURCE_ERROR"
				});
			}
		default:
			return jsonRpcError(id, -32601, "Method not found: " + request.method);
		}
	}

	function parseRequest(value) {
		value = value || {};
		if (typeof value === "string") {
			return JSON.parse(value);
		}
		return value;
	}

	return {
		name: "mcp.flow",

		catalog: function () {
			return {
				name: "mcp.flow",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				icon: "mdi:tools",
				props: {
					request: { kind: "expression", type: "object" },
					out: { kind: "path", mode: "write" }
				},
				description: "Handles Flow-native MCP JSON-RPC tools and guide resources."
			};
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = parseRequest(ctx.expr(props.request || "config.request"));
			if (Object.prototype.toString.call(request) === "[object Array]") {
				return request.map(function (item) {
					return handle(ctx, item);
				});
			}
			return handle(ctx, request);
		}
	};
}())
