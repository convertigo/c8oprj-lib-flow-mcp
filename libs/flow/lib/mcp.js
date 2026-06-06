(function () {
	var rootScope = this;
	var File = Packages.java.io.File;
	var FileWriter = Packages.java.io.FileWriter;
	var BufferedWriter = Packages.java.io.BufferedWriter;
	var System = Packages.java.lang.System;

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

	function isSensitiveKey(key) {
		key = String(key || "").toLowerCase();
		return key.indexOf("password") !== -1 ||
			key.indexOf("passwd") !== -1 ||
			key.indexOf("secret") !== -1 ||
			key.indexOf("token") !== -1 ||
			key.indexOf("apikey") !== -1 ||
			key.indexOf("api_key") !== -1 ||
			key.indexOf("authorization") !== -1 ||
			key.indexOf("cookie") !== -1;
	}

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
		if (isSensitiveKey(key)) {
			return "[redacted]";
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
			return item && (item.block || item.blockId || item.name || item.id || item.flow || item.nodeId || item.uri || item.path || item.summary) || String(item);
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

	function valueKeys(value) {
		return value && typeof value === "object" ? Object.keys(value).filter(function (key) {
			return value[key] !== undefined;
		}) : [];
	}

	function textSummary(value) {
		value = value || {};
		if (!value || typeof value !== "object") {
			return String(value);
		}
		if (value.error) {
			return "Error: " + String(value.error.message || value.error.code || value.error) + ". See structuredContent.error.";
		}
		var parts = [];
		if (value.ok === true) {
			parts.push("OK");
		}
		if (value.name) {
			parts.push(String(value.name));
		}
		if (value.query) {
			parts.push("query=\"" + value.query + "\"");
		}
		if (value.count !== undefined || value.total !== undefined) {
			parts.push("count=" + String(value.count !== undefined ? value.count : value.total));
		}
		if (value.nextCursor) {
			parts.push("nextCursor=" + value.nextCursor);
		}
		if (value.warnings && value.warnings.length) {
			parts.push("warnings=" + value.warnings.length + ": " +
				value.warnings.slice(0, 2).map(function (warning) {
					return warning.hint || warning.message || warning.code || "warning";
				}).join(" | "));
		}
		if (value.matches) {
			parts.push(String(value.matches.length) + " matches: " + listNames(value.matches, 6).join(", "));
		} else if (value.blocks) {
			parts.push(String(value.blocks.length) + " blocks: " + listNames(value.blocks, 8).join(", "));
		} else if (value.flows) {
			parts.push(String(value.flows.length) + " flows: " + listNames(value.flows, 8).join(", "));
		} else if (value.resources) {
			parts.push(String(value.resources.length) + " resources: " + listNames(value.resources, 6).join(", "));
		} else if (value.children) {
			parts.push(String(value.children.length) + " children: " + listNames(value.children, 8).join(", "));
		} else if (value.result !== undefined) {
			parts.push("result keys: " + valueKeys(value.result).slice(0, 10).join(", "));
		} else {
			var keys = valueKeys(value).slice(0, 12);
			if (keys.length) {
				parts.push("keys: " + keys.join(", "));
			}
		}
		parts.push(value.hints ? "Use structuredContent for data; pass hints=false after reading hints." : "Use structuredContent for data.");
		return parts.join(". ");
	}

	function textContent(value, ctx) {
		value = sanitizeForMcp(value, ctx);
		return [{
			type: "text",
			text: textSummary(value)
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
			result.yamlFallbackRemoved = removeFlowYamlFallback(args, writeResult, project);
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

	function removeFlowYamlFallback(args, writeResult, project) {
		if (!writeResult || String(writeResult.format || "") !== "flowscript") {
			return false;
		}
		if (boolArg(args.writeYaml, false) === true || boolArg(args.writeYamlMirror, false) === true || boolArg(args.saveYaml, false) === true) {
			return false;
		}
		try {
			var projectDir = new Packages.java.io.File(String(project.getDirPath()));
			var flowsDir = new Packages.java.io.File(projectDir, "libs/flows");
			var files = flowsDir.isDirectory() ? flowsDir.listFiles() : null;
			if (!files) {
				return 0;
			}
			var removed = 0;
			var list = Packages.java.util.Arrays.asList(files).toArray();
			for (var i = 0; i < list.length; i++) {
				var yamlFile = list[i];
				var filename = String(yamlFile.getName());
				if (!yamlFile.isFile() || !filename.endsWith(".flow.yaml")) {
					continue;
				}
				var codeFile = new Packages.java.io.File(flowsDir, filename.substring(0, filename.length - ".flow.yaml".length) + ".flow.js");
				if (codeFile.isFile() && yamlFile["delete"]()) {
					removed++;
				}
			}
			return removed;
		} catch (_ignoreYamlFallback) {
			return 0;
		}
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
			setting = configMcpValue(ctx, "traceJsonl");
		}
		return setting === undefined || setting === null ? "" : String(setting);
	}

	function configMcpValue(ctx, key) {
		try {
			var mcp = ctx && ctx.scopes && ctx.scopes.config && ctx.scopes.config.mcp;
			return mcp ? mcp[key] : "";
		} catch (e) {
			return "";
		}
	}

	function intSetting(ctx, symbolName, configKey, fallback, min, max) {
		var value = symbolValue(symbolName);
		if (value === undefined || value === null || value === "") {
			value = configMcpValue(ctx, configKey);
		}
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		var number = parseInt(String(value), 10);
		if (isNaN(number)) {
			return fallback;
		}
		if (min !== undefined && number < min) {
			return min;
		}
		if (max !== undefined && number > max) {
			return max;
		}
		return number;
	}

	function traceMaxChars(ctx) {
		return intSetting(ctx, "flow.mcp.traceJsonl.maxChars", "traceJsonlMaxChars", 30000, 500, 1000000);
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

	function jsonChars(value) {
		try {
			return JSON.stringify(value).length;
		} catch (e) {
			return -1;
		}
	}

	function tracePayload(ctx, value) {
		var clean = sanitizeForMcp(value, ctx);
		var chars = jsonChars(clean);
		var maxChars = traceMaxChars(ctx);
		if (chars > maxChars) {
			return {
				payload: summarizeLargeValue(clean),
				payloadChars: chars,
				payloadTruncated: true,
				payloadLimit: maxChars
			};
		}
		return {
			payload: clean,
			payloadChars: chars,
			payloadTruncated: false
		};
	}

	function requestSummary(request, extra) {
		request = request || {};
		extra = extra || {};
		var params = request.params || {};
		var summary = {
			notification: request.id === undefined || request.id === null,
			batch: extra.batch === true,
			method: String(request.method || "")
		};
		if (extra.batch === true) {
			summary.batchIndex = extra.batchIndex;
			summary.batchLength = extra.batchLength;
		}
		if (summary.method === "tools/call") {
			summary.kind = "tool";
			summary.name = String(params.name || "");
		} else if (summary.method === "resources/read") {
			summary.kind = "resource";
			summary.uri = String(params.uri || "");
		} else if (summary.method === "resources/list") {
			summary.kind = "resource-list";
		} else if (summary.method.indexOf("notifications/") === 0) {
			summary.kind = "notification";
		} else {
			summary.kind = summary.method || "unknown";
		}
		return summary;
	}

	function responseSummary(response) {
		response = response || {};
		var summary = {
			ok: !response.error
		};
		if (response.error) {
			summary.errorCode = response.error.code;
			summary.errorMessage = String(response.error.message || "");
			return summary;
		}
		var result = response.result;
		if (result && result.structuredContent) {
			result = result.structuredContent;
		}
		if (result && typeof result === "object") {
			summary.resultKeys = Object.keys(result).slice(0, 20);
			["count", "total", "nextCursor", "status", "message"].forEach(function (key) {
				if (result[key] !== undefined && result[key] !== null && result[key] !== "") {
					summary[key] = result[key];
				}
			});
			if (result.blocks) {
				summary.blocks = result.blocks.length;
			}
			if (result.flows) {
				summary.flows = result.flows.length;
			}
			if (result.matches) {
				summary.matches = result.matches.length;
			}
			if (result.resources) {
				summary.resources = result.resources.length;
			}
		}
		return summary;
	}

	function traceJsonl(ctx, direction, request, payload, extra) {
		var file = traceFile(ctx);
		if (!file) {
			return;
		}
		try {
			request = request || {};
			extra = extra || {};
			var packed = tracePayload(ctx, payload);
			var started = request.__flowMcpTraceStart || extra.started;
			var record = {
				time: new Date().toISOString(),
				direction: direction,
				id: request.id === undefined ? null : request.id,
				method: request.method || "",
				tool: toolName(request),
				summary: direction === "response" ? responseSummary(packed.payload) : requestSummary(request, extra),
				payloadChars: packed.payloadChars,
				payloadTruncated: packed.payloadTruncated,
				payload: packed.payload
			};
			if (packed.payloadLimit !== undefined) {
				record.payloadLimit = packed.payloadLimit;
			}
			if (started && direction === "response") {
				record.durationMs = Math.max(0, Number(System.currentTimeMillis()) - Number(started));
			}
			appendJsonl(file, {
				time: record.time,
				direction: record.direction,
				id: record.id,
				method: record.method,
				tool: record.tool,
				durationMs: record.durationMs,
				summary: record.summary,
				payloadChars: record.payloadChars,
				payloadTruncated: record.payloadTruncated,
				payloadLimit: record.payloadLimit,
				payload: record.payload
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
		var name = toolName(request || {});
		if (name === "flow-catalog") {
			if (!args.detail && !args.mode) {
				args.detail = "signature";
			}
			if (args.limit === undefined || args.limit === null || String(args.limit) === "") {
				args.limit = 20;
			}
		} else if (name === "flow-search") {
			if (args.limit === undefined || args.limit === null || String(args.limit) === "") {
				args.limit = 20;
			}
			if (args.context === undefined || args.context === null || String(args.context) === "") {
				args.context = 1;
			}
		} else if (name === "flow-tree") {
			if (!args.detail && !args.mode) {
				args.detail = "compact";
			}
			if (args.maxDepth === undefined || args.maxDepth === null || String(args.maxDepth) === "") {
				args.maxDepth = 4;
			}
		} else if (name === "flow-block-list") {
			if (args.limit === undefined || args.limit === null || String(args.limit) === "") {
				args.limit = 20;
			}
		}
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
		Object.keys(args.properties || {}).forEach(function (key) {
			node[key] = args.properties[key];
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
		var patch = args.properties;
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
		var patch = copyJson(args.properties || {});
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
				"If you understood, call with hints=false.",
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

	function argBool(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		if (typeof value === "boolean") {
			return value;
		}
		return String(value) === "true";
	}

	function argInt(value, fallback, min, max) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		var number = parseInt(String(value), 10);
		if (isNaN(number)) {
			return fallback;
		}
		if (min !== undefined && number < min) {
			number = min;
		}
		if (max !== undefined && number > max) {
			number = max;
		}
		return number;
	}

	function compactJsonPreview(value, options, depth) {
		options = options || {};
		depth = depth || 0;
		if (typeof value === "string") {
			var maxStringChars = argInt(options.maxStringChars, 500, 20, 5000);
			if (value.length > maxStringChars) {
				return {
					type: "string",
					length: value.length,
					preview: value.substring(0, maxStringChars),
					truncated: true
				};
			}
			return value;
		}
		if (value === null || value === undefined || typeof value !== "object") {
			return value;
		}
		if (depth >= argInt(options.maxDepth, 4, 1, 12)) {
			return {
				type: Object.prototype.toString.call(value) === "[object Array]" ? "array" : "object",
				omitted: true
			};
		}
		if (Object.prototype.toString.call(value) === "[object Array]") {
			var maxArrayItems = argInt(options.maxArrayItems, 3, 0, 50);
			var arrayOut = {
				type: "array",
				length: value.length
			};
			arrayOut.items = value.slice(0, maxArrayItems).map(function (item) {
				return compactJsonPreview(item, options, depth + 1);
			});
			if (value.length > maxArrayItems) {
				arrayOut.last = compactJsonPreview(value[value.length - 1], options, depth + 1);
				arrayOut.omittedItems = value.length - maxArrayItems;
			}
			return arrayOut;
		}
		var keys = Object.keys(value);
		var maxObjectKeys = argInt(options.maxObjectKeys, 20, 1, 200);
		var out = {};
		keys.slice(0, maxObjectKeys).forEach(function (key) {
			out[key] = compactJsonPreview(value[key], options, depth + 1);
		});
		if (keys.length > maxObjectKeys) {
			out.__omittedKeys = keys.length - maxObjectKeys;
			out.__keys = keys.slice(maxObjectKeys, maxObjectKeys + 50);
		}
		return out;
	}

	function compactSchemaType(schema) {
		if (!schema || typeof schema !== "object") {
			return schema === null ? "null" : typeof schema;
		}
		if (schema.type) {
			return String(schema.type);
		}
		if (schema.properties) {
			return "object";
		}
		return "unknown";
	}

	function compactSchemaJoin(prefix, key) {
		return prefix ? prefix + "." + key : String(key);
	}

	function compactSchemaPaths(schema, prefix, out, limit) {
		if (out.length >= limit) {
			return;
		}
		if (!schema || typeof schema !== "object") {
			if (prefix) {
				out.push(prefix);
			}
			return;
		}
		if (schema.type === "array") {
			if (prefix) {
				out.push(prefix);
			}
			compactSchemaPaths(schema.items, prefix, out, limit);
			return;
		}
		var source = schema.properties || schema;
		var keys = Object.keys(source || {}).filter(function (key) {
			return ["type", "items", "properties", "required", "description"].indexOf(key) === -1;
		});
		if (keys.length === 0) {
			if (prefix) {
				out.push(prefix);
			}
			return;
		}
		if (prefix) {
			out.push(prefix);
		}
		keys.forEach(function (key) {
			if (out.length < limit) {
				compactSchemaPaths(source[key], compactSchemaJoin(prefix, key), out, limit);
			}
		});
	}

	function compactSchemaSummary(schema, limit) {
		var paths = [];
		compactSchemaPaths(schema, "", paths, limit || 16);
		return {
			type: compactSchemaType(schema),
			paths: paths
		};
	}

	function compactRuntimeToolValue(request, value) {
		var args = toolArguments(request);
		if (!value || typeof value !== "object") {
			return value;
		}
		var out = null;
		function mutableOut() {
			if (!out) {
				out = {};
				Object.keys(value).forEach(function (key) {
					out[key] = value[key];
				});
			}
			return out;
		}
		var detail = responseDetail(request);
		var fullDetail = detail === "full" || detail === "debug";
		var maxResultChars = argInt(args.maxResultChars, 6000, 1000, fullDetail ? 1000000 : 12000);
		if (value.result !== undefined) {
			var chars = jsonChars(value.result);
			var allowHugeResult = fullDetail && argBool(args.allowHugeResult || args.allowUnboundedResult, false);
			var includeFullResult = fullDetail && argBool(args.includeFullResult || args.fullResult || args.allowLarge, false);
			if (chars > maxResultChars && (!includeFullResult || !allowHugeResult)) {
				var resultOut = mutableOut();
				resultOut.result = compactJsonPreview(value.result, {
					maxArrayItems: argInt(args.maxArrayItems, 3, 0, 50),
					maxObjectKeys: argInt(args.maxObjectKeys, 20, 1, 200),
					maxDepth: argInt(args.maxDepth, 5, 1, 12)
				});
				resultOut.resultCompacted = true;
				resultOut.resultChars = chars;
				resultOut.resultHint = "Result exceeded maxResultChars. Use detail:'full' with includeFullResult=true and allowHugeResult=true only when the complete runtime payload is required.";
			}
		}
		if (value.trace !== undefined && !argBool(args.includeFullTrace || args.fullTrace, false)) {
			var maxTraceChars = argInt(args.maxTraceChars, 6000, 1000, 1000000);
			var traceChars = jsonChars(value.trace);
			if (traceChars > maxTraceChars) {
				var traceOut = mutableOut();
				traceOut.trace = compactJsonPreview(value.trace, {
					maxArrayItems: argInt(args.maxArrayItems, 2, 0, 50),
					maxObjectKeys: argInt(args.maxTraceObjectKeys || args.maxObjectKeys, 12, 1, 200),
					maxDepth: argInt(args.maxTraceDepth || args.maxDepth, 4, 1, 12)
				});
				traceOut.traceCompacted = true;
				traceOut.traceChars = traceChars;
				traceOut.traceHint = "Pass includeFullTrace=true only when full per-node runtime values are required.";
			}
		}
		["local", "flow"].forEach(function (scopeKey) {
			if (value[scopeKey] === undefined || argBool(args["includeFull" + scopeKey.charAt(0).toUpperCase() + scopeKey.substring(1)] || args.fullScopes, false)) {
				return;
			}
			var maxScopeChars = argInt(args.maxScopeChars || args.maxFlowChars, 6000, 1000, 1000000);
			var scopeChars = jsonChars(value[scopeKey]);
			if (scopeChars > maxScopeChars) {
				var scopeOut = mutableOut();
				scopeOut[scopeKey] = compactJsonPreview(value[scopeKey], {
					maxArrayItems: argInt(args.maxArrayItems, 3, 0, 50),
					maxObjectKeys: argInt(args.maxScopeObjectKeys || args.maxObjectKeys, 20, 1, 200),
					maxDepth: argInt(args.maxScopeDepth || args.maxDepth, 5, 1, 12)
				});
				scopeOut[scopeKey + "Compacted"] = true;
				scopeOut[scopeKey + "Chars"] = scopeChars;
				scopeOut[scopeKey + "Hint"] = "Pass includeFull" + scopeKey.charAt(0).toUpperCase() + scopeKey.substring(1) + "=true only when complete scope values are required.";
			}
		});
		return out || value;
	}

	function compactAnalyzeToolValue(request, value) {
		var args = toolArguments(request);
		if (!value || typeof value !== "object" || responseDetail(request) === "full" || argBool(args.includeFullResponse || args.fullResponse, false)) {
			return value;
		}
		var out = {
			ok: value.ok !== false,
			version: value.version,
			pathCount: (value.paths || []).length,
			readCount: (value.reads || []).length,
			writeCount: (value.writes || []).length,
			nodeCount: (value.nodes || []).length,
			reads: (value.reads || []).slice(0, 30),
			writes: (value.writes || []).slice(0, 30),
			nodes: (value.nodes || []).slice(0, 40).map(function (node) {
				return {
					id: node.id,
					block: node.block,
					reads: (node.reads || []).slice(0, 6),
					writes: (node.writes || []).slice(0, 6)
				};
			}),
			errors: value.errors || [],
			detail: "summary",
			next: "Use detail:'full' only when complete schemas and node analysis are required."
		};
		if (value.returnSchemas && value.returnSchemas.length) {
			out.returnSchemas = value.returnSchemas.slice(0, 5);
		}
		if (value.schemas && Object.keys(value.schemas).length) {
			var schemaKeys = Object.keys(value.schemas).slice(0, 40);
			out.schemaPaths = schemaKeys;
			out.schemaCount = Object.keys(value.schemas).length;
			out.schemaSummaries = {};
			schemaKeys.slice(0, argInt(args.maxSchemaSummaries, 8, 0, 20)).forEach(function (key) {
				out.schemaSummaries[key] = compactSchemaSummary(value.schemas[key], argInt(args.maxSchemaPaths, 16, 4, 80));
			});
		}
		return out;
	}

	function compactRegistration(registration) {
		if (!registration || typeof registration !== "object") {
			return registration;
		}
		var out = {};
		["requested", "registered", "created", "updated", "saved", "refreshed", "schemaCacheCleared", "qname", "message"].forEach(function (key) {
			if (registration[key] !== undefined && registration[key] !== null && registration[key] !== "") {
				out[key] = registration[key];
			}
		});
		if (registration.studioRefresh) {
			out.studioRefresh = {
				status: registration.studioRefresh.status,
				refreshed: registration.studioRefresh.refreshed,
				message: registration.studioRefresh.message
			};
		}
		return out;
	}

	function compactAnalysis(analysis) {
		if (!analysis || typeof analysis !== "object") {
			return analysis;
		}
		return {
			ok: analysis.ok !== false,
			nodeCount: (analysis.nodes || []).length,
			readCount: (analysis.reads || []).length,
			writeCount: (analysis.writes || []).length,
			reads: (analysis.reads || []).slice(0, 20),
			writes: (analysis.writes || []).slice(0, 20),
			nodes: (analysis.nodes || []).slice(0, 30).map(function (node) {
				return {
					id: node.id,
					block: node.block,
					reads: (node.reads || []).slice(0, 5),
					writes: (node.writes || []).slice(0, 5)
				};
			}),
			errors: analysis.errors || []
		};
	}

	function compactDefinition(definition) {
		if (!definition || typeof definition !== "object") {
			return definition;
		}
		return {
			version: definition.version || 1,
			nodeCount: (definition.nodes || []).length,
			nodes: (definition.nodes || []).slice(0, 30).map(function (node) {
				return {
					id: node.id,
					block: node.block
				};
			})
		};
	}

	function compactChildren(children) {
		return (children || []).slice(0, 20).map(function (child) {
			return {
				name: child.name,
				kind: child.kind,
				type: child.type,
				path: child.path,
				summary: child.summary
			};
		});
	}

	function responseDetail(request) {
		var args = toolArguments(request);
		return String(args.detail || args.mode || args.response || "").toLowerCase();
	}

	function wantsFullMutationResponse(request) {
		var args = toolArguments(request);
		var detail = responseDetail(request);
		return detail === "full" ||
			detail === "debug" ||
			argBool(args.includeFullResponse || args.fullResponse || args.verbose, false);
	}

	function compactWriteLikeValue(value) {
		if (!value || typeof value !== "object") {
			return value;
		}
		var out = {};
		["ok", "status", "name", "file", "target", "message"].forEach(function (key) {
			if (value[key] !== undefined && value[key] !== null && value[key] !== "") {
				out[key] = value[key];
			}
		});
		if (value.source !== undefined && value.source !== null) {
			out.sourceChars = String(value.source).length;
		}
		if (value.definition) {
			out.definition = compactDefinition(value.definition);
		}
		if (value.analysis) {
			out.analysis = compactAnalysis(value.analysis);
		}
		if (value.children) {
			out.childCount = value.children.length;
			out.children = compactChildren(value.children);
		}
		if (value.registration) {
			out.registration = compactRegistration(value.registration);
		}
		return out;
	}

	function compactMutationToolValue(request, value) {
		if (wantsFullMutationResponse(request) || !value || typeof value !== "object") {
			return value;
		}
		var out = compactWriteLikeValue(value);
		if (value.written) {
			out.written = compactWriteLikeValue(value.written);
		}
		if (value.source !== undefined && value.source !== null) {
			out.sourceHint = "Rewritten YAML omitted by default. Pass detail:\"full\" only when the complete source is required.";
		}
		if (value.children) {
			out.treeHint = "Virtual tree omitted/compacted by default. Call flow-tree for focused inspection.";
		}
		out.responseDetail = "summary";
		return out;
	}

	function compactRequestableSchemaToolValue(request, value) {
		if (!value || typeof value !== "object" || responseDetail(request) === "full") {
			return value;
		}
		if (value.ok === false || value.error) {
			return value;
		}
		var args = toolArguments(request);
		var limit = argInt(args.limit || args.maxPaths, 60, 1, 500);
		var paths = value.paths || [];
		var arrayPaths = value.arrayPaths || [];
		var leafPaths = value.leafPaths || [];
		if (arrayPaths.length) {
			leafPaths = leafPaths.filter(function (entry) {
				return arrayPaths.some(function (arrayPath) {
					return String(entry.path || "").indexOf(String(arrayPath) + ".") === 0;
				});
			});
		}
		var leafLimit = argInt(args.leafLimit || args.maxLeafPaths, 25, 0, 200);
		var out = {
			ok: true,
			target: value.target,
			learned: value.learned === true,
			pathCount: paths.length,
			paths: paths.slice(0, limit),
			arrayPaths: arrayPaths.slice(0, 30),
			leafPaths: leafPaths.slice(0, leafLimit),
			flowScript: value.flowScript,
			responseDetail: "summary",
			next: "Use paths/arrayPaths to write FlowScript expressions. Use detail:'full' only when the complete schema object or sample is required."
		};
		if (paths.length > limit) {
			out.omittedPaths = paths.length - limit;
		}
		if (leafPaths.length > leafLimit) {
			out.omittedLeafPaths = leafPaths.length - leafLimit;
		}
		if ((args.includeSchema === true || args.schema === true) && value.schema && jsonChars(value.schema) < 12000) {
			out.schema = value.schema;
		}
		return out;
	}

	function compactToolValue(request, value) {
		var name = toolName(request);
		if (name === "flow-run" || name === "flow-test" || name === "flow-block-test" || name === "flow-code-run") {
			return compactRuntimeToolValue(request, value);
		}
		if (name === "flow-analyze" || name === "flow-code-analyze") {
			return compactAnalyzeToolValue(request, value);
		}
		if (name === "flow-requestable-schema") {
			return compactRequestableSchemaToolValue(request, value);
		}
		if (name === "flow-set" ||
				name === "flow-edit" ||
				name === "flow-apply" ||
				name === "flow-node-add" ||
				name === "flow-node-edit" ||
				name === "flow-node-move" ||
				name === "flow-node-delete" ||
				name === "flow-node-duplicate") {
			return compactMutationToolValue(request, value);
		}
		if (name !== "flow-type-list" || !value || !value.types) {
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
		var started = Number(System.currentTimeMillis());
		if (Object.prototype.toString.call(value) === "[object Array]") {
			value.forEach(function (item, index) {
				if (item && typeof item === "object") {
					item.__flowMcpTraceStart = Number(System.currentTimeMillis());
				}
				traceJsonl(ctx, "request", item || {}, item, {
					batch: true,
					batchIndex: index,
					batchLength: value.length,
					started: started
				});
			});
		} else {
			if (value && typeof value === "object") {
				value.__flowMcpTraceStart = started;
			}
			traceJsonl(ctx, "request", value, value, { started: started });
		}
		return value;
	}

	function notification(ctx, request) {
		var response = acceptNotification(ctx);
		traceJsonl(ctx, "response", request || {}, {
			accepted: true,
			noJsonRpcResponse: true
		});
		return response;
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
