(function () {
	var rootScope = this;
	var File = Packages.java.io.File;
	var FileWriter = Packages.java.io.FileWriter;
	var BufferedWriter = Packages.java.io.BufferedWriter;

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

	function canonicalPath(file) {
		try {
			return String(file.getCanonicalPath());
		} catch (e) {
			return String(file.getAbsolutePath());
		}
	}

	function globalPath(name) {
		try {
			if (typeof rootScope[name] !== "undefined" && String(rootScope[name]).trim() !== "") {
				return canonicalPath(new File(String(rootScope[name])));
			}
		} catch (e) {
		}
		return "";
	}

	function scopedPath(ctx, scopeName, path) {
		try {
			var value = ctx && ctx.scopes && ctx.scopes[scopeName] && ctx.scopes[scopeName][path];
			return value === undefined || value === null ? "" : String(value);
		} catch (e) {
			return "";
		}
	}

	function relativeToRoot(path, root) {
		if (!path || !root) {
			return "";
		}
		if (path === root) {
			return ".";
		}
		var prefix = root + File.separator;
		return path.indexOf(prefix) === 0 ? path.substring(prefix.length).replace(/\\/g, "/") : "";
	}

	function knownProjectDir(ctx) {
		var path = scopedPath(ctx, "request", "projectDir") || globalPath("__flowProjectDir");
		if (path) {
			return canonicalPath(new File(path));
		}
		try {
			var project = ctx.convertigoContext().project;
			if (project != null) {
				return canonicalPath(new File(String(project.getDirPath())));
			}
		} catch (e) {
		}
		return "";
	}

	function symbolValue(name) {
		try {
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var value = Engine.theApp.databaseObjectsManager.symbolsGetValue(String(name));
			return value === undefined || value === null ? "" : String(value);
		} catch (e) {
			return "";
		}
	}

	function knownEngineDir() {
		return globalPath("__flowEngineDir");
	}

	function shortenKnownSuffix(path) {
		var markers = ["/libs/flow/", "/libs/flows/", "/_c8oProject/"];
		for (var i = 0; i < markers.length; i++) {
			var marker = markers[i];
			var index = path.indexOf(marker);
			if (index !== -1) {
				return path.substring(index + 1).replace(/\\/g, "/");
			}
		}
		return "";
	}

	function publicFilePath(value, ctx) {
		var text = String(value || "").trim();
		if (text === "" || text.indexOf("/") === -1 && text.indexOf("\\") === -1) {
			return text;
		}
		var file = new File(text);
		if (!file.isAbsolute()) {
			return text.replace(/\\/g, "/");
		}
		var path = canonicalPath(file);
		var projectRelative = relativeToRoot(path, knownProjectDir(ctx));
		if (projectRelative) {
			return projectRelative;
		}
		var engineRelative = relativeToRoot(path, knownEngineDir());
		if (engineRelative) {
			return "engine:" + engineRelative;
		}
		var suffix = shortenKnownSuffix(path);
		if (suffix) {
			return suffix;
		}
		return "file:" + String(file.getName());
	}

	var FILE_KEYS = {
		file: true,
		descriptorFile: true,
		implementationFile: true,
		hooksFile: true,
		iconFile: true,
		iconFile16: true,
		iconFile32: true,
		iconSvg: true,
		sourcePath: true,
		projectDir: true,
		__flowFile: true,
		__flowImplementationFile: true,
		__flowHooksFile: true
	};

	var EMPTY_METADATA_KEYS = {
		mode: true,
		type: true,
		kind: true,
		description: true,
		longDescription: true,
		label: true,
		icon: true,
		iconFile: true,
		iconFile16: true,
		iconFile32: true,
		iconSvg: true,
		iconUrl: true,
		implementationFile: true,
		hooksFile: true,
		descriptorFile: true,
		file: true
	};

	var JSON_STRING_KEYS = {
		info: true,
		definition: true
	};

	function sanitizeJsonString(value, ctx, key) {
		if (JSON_STRING_KEYS[key] !== true) {
			return null;
		}
		var text = String(value || "").trim();
		if (text.charAt(0) !== "{" && text.charAt(0) !== "[") {
			return null;
		}
		try {
			return JSON.stringify(sanitizeForMcp(JSON.parse(text), ctx));
		} catch (e) {
			return null;
		}
	}

	function sanitizeForMcp(value, ctx, key) {
		if (value === undefined) {
			return undefined;
		}
		if (value === null) {
			return null;
		}
		if (typeof value === "string") {
			if (value === "" && EMPTY_METADATA_KEYS[key] === true) {
				return undefined;
			}
			var cleanJson = sanitizeJsonString(value, ctx, key);
			if (cleanJson !== null) {
				return cleanJson;
			}
			return FILE_KEYS[key] === true ? publicFilePath(value, ctx) : value;
		}
		if (typeof value !== "object") {
			return value;
		}
		if (Object.prototype.toString.call(value) === "[object Array]") {
			var array = [];
			value.forEach(function (item) {
				var clean = sanitizeForMcp(item, ctx, key);
				if (clean !== undefined) {
					array.push(clean);
				}
			});
			return array;
		}
		var out = {};
		Object.keys(value).forEach(function (childKey) {
			if (String(childKey).indexOf("__flow") === 0) {
				return;
			}
			var clean = sanitizeForMcp(value[childKey], ctx, childKey);
			if (clean !== undefined) {
				out[childKey] = clean;
			}
		});
		return out;
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

	function textContent(value, ctx) {
		value = sanitizeForMcp(value, ctx);
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

	function traceSetting(ctx) {
		var setting = symbolValue("flow.mcp.traceJsonl");
		if (setting === undefined || setting === null || setting === "") {
			setting = scopedPath(ctx, "config", "mcp") && ctx.scopes.config.mcp.traceJsonl;
		}
		return setting === undefined || setting === null ? "" : String(setting);
	}

	function defaultTraceFile(ctx) {
		var dir = knownProjectDir(ctx);
		if (!dir) {
			return "";
		}
		return canonicalPath(new File(new File(dir, "_private"), "flow-mcp-trace.jsonl"));
	}

	function traceFile(ctx) {
		var setting = traceSetting(ctx).trim();
		if (!setting || setting === "false" || setting === "0" || setting === "off") {
			return "";
		}
		if (setting === "true" || setting === "1" || setting === "on") {
			return defaultTraceFile(ctx);
		}
		return canonicalPath(new File(setting));
	}

	function appendJsonl(file, value) {
		var target = new File(file);
		target.getParentFile().mkdirs();
		var writer = new BufferedWriter(new FileWriter(target, true));
		try {
			writer.write(JSON.stringify(value));
			writer.newLine();
		} finally {
			writer.close();
		}
	}

	function traceJsonl(ctx, direction, request, payload) {
		var file = traceFile(ctx);
		if (!file) {
			return;
		}
		try {
			request = request || {};
			appendJsonl(file, {
				time: new Date().toISOString(),
				direction: direction,
				id: request.id === undefined ? null : request.id,
				method: request.method || "",
				tool: toolName(request),
				payload: sanitizeForMcp(payload, ctx)
			});
		} catch (e) {
			// Tracing must never break the MCP request path.
		}
	}

	function finalizeResponse(ctx, request, response) {
		response = sanitizeForMcp(response, ctx);
		traceJsonl(ctx, "response", request || {}, response);
		return response;
	}

	function toolResult(value, ctx) {
		value = sanitizeForMcp(value, ctx);
		return {
			content: textContent(value, ctx),
			structuredContent: value
		};
	}

	function toolResponse(request, value, ctx) {
		request = request || {};
		value = compactToolValue(request, value);
		return finalizeResponse(ctx, request, jsonRpcResult(request.id, toolResult(value, ctx)));
	}

	function toolError(request, error, ctx) {
		request = request || {};
		error = error || {};
		return finalizeResponse(ctx, request, jsonRpcError(request.id, -32000, String(error.message || error), {
			code: String(error.code || "FLOW_MCP_TOOL_ERROR"),
			hint: error.hint ? String(error.hint) : ""
		}));
	}

	function prepareToolArguments(ctx, request, options) {
		options = options || {};
		var args = copyJson(toolArguments(request || {}));
		var workspaceSearch = options.workspaceSearch === true
			&& String(args.scope || "") === "workspace"
			&& !args.project
			&& !args.projectDir;
		if (!workspaceSearch && options.resolveProject !== false) {
			args = resolveProjectDir(args);
		}
		return args;
	}

	function runToolBlock(ctx, request, options, handler) {
		try {
			return toolResponse(request, handler(prepareToolArguments(ctx, request, options || {})), ctx);
		} catch (e) {
			return toolError(request, e, ctx);
		}
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

	function toolName(request) {
		return String(request && request.params && request.params.name || "");
	}

	function toolArguments(request) {
		return request && request.params && request.params.arguments || {};
	}

	function compactTypeForList(type) {
		type = type || {};
		var out = {};
		["name", "label", "type", "origin", "description", "inferred"].forEach(function (key) {
			if (type[key] !== undefined && type[key] !== null && type[key] !== "") {
				out[key] = type[key];
			}
		});
		if (type.editor) {
			out.editor = type.editor.component || type.editor.label || true;
		}
		out.useCount = (type.uses || []).length;
		return out;
	}

	function compactToolValue(request, value) {
		if (toolName(request) !== "flow-type-list" || !value || !value.types) {
			return value;
		}
		var out = {};
		Object.keys(value).forEach(function (key) {
			if (key !== "types") {
				out[key] = value[key];
			}
		});
		out.types = (value.types || []).map(compactTypeForList);
		return out;
	}

	function parseRequest(value, ctx) {
		value = value || {};
		if (typeof value === "string") {
			value = JSON.parse(value);
		}
		traceJsonl(ctx, "request", Object.prototype.toString.call(value) === "[object Array]" ? {} : value, value);
		return value;
	}

	function notification(ctx, request) {
		return acceptNotification(ctx);
	}

	return {
		jsonRpcResult: jsonRpcResult,
		jsonRpcError: jsonRpcError,
		acceptNotification: acceptNotification,
		parseRequest: parseRequest,
		toolArguments: toolArguments,
		prepareToolArguments: prepareToolArguments,
		withNamedFlowSource: withNamedFlowSource,
		searchWorkspace: searchWorkspace,
		registerFlowDbo: registerFlowDbo,
		applyNamedFlowMutation: applyNamedFlowMutation,
		applyNodeMutation: applyNodeMutation,
		toolResponse: toolResponse,
		toolError: toolError,
		toolResult: toolResult,
		finalizeResponse: finalizeResponse,
		sanitizeForMcp: sanitizeForMcp,
		traceJsonl: traceJsonl,
		runToolBlock: runToolBlock,
		notification: notification
	};
}())
