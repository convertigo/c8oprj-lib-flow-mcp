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

	function acceptNotification(ctx) {
		try {
			ctx.convertigoContext().setResponseStatus(202, "Accepted");
		} catch (e) {
			// Standalone smoke tests have no servlet response to update.
		}
		return {};
	}

	function listNames(items, limit) {
		items = items || [];
		limit = limit || 50;
		return items.slice(0, limit).map(function (item) {
			return item && (item.name || item.id || item.flow || item.nodeId || item.summary) || String(item);
		});
	}

	function summarizeLargeValue(value) {
		if (!value || typeof value !== "object") {
			return value;
		}
		var out = {
			summary: "Full response is available in structuredContent."
		};
		["ok", "status", "name", "file", "target", "detail", "query", "scope", "project", "count", "total", "nextCursor", "message"].forEach(function (key) {
			if (value[key] !== undefined && value[key] !== null && value[key] !== "") {
				out[key] = value[key];
			}
		});
		if (value.error) {
			out.error = value.error;
		}
		if (value.result !== undefined && value.result !== null) {
			out.result = value.result;
		}
		if (value.registration) {
			out.registration = value.registration;
		}
		if (value.definition) {
			out.definition = {
				version: value.definition.version || 1,
				nodes: value.definition.nodes ? value.definition.nodes.length : 0
			};
		}
		if (value.analysis) {
			out.analysis = {
				reads: value.analysis.reads || [],
				writes: value.analysis.writes || [],
				nodes: (value.analysis.nodes || []).map(function (node) {
					return node.id || node.block || "";
				})
			};
		}
		if (value.blocks) {
			out.blocks = listNames(value.blocks, 100);
			out.blockCount = value.blocks.length;
		}
		if (value.types) {
			out.types = listNames(value.types, 100);
			out.typeCount = value.types.length;
		}
		if (value.flows) {
			out.flows = listNames(value.flows, 100);
			out.flowCount = value.flows.length;
		}
		if (value.matches) {
			out.matches = (value.matches || []).slice(0, 25).map(function (match) {
				return {
					kind: match.kind,
					flow: match.flow,
					nodeId: match.nodeId,
					name: match.name,
					path: match.path,
					summary: match.summary,
					next: match.next
				};
			});
		}
		if (value.children) {
			out.children = (value.children || []).slice(0, 50).map(function (child) {
				return {
					name: child.name,
					kind: child.kind,
					type: child.type,
					summary: child.summary
				};
			});
			out.childCount = value.children.length;
		}
		if (value.scopes) {
			out.scopes = {};
			Object.keys(value.scopes).forEach(function (key) {
				var scope = value.scopes[key];
				out.scopes[key] = Object.prototype.toString.call(scope) === "[object Array]"
					? scope.length
					: scope && scope.paths ? scope.paths.length : 0;
			});
		}
		if (value.next) {
			out.next = value.next;
		}
		return out;
	}

	function textContent(value) {
		var text = JSON.stringify(value);
		if (text.length > 1500) {
			text = JSON.stringify(summarizeLargeValue(value));
		}
		return [{
			type: "text",
			text: text
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

	function boolArg(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		if (value === true || value === false) {
			return value;
		}
		var text = String(value).toLowerCase();
		if (text === "true" || text === "1" || text === "yes") {
			return true;
		}
		if (text === "false" || text === "0" || text === "no") {
			return false;
		}
		return fallback;
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

	function studioRefreshQName(qname) {
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		var System = java.lang.System;
		var result = {
			status: "pending",
			message: "",
			qname: String(qname || ""),
			refreshed: false,
			refreshedQName: "",
			studioMode: false,
			timestamp: Number(System.currentTimeMillis())
		};
		try {
			result.studioMode = Engine.isStudioMode() === true;
		} catch (_ignoreStudioMode) {
			result.studioMode = false;
		}
		if (!result.studioMode) {
			result.status = "skipped";
			result.message = "Refresh skipped: Convertigo Studio required";
			return result;
		}
		if (!result.qname) {
			result.status = "skipped";
			result.message = "Refresh skipped: empty QName";
			return result;
		}
		try {
			var target = Engine.theApp.databaseObjectsManager.getDatabaseObjectByQName(result.qname);
			if (target == null) {
				result.status = "skipped";
				result.message = "Refresh skipped: database object not found";
				return result;
			}
			var ConvertigoPlugin = Packages.com.twinsoft.convertigo.eclipse.ConvertigoPlugin;
			var Runnable = Packages.java.lang.Runnable;
			var plugin = ConvertigoPlugin.getDefault();
			if (plugin == null) {
				result.status = "skipped";
				result.message = "Refresh skipped: Project Explorer view not available";
				return result;
			}
			ConvertigoPlugin.syncExec(new Runnable({ run: function () {
				try {
					var view = plugin.getProjectExplorerView();
					if (view == null) {
						result.status = "skipped";
						result.message = "Refresh skipped: Project Explorer view not available";
						return;
					}
					view.reloadDatabaseObject(target);
					result.status = "refreshed";
					result.message = "Project Explorer refreshed";
					result.refreshed = true;
					result.refreshedQName = String(target.getQName());
				} catch (e) {
					result.status = "error";
					result.message = String(e);
					result.error = String(e);
				}
			}}));
		} catch (e) {
			result.status = "error";
			result.message = String(e);
			result.error = String(e);
		}
		return result;
	}

	function projectSequenceByName(project, name) {
		try {
			return project.getSequenceByName(String(name || ""));
		} catch (_ignoreMissingSequence) {
			return null;
		}
	}

	function isFlowDbo(dbo) {
		if (dbo == null) {
			return false;
		}
		try {
			var Flow = Packages.com.twinsoft.convertigo.beans.flow.Flow;
			return Flow.class.isInstance(dbo);
		} catch (_ignoreFlowClass) {
		}
		try {
			return String(dbo.getClass().getName()) === "com.twinsoft.convertigo.beans.flow.Flow";
		} catch (_ignoreClassName) {
			return false;
		}
	}

	function registerFlowDbo(args, writeResult) {
		args = args || {};
		var result = {
			requested: false,
			registered: false,
			created: false,
			updated: false,
			saved: false,
			refreshed: false,
			qname: "",
			message: ""
		};
		if (!args.project || boolArg(args.register, true) !== true) {
			result.message = !args.project ? "Skipped: project is required to register a Flow DBO" : "Skipped: register=false";
			return result;
		}
		result.requested = true;
		if (typeof Packages === "undefined") {
			result.message = "Skipped: live Convertigo runtime is unavailable";
			return result;
		}
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		var project = Engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(args.project), false);
		if (project == null) {
			throw new Error("Unable to register Flow DBO: unknown project " + args.project);
		}
		var name = String(args.name || "");
		var sequence = projectSequenceByName(project, name);
		var flow = null;
		if (sequence != null) {
			if (!isFlowDbo(sequence)) {
				throw new Error("Unable to register Flow DBO: " + args.project + "." + name + " already exists and is not a Flow.");
			}
			flow = sequence;
			result.updated = true;
		} else {
			var Flow = Packages.com.twinsoft.convertigo.beans.flow.Flow;
			flow = new Flow();
			flow.bNew = true;
			flow.setName(name);
			flow.setIncludeTrace(boolArg(args.includeTrace, false));
			project.add(flow);
			result.created = true;
		}
		if (writeResult && writeResult.source !== undefined && writeResult.source !== null) {
			flow.setFlowSource(String(writeResult.source));
		}
		result.registered = true;
		result.qname = String(flow.getQName());
		try {
			flow.hasChanged = true;
			project.hasChanged = true;
		} catch (_ignoreDirtyFlags) {
		}
		if (boolArg(args.autoSave, true) === true) {
			Engine.theApp.databaseObjectsManager.exportProject(project);
			result.saved = true;
			try {
				Engine.theApp.schemaManager.clearCache(String(project.getName()));
				result.schemaCacheCleared = true;
			} catch (_ignoreSchemaCache) {
			}
		}
		if (boolArg(args.refresh, true) === true) {
			result.studioRefresh = studioRefreshQName(String(project.getName()));
			result.refreshed = result.studioRefresh && result.studioRefresh.refreshed === true;
		}
		result.message = result.created ? "Flow DBO created" : "Flow DBO updated";
		return result;
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
				"1. Call `flow-search` first with natural tokens, for example `GetFeed requestable call`. Prefer `project` scope; use `scope:\"workspace\"` only for discovery across loaded Studio projects.",
				"2. Inspect only useful matches with `flow-tree` or `flow-get`; do not read the whole catalog when a matching Flow exists.",
				"3. Call `flow-context` before writing expressions or templates.",
				"4. Edit with `flow-edit`, then validate with `flow-test` or `flow-output-schema`.",
				"5. For custom block/type/editor source code, use `flow-resource-search`, `flow-resource-get`, then `flow-resource-patch` with `baseHash`.",
				"",
				"`flow-get` returns both YAML `source` and a JSON `definition`. `flow-set`, `flow-run`, `flow-test`, `flow-tree` and `flow-apply` accept that same `definition` shape, so an agent may get, modify and set without rewriting YAML by hand.",
				"When a live `project` is provided, `flow-set` and `flow-edit` register/save the Flow DBO by default so it is callable as a requestable. Use `register:false` only for sidecar-only tests.",
				"",
				"Keep responses small: after reading this guide, pass `doc:false,hints:false` on repeated tool calls."
			].join("\n");
		case "flow://guide/authoring":
			return [
				"# Flow Authoring Cycle",
				"",
				"Create or modify a Flow sidecar with the smallest loop that proves behavior:",
				"- `flow-list` only to enumerate known Flow names.",
				"- `flow-search` to locate nodes, schemas, block docs or existing examples. Multi-word queries match unordered tokens, like a small `rg`.",
				"- Avoid `flow-catalog detail:\"compact\"` when an example exists. Use `flow-block-get` for one unknown block, and `flow-catalog` summary only to discover names.",
				"- `flow-context` at the target node to know `input`, `config`, `flow`, `current` and `result` paths.",
				"- For broad edits, use `flow-get.definition`, modify that object, then send it back through `flow-set`.",
				"- Prefer `flow-node-add/edit/move/delete/duplicate` for common node operations.",
				"- For source resources (`libs/flow/blocks`, `libs/flow/types`, type editors), use search/get/patch instead of replacing whole files.",
				"- Use `flow-edit` for lower-level mutations; use `dryRun:true` when unsure.",
				"- With a live `project`, named write tools register/save the Flow DBO and refresh Studio by default. This makes the Flow callable through normal `?__sequence=Name` execution.",
				"- `flow-test` with realistic input and `includeTrace:true` only while debugging.",
				"",
				"Do not read every Flow sidecar up front. Search first, then open the narrow target."
			].join("\n");
		case "flow://guide/search-and-edit":
			return [
				"# Search And Edit",
				"",
				"`flow-search` is the Flow equivalent of `rg`; multi-word queries match unordered tokens.",
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
				"Block source is JavaScript executed by Rhino ES6 inside the Convertigo JVM. Java classes are available through `Packages`; Node.js APIs such as `require`, npm modules and browser globals are not.",
				"Minimal block source shape: `(function(){ return { name:\"demo.block\", catalog:function(){...}, analyze:function(ctx,node){...}, run:function(ctx,node){...} }; }())`.",
				"Use `ctx.props(node)`, `ctx.template(value)`, `ctx.expr(value)`, `ctx.read(path)`, `ctx.write(path,value)` and return a value when the catalog has an `out` path property.",
				"Types live under `libs/flow/types/*.js` and may point to HTML editors under `libs/flow/types/editors/*.html`.",
				"",
				"Use `flow-block-create` or `flow-type-create` for project-local additions, then validate with `flow-block-test`, `flow-catalog` or `flow-type-get`.",
				"For maintenance, prefer `flow-resource-search` + `flow-resource-get` + `flow-resource-patch` with `baseHash`; it is closer to how coding agents work on files.",
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
				description: "List Flow blocks exposed by the current Flow engine. Summary by default; pass detail='compact' for prop docs, detail='full' only for icons/type usages.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						detail: {
							type: "string",
							enum: ["compact", "summary", "full"],
							description: "Default summary. compact includes property docs; full includes icon paths and type usages."
						}
					})
				}
			},
			{
				name: "flow-analyze",
				description: "Analyze a Flow YAML source or definition object and return reads, writes and nodes.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						flowSource: { type: "string" },
						definition: { type: "object", description: "Same model returned by flow-get.definition." }
					})
				}
			},
			{
				name: "flow-search",
				description: "Search Flow sidecars, nodes, catalog entries and learned schemas. Multi-word queries match unordered tokens. Returns flowQName, nodeId, path and snippets; use context=1 like rg -C 1.",
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
				name: "flow-resource-search",
				description: "Search project-local Flow source resources, like rg over whitelisted blocks/types/editors. Use before get/patch when maintaining JS/HTML/CSS.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						query: { type: "string" },
						q: { type: "string" },
						limit: { type: "number" },
						cursor: { type: "string" },
						maxFileBytes: { type: "number" },
						doc: { type: "boolean" },
						hints: { type: "boolean" }
					})
				}
			},
			{
				name: "flow-resource-get",
				description: "Read one project-local Flow source resource and return content plus hash. Pass hash as baseHash to flow-resource-patch.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						path: {
							type: "string",
							description: "Project-relative whitelisted path such as libs/flow/blocks/demo.block.js."
						},
						maxBytes: { type: "number" },
						allowLarge: { type: "boolean" }
					}),
					required: ["path"]
				}
			},
			{
				name: "flow-resource-patch",
				description: "Apply a unified diff to one project-local Flow source resource. Requires path; baseHash is strongly recommended; validates block/type JS by default; hunk line numbers may be approximate when context is unique.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						path: {
							type: "string",
							description: "Project-relative whitelisted path such as libs/flow/blocks/demo.block.js."
						},
						baseHash: { type: "string", description: "Hash returned by flow-resource-get." },
						patch: { type: "string", description: "Unified diff with @@ hunks." },
						unifiedDiff: { type: "string", description: "Alias for patch." },
						dryRun: { type: "boolean" },
						validate: { type: "boolean", description: "Default true." },
						includeContent: { type: "boolean" }
					}),
					required: ["path"]
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
						detail: {
							type: "string",
							enum: ["compact", "summary", "normal"],
							description: "Default normal. summary is an alias for compact."
						}
					}),
				}
			},
			{
				name: "flow-tree",
				description: "Describe the virtual Flow or FlowEngine tree an authoring UI or agent should see. Accepts flowSource, name, or flow-get.definition.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						target: { type: "string", description: "flow or engine. Defaults to flow." },
						name: { type: "string" },
						flowSource: { type: "string" },
						definition: { type: "object", description: "Same model returned by flow-get.definition." },
						engineSource: { type: "string" },
						engineQName: { type: "string" }
					})
				}
			},
			{
				name: "flow-apply",
				description: "Apply one or more mutations to Flow or FlowEngine YAML/definition and return the updated source without writing it.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						target: { type: "string", description: "flow or engine. Defaults to flow." },
						name: { type: "string" },
						flowSource: { type: "string" },
						definition: { type: "object", description: "Same model returned by flow-get.definition." },
						engineSource: { type: "string" },
						mutation: { type: "object" },
						mutations: { type: "array", items: { type: "object" } }
					})
				}
			},
			{
				name: "flow-edit",
				description: "Apply mutations to a named Flow sidecar. With project, registers/saves the Flow DBO and refreshes Studio unless dryRun=true or register=false.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowSource: { type: "string" },
						mutation: { type: "object" },
						mutations: { type: "array", items: { type: "object" } },
						dryRun: { type: "boolean" },
						register: { type: "boolean", description: "Default true when project is provided. Create/update the Flow DBO so it is requestable." },
						autoSave: { type: "boolean", description: "Default true. Export the project after DBO registration." },
						refresh: { type: "boolean", description: "Default true. Refresh Studio tree when Studio is available." }
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
				description: "Return the best known JSON output schema for a Flow source, definition, or named Flow sidecar.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowName: { type: "string" },
						flowSource: { type: "string" },
						definition: { type: "object", description: "Same model returned by flow-get.definition." }
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
				description: "Run a Flow YAML source or definition object with optional input and config objects.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						flowSource: { type: "string" },
						definition: { type: "object", description: "Same model returned by flow-get.definition." },
						input: { type: "object" },
						config: { type: "object" },
						includeFlow: { type: "boolean" },
						includeTrace: { type: "boolean" }
					})
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
				description: "Read one project Flow sidecar. Returns source and definition; the definition can be edited and passed back to flow-set.",
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
				description: "Create or replace one project Flow sidecar from flowSource or flow-get.definition. With project, also registers/saves a Flow DBO unless register=false.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowSource: { type: "string" },
						definition: { type: "object", description: "Same model returned by flow-get.definition." },
						register: { type: "boolean", description: "Default true when project is provided. Create/update the Flow DBO so it is requestable." },
						autoSave: { type: "boolean", description: "Default true. Export the project after DBO registration." },
						refresh: { type: "boolean", description: "Default true. Refresh Studio tree when Studio is available." },
						includeTrace: { type: "boolean", description: "Default false for newly registered Flow DBOs." }
					}),
					required: ["name"]
				}
			},
			{
				name: "flow-test",
				description: "Run a named project Flow sidecar, provided Flow source, or definition object.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						name: { type: "string" },
						flowSource: { type: "string" },
						definition: { type: "object", description: "Same model returned by flow-get.definition." },
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
				description: "Create or replace a project-local Flow block. Source is Rhino ES6 JavaScript in the JVM; use Packages for Java, not Node require/npm.",
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
				description: "Replace the source of an existing project-local Flow block. Source is Rhino ES6 JavaScript in the JVM; use Packages for Java, not Node require/npm.",
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
				description: "Run a Flow YAML source or definition object, typically to validate a custom block.",
				inputSchema: {
					type: "object",
					properties: addProjectProperties({
						flowSource: { type: "string" },
						definition: { type: "object", description: "Same model returned by flow-get.definition." },
						input: { type: "object" },
						config: { type: "object" },
						includeFlow: { type: "boolean" },
						includeTrace: { type: "boolean" }
					})
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
		var hasDefinition = args.definition !== undefined && args.definition !== null;
		if (!hasDefinition && (args.flowSource === undefined || args.flowSource === null || String(args.flowSource).trim() === "") && args.name) {
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
		mutationResult.registration = registerFlowDbo(args, write);
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
		case "flow-resource-search":
			return toolResult(ctx.resourceSearch(args));
		case "flow-resource-get":
			return toolResult(ctx.resourceGet(args));
		case "flow-resource-patch":
			return toolResult(ctx.resourcePatch(args));
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
				definition: args.definition,
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
			var flowWrite = ctx.flowSet(args.name, args.flowSource || "", args);
			flowWrite.registration = registerFlowDbo(args, flowWrite);
			return toolResult(flowWrite);
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
				definition: args.definition,
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
		var isNotification = id === undefined && String(request.method || "").indexOf("notifications/") === 0;
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
		case "notifications/initialized":
			return acceptNotification(ctx);
		default:
			if (isNotification) {
				return acceptNotification(ctx);
			}
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
