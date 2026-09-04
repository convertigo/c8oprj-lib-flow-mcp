(function () {
	var rootScope = this;
	var File = Packages.java.io.File;
	var FileWriter = Packages.java.io.FileWriter;
	var BufferedWriter = Packages.java.io.BufferedWriter;
	var Files = Packages.java.nio.file.Files;
	var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
	var System = Packages.java.lang.System;
	var Base64 = Packages.java.util.Base64;

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

	function phaseBudget(args, key) {
		args = args || {};
		var startedAt = Number(System.currentTimeMillis());
		var timeoutMs = argInt(args.timeoutMs, 3000, 50, 5000);
		var deadline = startedAt + timeoutMs;
		var prefix = "mp1.";
		var state = { phase: 0 };
		var cursor = String(args.cursor || "");
		if (cursor.indexOf(prefix) === 0) {
			try {
				var decoded = String(new Packages.java.lang.String(
					Base64.getUrlDecoder().decode(cursor.substring(prefix.length)), "UTF-8"));
				var payload = JSON.parse(decoded);
				if (!payload || payload.v !== 1 || String(payload.key || "") !== String(key || "")) {
					throw new Error("This progress cursor belongs to another project or diagnostic target.");
				}
				state = payload.state || state;
			} catch (e) {
				throw new Error("Invalid flow-app-progress cursor: " + String(e.message || e));
			}
		}
		function encode(nextState) {
			var text = JSON.stringify({ v: 1, key: String(key || ""), state: nextState || {} });
			return prefix + String(Base64.getUrlEncoder().withoutPadding().encodeToString(
				new Packages.java.lang.String(text).getBytes("UTF-8")));
		}
		return {
			phase: Math.max(0, Number(state.phase || 0)),
			expired: function () { return Number(System.currentTimeMillis()) >= deadline; },
			partial: function (value, nextPhase, phaseName) {
				value.partial = true;
				value.complete = false;
				value.progressPhase = phaseName;
				value.nextCursor = encode({ phase: nextPhase });
				value.warnings = (value.warnings || []).concat([{
					code: "PARTIAL_RESULT_TIME_BUDGET",
					message: "Progress inspection stopped after the " + phaseName + " phase. Continue with nextCursor."
				}]);
				value.responseBudget = {
					elapsedMs: Math.max(0, Number(System.currentTimeMillis()) - startedAt),
					itemCount: 1,
					stopReason: "time"
				};
				return value;
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
		sourceFile: true,
		codeFile: true,
		workingCodeFile: true,
		officialCodeFile: true,
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
		if (typeof value === "object" &&
			value instanceof Packages.java.lang.CharSequence) {
			value = String(value);
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

	function splitAuthoringParentPath(value) {
		value = String(value || "").trim();
		if (!value) {
			return null;
		}
		var separator = value.indexOf("::");
		if (separator === -1) {
			return { project: "", path: value };
		}
		return {
			project: value.substring(0, separator).trim(),
			path: value.substring(separator + 2).trim()
		};
	}

	function normalizeAuthoringParentPath(name, args) {
		if (["authoring-palette", "authoring-mutate", "frontend-svelte-palette", "frontend-svelte-mutate"].indexOf(name) === -1) {
			return args;
		}
		var parent = splitAuthoringParentPath(args.parentPath);
		if (!parent) {
			return args;
		}
		if (parent.project) {
			if (args.project && String(args.project) !== parent.project) {
				throw new Error(name + " parentPath project " + parent.project + " conflicts with project " + args.project + ".");
			}
			args.project = parent.project;
		}
		if (!args.project && !args.projectDir) {
			throw new Error(name + " expects a qualified parentPath returned by authoring-tree, for example Project::frontends.svelte.routes.");
		}
		if (parent.path) {
			args.focusPath = parent.path;
			if (!args.surface) {
				if (/^frontends(?:\.|$)/.test(parent.path)) {
					args.surface = "frontend";
					if (/^frontends\.svelte(?:\.|$)/.test(parent.path) && !args.builder) {
						args.builder = "svelte";
					}
				} else if (/^(?:engine|catalog)(?:\.|$)/.test(parent.path)) {
					args.surface = "backend";
				}
			}
		}
		return args;
	}

	function qualifyAuthoringPath(args, path) {
		path = String(path || "");
		return args && args.project ? String(args.project) + "::" + path : path;
	}

	function qualifyAuthoringResult(args, value) {
		if (!value || typeof value !== "object") {
			return value;
		}
		function qualifyNode(node) {
			if (!node || typeof node !== "object") {
				return;
			}
			if (node.path !== undefined && node.path !== null) {
				node.parentPath = qualifyAuthoringPath(args, node.path);
			}
			(node.children || []).forEach(qualifyNode);
		}
		(value.children || []).forEach(qualifyNode);
		if (value.focus && value.focus.path !== undefined) {
			value.focus.parentPath = qualifyAuthoringPath(args, value.focus.path);
		}
		if (value.focusPath !== undefined && value.focusPath !== null) {
			value.parentPath = qualifyAuthoringPath(args, value.focusPath);
		} else if (value.focus && value.focus.path !== undefined) {
			value.parentPath = value.focus.parentPath;
		}
		return value;
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
			ConvertigoPlugin.asyncExec(new Runnable({ run: function () {
				try {
					var view = plugin.getProjectExplorerView();
					if (view == null) {
						return;
					}
					view.reloadDatabaseObject(target);
					var treeObject = view.findTreeObjectByUserObject(target);
					if (treeObject != null) {
						view.refreshTreeObject(treeObject);
					}
				} catch (e) {
					ConvertigoPlugin.logException(e, "Unable to refresh Project Explorer after Flow MCP update", false);
				}
			}}));
			result.status = "scheduled";
			result.message = "Project Explorer refresh scheduled";
			result.scheduled = true;
			result.refreshedQName = String(target.getQName());
		} catch (e) {
			result.status = "error";
			result.message = String(e);
			result.error = String(e);
		}
		return result;
	}

	function runtimeProjectFromArgs(args) {
		args = args || {};
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		var dbom = Engine.theApp.databaseObjectsManager;
		var projectName = String(args.project || "").trim();
		if (projectName) {
			return dbom.getOriginalProjectByName(projectName, true);
		}
		if (!args.projectDir) {
			return null;
		}
		var projectDir = canonicalPath(new File(String(args.projectDir)).getCanonicalFile());
		var names = dbom.getAllProjectNamesList(true);
		for (var i = 0; i < names.size(); i++) {
			try {
				var project = dbom.getOriginalProjectByName(String(names.get(i)), false);
				if (project != null && canonicalPath(new File(String(project.getDirPath())).getCanonicalFile()) === projectDir) {
					return project;
				}
			} catch (_ignoreProjectMatch) {
			}
		}
		return null;
	}

	function studioRefreshFlowEngine(args, reason) {
		var result = {
			status: "pending",
			message: "",
			project: String(args && args.project || ""),
			reason: String(reason || ""),
			studioMode: false,
			scheduled: false,
			refreshed: false,
			timestamp: Number(System.currentTimeMillis())
		};
		try {
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			result.studioMode = Engine.isStudioMode() === true;
			if (!result.studioMode) {
				result.status = "skipped";
				result.message = "Refresh skipped: Convertigo Studio required";
				return result;
			}
			var project = runtimeProjectFromArgs(args);
			if (project == null) {
				result.status = "skipped";
				result.message = "Refresh skipped: project not found";
				return result;
			}
			result.project = String(project.getName());
			var ConvertigoPlugin = Packages.com.twinsoft.convertigo.eclipse.ConvertigoPlugin;
			var Runnable = Packages.java.lang.Runnable;
			var plugin = ConvertigoPlugin.getDefault();
			if (plugin == null) {
				result.status = "skipped";
				result.message = "Refresh skipped: Studio plugin not available";
				return result;
			}
			ConvertigoPlugin.asyncExec(new Runnable({ run: function () {
				try {
					try {
						var IResource = Packages.org.eclipse.core.resources.IResource;
						var iProject = plugin.getProjectPluginResource(String(project.getName()));
						if (iProject != null) {
							iProject.refreshLocal(IResource.DEPTH_INFINITE, null);
						}
					} catch (resourceError) {
						ConvertigoPlugin.logException(resourceError, "Unable to refresh Eclipse resources after Flow MCP frontend update", false);
					}
					try {
						Packages.com.twinsoft.convertigo.engine.flow.FlowEngineBridge.invalidateDataCaches();
					} catch (cacheError) {
						ConvertigoPlugin.logException(cacheError, "Unable to invalidate Flow authoring caches after Flow MCP frontend update", false);
					}
					try {
						Packages.com.twinsoft.convertigo.engine.flow.FlowStudioSupport.clearCatalogCache(project);
					} catch (catalogError) {
						ConvertigoPlugin.logException(catalogError, "Unable to clear Flow Studio catalog cache after Flow MCP frontend update", false);
					}
					var view = plugin.getProjectExplorerView();
					if (view == null) {
						return;
					}
					var flowEngine = project.getFlowEngine();
					var treeObject = flowEngine == null ? null : view.findTreeObjectByUserObject(flowEngine);
					if (treeObject != null) {
						view.reloadTreeObject(treeObject);
						view.refreshTreeObject(treeObject);
					} else {
						view.refreshTree();
					}
				} catch (e) {
					ConvertigoPlugin.logException(e, "Unable to refresh Project Explorer after Flow MCP frontend update", false);
				}
			}}));
			result.status = "scheduled";
			result.message = "FlowEngine Project Explorer refresh scheduled";
			result.scheduled = true;
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
			var Flow = Packages.java.lang.Class.forName("com.twinsoft.convertigo.beans.flow.Flow");
			return Flow.isInstance(dbo);
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
			projectSaved: false,
			flowDeclarationSaved: false,
			saveMode: "fast",
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
		var projectWasChanged = false;
		try {
			projectWasChanged = project.hasChanged === true;
		} catch (_ignoreProjectChanged) {
		}
		var name = String(args.name || "");
		var sequence = projectSequenceByName(project, name);
		var flow = null;
		var flowWasChanged = false;
		if (sequence != null) {
			if (!isFlowDbo(sequence)) {
				throw new Error("Unable to register Flow DBO: " + args.project + "." + name + " already exists and is not a Flow.");
			}
			flow = sequence;
			try {
				flowWasChanged = flow.hasChanged === true;
			} catch (_ignoreFlowChanged) {
			}
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
		if (writeResult && String(writeResult.format || "") === "flowscript" &&
				writeResult.code !== undefined && writeResult.code !== null) {
			flow.setFlowSource(String(writeResult.code));
		} else if (writeResult && writeResult.source !== undefined && writeResult.source !== null) {
			flow.setFlowSource(String(writeResult.source));
		}
		result.flagsBeforeFastSaveClean = flowDboFlags(project, flow);
		result.registered = true;
		result.qname = String(flow.getQName());
		try {
			flow.hasChanged = true;
			project.hasChanged = true;
		} catch (_ignoreDirtyFlags) {
		}
		var saveProject = boolArg(args.saveProject, false) === true ||
			boolArg(args.exportProject, false) === true ||
			boolArg(args.autoSave, false) === true;
		if (saveProject) {
			result.saveMode = "project";
			var flowScriptSidecars = snapshotFlowScriptSidecars(project, writeResult);
			Engine.theApp.databaseObjectsManager.exportProject(project);
			result.saved = true;
			result.projectSaved = true;
			result.flowScriptSidecarsRestored = restoreFlowScriptSidecars(project, writeResult, flowScriptSidecars, name);
		} else {
			result.saved = true;
			result.flowDeclarationSaved = saveFlowDeclaration(project, flow, name, args, writeResult);
			markFastSavedClean(project, flow, projectWasChanged, flowWasChanged);
		}
		result.flagsAfterFastSaveClean = flowDboFlags(project, flow);
		try {
			Engine.theApp.schemaManager.clearCache(String(project.getName()));
			result.schemaCacheCleared = true;
		} catch (_ignoreSchemaCache) {
		}
		if (boolArg(args.refresh, true) === true) {
			result.studioRefresh = studioRefreshQName(result.created ? String(project.getName()) : String(flow.getQName()));
			result.refreshed = result.studioRefresh && (result.studioRefresh.refreshed === true || result.studioRefresh.scheduled === true);
		}
		result.message = result.created ? "Flow DBO created" : "Flow DBO updated";
		return result;
	}

	function saveFlowDeclaration(project, flow, name, args, writeResult) {
		args = args || {};
		var projectDir = new File(String(project.getDirPath()));
		var sequencesDir = new File(new File(projectDir, "_c8oProject"), "sequences");
		var sequenceFile = new File(sequencesDir, String(name) + ".yaml");
		var changed = false;
		if (!sequenceFile.isFile()) {
			writeUtf8(sequenceFile, "includeTrace: " + (boolArg(args.includeTrace, false) ? "true" : "false") + "\n");
			changed = true;
		}
		if (syncFlowInputDeclarationYaml(sequenceFile, name, writeResult)) {
			changed = true;
		}
		return ensureProjectFlowDeclaration(projectDir, name) || changed;
	}

	function syncFlowInputsDbo(args) {
		args = args || {};
		if (!args.project) {
			throw new Error("flow-sync-inputs requires project.");
		}
		if (!args.name && args.qname) {
			var parts = String(args.qname).split(".");
			args.name = parts[parts.length - 1];
		}
		if (!args.name) {
			throw new Error("flow-sync-inputs requires name or qname.");
		}
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		var project = Engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(args.project), false);
		if (project == null) {
			throw new Error("Unknown Convertigo project: " + args.project);
		}
		var flow = projectSequenceByName(project, args.name);
		if (!isFlowDbo(flow)) {
			throw new Error("Not a Flow DBO: " + args.project + "." + args.name);
		}
		var before = flowDboFlags(project, flow);
		var FlowEngineBridge = Packages.com.twinsoft.convertigo.engine.flow.FlowEngineBridge;
		var response = new FlowEngineBridge().syncInputs(flow);
		if (!response || response.optBoolean("ok", false) !== true) {
			throw new Error("Unable to sync Flow inputs: " + String(response));
		}
		var inputDefinitions = response.optJSONObject("inputDefinitions");
		var writeResult = {
			format: "flowscript",
			inputDefinitions: inputDefinitions == null ? {} : JSON.parse(String(inputDefinitions.toString()))
		};
		var saved = saveFlowDeclaration(project, flow, String(args.name), args, writeResult);
		try {
			if (flow.numberOfVariables) {
				flow.numberOfVariables();
			}
		} catch (_ignoreVariableSync) {
		}
		markFastSavedClean(project, flow, boolArg(args.cleanProject, false) !== true && project.hasChanged === true);
		var refresh = null;
		if (boolArg(args.refresh, true) === true) {
			refresh = studioRefreshQName(String(flow.getQName()));
		}
		return {
			ok: true,
			project: String(args.project),
			name: String(args.name),
			qname: String(flow.getQName()),
			inputDefinitions: writeResult.inputDefinitions,
			flowDeclarationSaved: saved,
			flagsBefore: before,
			flagsAfter: flowDboFlags(project, flow),
			studioRefresh: refresh
		};
	}

	function markFastSavedClean(project, flow, projectWasChanged, flowWasChanged) {
		try {
			var sourceDirty = flow.isFlowSourceDirty && flow.isFlowSourceDirty() === true;
			if (!sourceDirty) {
				flow.hasChanged = flowWasChanged === true;
				flow.bNew = false;
			}
		} catch (_ignoreFlowClean) {
		}
		try {
			project.hasChanged = projectWasChanged === true;
		} catch (_ignoreProjectClean) {
		}
	}

	function flowDboFlags(project, flow) {
		var out = {};
		try {
			out.flowHasChanged = flow.hasChanged === true;
			out.flowBNew = flow.bNew === true;
		} catch (_ignoreFlowFlags) {
		}
		try {
			out.flowSourceDirty = flow.isFlowSourceDirty && flow.isFlowSourceDirty() === true;
		} catch (_ignoreSourceDirty) {
		}
		try {
			out.variableCount = flow.numberOfVariables ? Number(flow.numberOfVariables()) : -1;
		} catch (_ignoreVariables) {
		}
		try {
			out.projectHasChanged = project && project.hasChanged === true;
		} catch (_ignoreProjectFlags) {
		}
		return out;
	}

	function syncFlowInputDeclarationYaml(sequenceFile, flowName, writeResult) {
		var inputDefinitions = writeResult && writeResult.inputDefinitions;
		if (!inputDefinitions || typeof inputDefinitions !== "object") {
			return false;
		}
		var keys = Object.keys(inputDefinitions).filter(function (key) {
			return /^[A-Za-z_$][\w$]*$/.test(String(key || "")) && String(key).indexOf("__") !== 0;
		}).sort();
		if (keys.length === 0) {
			return false;
		}
		var original = sequenceFile.isFile() ? readUtf8(sequenceFile) : "";
		var content = original.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		if (content.trim() === "") {
			content = "includeTrace: false\n";
		}
		var ids = existingFlowInputVariableIds(content);
		var filtered = removeFlowInputVariableBlocks(content, keys);
		if (filtered.length && filtered.charAt(filtered.length - 1) !== "\n") {
			filtered += "\n";
		}
		keys.forEach(function (key, index) {
			var definition = inputDefinitions[key] || {};
			var className = flowInputVariableClass(definition);
			var id = ids[key] && ids[key].indexOf(className + "-") === 0
				? ids[key]
				: className + "-" + stableFlowInputPriority(flowName, key, index);
			filtered += renderFlowInputVariableYaml(key, definition, id);
		});
		if (filtered !== content) {
			writeUtf8(sequenceFile, filtered);
			return true;
		}
		return false;
	}

	function existingFlowInputVariableIds(content) {
		var ids = {};
		var re = /^↓([A-Za-z_$][\w$]*) \[(variables\.Requestable(?:MultiValued)?Variable-\d+)\]:/gm;
		var match;
		while ((match = re.exec(content)) !== null) {
			ids[match[1]] = match[2];
		}
		return ids;
	}

	function removeFlowInputVariableBlocks(content, names) {
		var remove = {};
		names.forEach(function (name) {
			remove[String(name)] = true;
		});
		var lines = content.split("\n");
		var kept = [];
		var skipping = false;
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var match = /^↓([A-Za-z_$][\w$]*) \[variables\.Requestable(?:MultiValued)?Variable-\d+\]:/.exec(line);
			if (match) {
				skipping = remove[match[1]] === true;
			} else if (skipping && /^↓/.test(line)) {
				skipping = false;
			}
			if (!skipping) {
				kept.push(line);
			}
		}
		return kept.join("\n").replace(/\n+$/, "\n");
	}

	function renderFlowInputVariableYaml(name, definition, id) {
		definition = definition && typeof definition === "object" ? definition : {};
		var lines = ["↓" + name + " [" + id + "]: "];
		var description = definition.description !== undefined && definition.description !== null && String(definition.description) !== ""
			? definition.description
			: "Flow input " + name;
		lines.push("  description: " + yamlScalar(description));
		var schemaType = flowInputSchemaType(definition.type || definition.kind || "string");
		if (schemaType !== "xsd:string") {
			lines.push("  schemaType: " + schemaType);
		}
		if (definition.required === true) {
			lines.push("  required: true");
		}
		if (definition.default !== undefined) {
			lines.push("  value: " + yamlScalar(definition.default));
		}
		return lines.join("\n") + "\n";
	}

	function flowInputVariableClass(definition) {
		var type = String(definition && (definition.type || definition.kind) || "string").toLowerCase();
		return type === "array" || definition && (definition.multi === true || definition.multiValued === true)
			? "variables.RequestableMultiValuedVariable"
			: "variables.RequestableVariable";
	}

	function flowInputSchemaType(type) {
		switch (String(type || "").toLowerCase()) {
		case "boolean":
		case "bool":
			return "xsd:boolean";
		case "integer":
		case "int":
			return "xsd:integer";
		case "number":
		case "double":
		case "float":
			return "xsd:double";
		default:
			return "xsd:string";
		}
	}

	function stableFlowInputPriority(flowName, key, index) {
		var text = String(flowName || "") + ":" + String(key || "") + ":" + String(index || 0);
		var hash = 2166136261;
		for (var i = 0; i < text.length; i++) {
			hash ^= text.charCodeAt(i);
			hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
		}
		return String(1780000000000 + (Math.abs(hash) % 900000000));
	}

	function yamlScalar(value) {
		if (value === null || value === undefined) {
			return "";
		}
		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}
		var text = String(value);
		if (text === "") {
			return "";
		}
		if (/^[A-Za-z0-9_./@:+-]+(?: [A-Za-z0-9_./@:+-]+)*$/.test(text)) {
			return text;
		}
		return JSON.stringify(text);
	}

	function ensureProjectFlowDeclaration(projectDir, name) {
		var projectFile = new File(projectDir, "c8oProject.yaml");
		if (!projectFile.isFile()) {
			return false;
		}
		var flowLine = "  ↓" + String(name) + " [flow.Flow]: 🗏 sequences/" + String(name) + ".yaml";
		var originalContent = readUtf8(projectFile).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		var content = normalizeConvertigoYamlObjectHeaders(originalContent);
		content = normalizeConvertigoFlowProjectVersion(content);
		var lines = content.split("\n");
		var changed = content !== originalContent;
		for (var i = 0; i < lines.length; i++) {
			if (String(lines[i]).indexOf("↓" + String(name) + " [flow.Flow]:") !== -1) {
				if (changed) {
					writeUtf8(projectFile, lines.join("\n").replace(/\n+$/g, "") + "\n");
				}
				return changed;
			}
		}
		var insertAt = -1;
		for (var j = 0; j < lines.length; j++) {
			if (/^  ↓.+ \[flow\.Flow\]:/.test(String(lines[j]))) {
				insertAt = j + 1;
			}
		}
		if (insertAt === -1) {
			for (var k = 0; k < lines.length; k++) {
				if (/^  ↓(project|FlowEngine|MobileApplication) /.test(String(lines[k]))) {
					insertAt = k;
					break;
				}
			}
		}
		if (insertAt === -1) {
			insertAt = lines.length;
			if (insertAt > 0 && lines[insertAt - 1] === "") {
				insertAt--;
			}
		}
		lines.splice(insertAt, 0, flowLine);
		writeUtf8(projectFile, lines.join("\n").replace(/\n+$/g, "") + "\n");
		return true;
	}

	function normalizeConvertigoYamlObjectHeaders(content) {
		return String(content || "").replace(/^(\s*↓.+ \[[^\]\r\n]+\]):$/gm, "$1: ");
	}

	function normalizeConvertigoFlowProjectVersion(content) {
		var text = String(content || "");
		if (text.indexOf("[flow.Flow") === -1) {
			return text;
		}
		return text.replace(/^↑convertigo:\s*([0-9]+)\.([0-9]+)\.([0-9]+)[^\r\n]*/m, function (match, major, minor) {
			var majorNumber = Number(major);
			var minorNumber = Number(minor);
			return majorNumber < 8 || majorNumber === 8 && minorNumber < 5 ? "↑convertigo: 8.5.0.m006" : match;
		});
	}

	function isFlowScriptWrite(writeResult) {
		return writeResult && String(writeResult.format || "") === "flowscript";
	}

	function flowScriptsDir(project) {
		return new File(new File(String(project.getDirPath())), "libs/flows");
	}

	function readUtf8(file) {
		return String(new Packages.java.lang.String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
	}

	function writeUtf8(file, content) {
		var parent = file.getParentFile();
		if (parent != null) {
			parent.mkdirs();
		}
		Files.write(file.toPath(), new Packages.java.lang.String(String(content)).getBytes(StandardCharsets.UTF_8));
	}

	function snapshotFlowScriptSidecars(project, writeResult) {
		if (!isFlowScriptWrite(writeResult)) {
			return null;
		}
		var dir = flowScriptsDir(project);
		var files = dir.isDirectory() ? dir.listFiles() : null;
		var snapshot = [];
		if (!files) {
			return snapshot;
		}
		var list = Packages.java.util.Arrays.asList(files).toArray();
		for (var i = 0; i < list.length; i++) {
			var file = list[i];
			var name = String(file.getName());
			if (file.isFile() && name.endsWith(".flow.js")) {
				snapshot.push({
					name: name,
					content: readUtf8(file)
				});
			}
		}
		return snapshot;
	}

	function restoreFlowScriptSidecars(project, writeResult, snapshot, flowName) {
		if (!isFlowScriptWrite(writeResult)) {
			return 0;
		}
		var dir = flowScriptsDir(project);
		var restored = 0;
		if (snapshot) {
			for (var i = 0; i < snapshot.length; i++) {
				writeUtf8(new File(dir, snapshot[i].name), snapshot[i].content);
				restored++;
			}
		}
		if (writeResult.code !== undefined && writeResult.code !== null && flowName) {
			writeUtf8(new File(dir, String(flowName) + ".flow.js"), writeResult.code);
			restored++;
		}
		return restored;
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
		value = enrichSvelteBootstrapPalette(request, value);
		value = enrichSveltePaletteMutations(request, value);
		value = compactToolValue(request, value);
		return finalizeResponse(ctx, request, jsonRpcResult(request.id, toolResult(value, ctx)));
	}

	function isSveltePaletteRequest(request) {
		var name = toolName(request);
		var args = toolArguments(request);
		var parentPath = String(args && args.parentPath || "");
		return name === "frontend-svelte-palette"
			|| (name === "authoring-palette"
				&& ((String(args && args.surface || "") === "frontend"
					&& String(args && args.builder || "") === "svelte")
					|| parentPath.indexOf("::frontends.svelte.") !== -1));
	}

	function enrichSveltePaletteMutationsForArgs(args, value) {
		if (!value || typeof value !== "object" || !Array.isArray(value.items)) {
			return value;
		}
		args = args || {};
		var focus = value.focus || {};
		value.items.forEach(function (item) {
			if (!item || typeof item !== "object" || !item.insert || item.mutation || item.apply) {
				return;
			}
			var slot = item.targetSlot || {};
			var path = String(slot.sourceMutationPath || focus.insertMutationPath || focus.sourceMutationPath || "");
			var sourceFile = String(slot.sourcePath || focus.insertSourcePath || focus.sourcePath || "");
			if (!path || path.indexOf("frontAst") !== 0 || !sourceFile) {
				return;
			}
			item.mutation = {
				op: "append",
				path: path,
				value: item.insert
			};
			item.apply = {
				tool: "frontend-svelte-mutate",
				arguments: {
					project: String(args.project || ""),
					sourceFile: sourceFile,
					mutation: item.mutation
				}
			};
		});
		return value;
	}

	function enrichSveltePaletteMutations(request, value) {
		return isSveltePaletteRequest(request)
			? enrichSveltePaletteMutationsForArgs(toolArguments(request) || {}, value)
			: value;
	}

	function bootstrapFrontendDescriptor(kind) {
		var page = kind === "page";
		var label = page ? "Page" : "Layout";
		var fileName = page ? "+page.flow.svelte" : "+layout.flow.svelte";
		var baseId = page ? "page" : "layout";
		var source = page
			? [
				"<script module>",
				"  export const _meta = {",
				"    version: 1,",
				"    id: \"project.${localName}\",",
				"    name: \"${LocalName}\",",
				"    label: \"${LocalName}\",",
				"    kind: \"page\",",
				"    tag: \"FlowComponent\",",
				"    runtime: \"flow-svelte\"",
				"  };",
				"</script>",
				"",
				"<FlowComponent id=\"${localName}\" title=\"${LocalName}\">",
				"  <Structure />",
				"</FlowComponent>",
				""
			].join("\n")
			: [
				"<script module>",
				"  export const _meta = {",
				"    version: 1,",
				"    id: \"project.${localName}Layout\",",
				"    name: \"${LocalName}Layout\",",
				"    label: \"${LocalName} layout\",",
				"    kind: \"layout\",",
				"    tag: \"FlowComponent\",",
				"    runtime: \"flow-svelte\"",
				"  };",
				"</script>",
				"",
				"<FlowComponent id=\"${localName}Layout\" title=\"${LocalName} layout\">",
				"  <Structure>",
				"    <PageShell id=\"pageShell\" maxWidth=\"1120px\" padding=\"24px\" gap=\"16px\" align=\"stretch\">",
				"      <Children>",
				"        <PageContent id=\"pageContent\" />",
				"      </Children>",
				"    </PageShell>",
				"  </Structure>",
				"</FlowComponent>",
				""
			].join("\n");
		return {
			id: "frontbuilder.svelte.bootstrap." + kind,
			name: label,
			localName: baseId,
			label: label,
			category: "Frontend route definitions",
			kind: page ? "frontendPageDefinition" : "frontendRouteLayoutDefinition",
			icon: page ? "mdi:file-outline" : "mdi:page-layout-outline",
			description: "Creates the initial Flow Svelte " + label.toLowerCase() + " model and wires config.frontbuilder.svelte.modelPath.",
			provider: "frontbuilder.svelte",
			namespace: "frontbuilder.svelte",
			sourceBacked: true,
			descriptorKind: "create",
			sourceWritable: true,
			traits: [page ? "definition.routePage" : "definition.routeLayout"],
			slots: {},
			targetKinds: ["frontendBuilder"],
			acceptedPositions: ["inside"],
			targetSlot: {
				id: "catalog",
				label: "Catalog",
				accepts: ["definition.routePage", "definition.routeLayout", "definition.routeFolder", "definition.uiBlock"],
				sourceMutationPath: "",
				sourcePath: "",
				sourceWritable: true,
				position: "inside",
				mode: "inside"
			},
			insert: {
				__frontendCreateSource: {
					builder: "svelte",
					baseId: baseId,
					directory: "model/svelte/src/routes",
					fileName: fileName,
					source: source,
					__setAsModelPath: true
				}
			}
		};
	}

	function enrichSvelteBootstrapPalette(request, value) {
		if (!value || typeof value !== "object" || !isSveltePaletteRequest(request)) {
			return value;
		}
		var args = toolArguments(request);
		var focus = value.focus || {};
		var focusPath = String(args.focusPath || args.targetPath || args.target || focus.path || "");
		var isBuilder = focusPath === "frontends.svelte" || (focus.kind === "frontendBuilder" && String(focus.type || "") === "svelte");
		if (!isBuilder || focus.sourceWritable !== false || focus.sourcePath) {
			return value;
		}
		var query = String(args.query || args.q || "").toLowerCase();
		var additions = [];
		if (!query || "page".indexOf(query) !== -1 || query.indexOf("page") !== -1) {
			additions.push(bootstrapFrontendDescriptor("page"));
		}
		if (!query || "layout".indexOf(query) !== -1 || query.indexOf("layout") !== -1) {
			additions.push(bootstrapFrontendDescriptor("layout"));
		}
		if (!additions.length) {
			return value;
		}
		value.items = (value.items || []).concat(additions);
		value.eligibleCount = Number(value.eligibleCount || 0) + additions.length;
		value.candidateCount = Number(value.candidateCount || 0) + additions.length;
		value.bootstrap = {
			modelPathMissing: true,
			next: "Insert Page or Layout to create the initial Flow Svelte model; the MCP will set config.frontbuilder.svelte.modelPath automatically."
		};
		return value;
	}

	function toolError(request, error, ctx) {
		request = request || {};
		error = error || {};
		return finalizeResponse(ctx, request, jsonRpcError(request.id, -32000, String(error.message || error), {
			code: String(error.code || "FLOW_MCP_TOOL_ERROR"),
			hint: error.hint ? String(error.hint) : ""
		}));
	}

	function firstForwardedValue(value) {
		return String(value || "").split(",")[0].trim();
	}

	function frontendPublicBaseUrl(ctx) {
		try {
			var context = ctx && typeof ctx.convertigoContext === "function" ? ctx.convertigoContext() : null;
			var servletRequest = context && context.httpServletRequest;
			if (!servletRequest) {
				return "";
			}
			var proto = firstForwardedValue(servletRequest.getHeader("X-Forwarded-Proto"))
				|| String(servletRequest.getScheme() || "").trim();
			proto = proto.toLowerCase();
			if (proto !== "http" && proto !== "https") {
				return "";
			}
			var host = firstForwardedValue(servletRequest.getHeader("X-Forwarded-Host"))
				|| firstForwardedValue(servletRequest.getHeader("Host"));
			if (!host) {
				host = String(servletRequest.getServerName() || "").trim();
				var port = Number(servletRequest.getServerPort() || 0);
				if (port > 0 && !(proto === "http" && port === 80) && !(proto === "https" && port === 443)) {
					host += ":" + port;
				}
			}
			if (!host || /[\s\/?#@]/.test(host)) {
				return "";
			}
			var contextPath = String(servletRequest.getContextPath() || "").trim();
			if (contextPath && !/^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*$/.test(contextPath)) {
				return "";
			}
			return proto + "://" + host + contextPath.replace(/\/+$/, "");
		} catch (e) {
			return "";
		}
	}

	function managedViewerDebugPort(ctx) {
		try {
			var context = ctx && typeof ctx.convertigoContext === "function" ? ctx.convertigoContext() : null;
			var servletRequest = context && context.httpServletRequest;
			var value = servletRequest && servletRequest.getHeader("X-Convertigo-Viewer-Debug-Port");
			var port = Number(String(value || "").trim());
			return isFinite(port) && port >= 1024 && port <= 65535 ? Math.floor(port) : 0;
		} catch (e) {
			return 0;
		}
	}

	function managedRevealMode(ctx) {
		try {
			var context = ctx && typeof ctx.convertigoContext === "function" ? ctx.convertigoContext() : null;
			var servletRequest = context && context.httpServletRequest;
			var value = String(servletRequest && servletRequest.getHeader("X-Convertigo-Reveal-Mode") || "")
				.trim().toLowerCase();
			return value === "true" || value === "1" || value === "yes" || value === "on";
		} catch (e) {
			return false;
		}
	}

	function prepareToolArguments(ctx, request, options) {
		options = options || {};
		var args = copyJson(toolArguments(request || {}));
		var name = toolName(request || {});
		var managedSourceWrite = name === "frontend-svelte-code-set"
			|| name === "frontend-svelte-code-patch"
			|| ((name === "code-set" || name === "code-patch") && String(args.sourceFile || "").length > 0);
		if (managedSourceWrite && args.reveal === undefined && managedRevealMode(ctx)) {
			args.reveal = true;
		}
		delete args.internalDeep;
		var responseBudgetPolicies = {
			"flow-catalog": { timeoutMs: 1000, maxResponseKB: 64, minItems: 1 },
			"flow-resource-search": { timeoutMs: 1000, maxResponseKB: 64, minItems: 1 },
			"flow-search": { timeoutMs: 1000, maxResponseKB: 64, minItems: 1 },
			"flow-app-progress": { timeoutMs: 3000, maxResponseKB: 128, minItems: 1 }
		};
		var responseBudgetPolicy = responseBudgetPolicies[name];
		if (responseBudgetPolicy) {
			args.timeoutMs = argInt(args.timeoutMs, responseBudgetPolicy.timeoutMs, 50, 5000);
			args.maxResponseKB = argInt(args.maxResponseKB, responseBudgetPolicy.maxResponseKB, 8, 256);
			args.minItems = argInt(args.minItems, responseBudgetPolicy.minItems, 1, 10);
			if (args.answerBefore !== undefined && args.answerBefore !== null && String(args.answerBefore) !== "") {
				args.answerBefore = Math.min(Number(args.answerBefore) || 0,
					Number(Packages.java.lang.System.currentTimeMillis()) + 5000);
			}
		}
		args = normalizeAuthoringParentPath(name, args);
		var hasExplicitProject = args.project || args.projectDir;
		if (args.project && (String(args.project).indexOf("/") !== -1 || String(args.project).indexOf("\\") !== -1)) {
			throw new Error(name + " expects project:\"<Convertigo project name>\". Use projectDir only for standalone tests with a filesystem path.");
		}
		var requiresProject = {
			"authoring-mutate": true,
			"authoring-palette": true,
			"authoring-tree": true,
			"frontend-svelte-action": true,
			"frontend-svelte-asset-import": true,
			"frontend-svelte-actions": true,
			"frontend-svelte-code-check": true,
			"frontend-svelte-code-get": true,
			"frontend-svelte-code-patch": true,
			"frontend-svelte-code-set": true,
			"frontend-svelte-mutate": true,
			"frontend-svelte-palette": true,
			"frontend-svelte-tree": true,
			"flow-app-progress": true,
			"flow-catalog": true,
			"flow-list": true,
			"flow-resource-delete": true,
			"flow-resource-get": true,
			"flow-resource-patch": true,
			"flow-resource-search": true,
			"flow-search": true,
			"flow-requestable-list": true,
			"flow-requestable-schema": true
		};
		if (requiresProject[name] === true && !hasExplicitProject && String(args.scope || "") !== "workspace") {
			throw new Error(name + " requires an explicit project. This MCP endpoint runs in lib_flow_mcp and is not necessarily the target project; call " + name + " with project:\"<target project>\".");
		}
		if (name === "flow-catalog") {
			if (!args.detail && !args.mode) {
				args.detail = "signature";
			}
			args.limit = argInt(args.limit, 10, 1, 10);
			if (args.doc === undefined || args.doc === null || String(args.doc) === "") {
				args.doc = false;
			}
			if (args.hints === undefined || args.hints === null || String(args.hints) === "") {
				args.hints = false;
			}
		} else if (name === "flow-search") {
			if (args.limit === undefined || args.limit === null || String(args.limit) === "") {
				args.limit = 10;
			}
			args.limit = argInt(args.limit, 10, 1, 10);
			if (args.context === undefined || args.context === null || String(args.context) === "") {
				args.context = 0;
			}
			if (args.doc === undefined || args.doc === null || String(args.doc) === "") {
				args.doc = false;
			}
			if (args.hints === undefined || args.hints === null || String(args.hints) === "") {
				args.hints = false;
			}
		} else if (name === "flow-tree") {
			if (!args.detail && !args.mode) {
				args.detail = "compact";
			}
			if (args.maxDepth === undefined || args.maxDepth === null || String(args.maxDepth) === "") {
				args.maxDepth = 4;
			}
		} else if (name === "authoring-tree") {
			if (!args.surface) {
				args.surface = "frontend";
			}
			if (!args.builder) {
				args.builder = "svelte";
			}
			if (args.includeFrontendCatalog === undefined || args.includeFrontendCatalog === null) {
				args.includeFrontendCatalog = false;
			}
			if (args.includeFlowCatalog === undefined || args.includeFlowCatalog === null) {
				args.includeFlowCatalog = false;
			}
			if (!args.detail && !args.mode) {
				args.detail = "compact";
			}
			if (args.maxDepth === undefined || args.maxDepth === null || String(args.maxDepth) === "") {
				args.maxDepth = 6;
			}
			if (args.allowLarge !== true) {
				args.maxDepth = Math.min(argInt(args.maxDepth, 6, 0, 20), 8);
				args.includeDefinition = false;
			}
			if (/^(?:full|debug)$/i.test(String(args.detail || args.mode || "")) && args.allowLarge !== true) {
				args.detail = "inspect";
				delete args.mode;
				args.maxDepth = Math.min(argInt(args.maxDepth, 4, 0, 20), 4);
				args.includeDefinition = false;
				args.includeSource = false;
				args.includeAnalysis = false;
			}
		} else if (name === "authoring-palette") {
			if (!args.surface) {
				args.surface = "frontend";
			}
			if (!args.builder) {
				args.builder = "svelte";
			}
			if (!args.position) {
				args.position = "inside";
			}
		} else if (name === "authoring-mutate") {
			if (!args.surface) {
				args.surface = "frontend";
			}
			if (!args.builder) {
				args.builder = "svelte";
			}
		} else if (/^frontend-svelte-/.test(name)) {
			args.surface = "frontend";
			args.builder = "svelte";
			if (name === "frontend-svelte-action" || name === "frontend-svelte-actions") {
				var publicBaseUrl = frontendPublicBaseUrl(ctx);
				if (publicBaseUrl) {
					args.publicBaseUrl = publicBaseUrl;
				} else {
					delete args.publicBaseUrl;
				}
			}
			if (name === "frontend-svelte-tree") {
				var frontendTreeFocusPath = String(args.focusPath || args.rootPath || args.path || "");
				var frontendTreeCatalogFocus = frontendTreeFocusPath === "catalog" ||
					frontendTreeFocusPath.indexOf(".catalog") >= 0;
				if (args.includeFrontendCatalog === undefined || args.includeFrontendCatalog === null) {
					args.includeFrontendCatalog = frontendTreeCatalogFocus;
				}
				if (args.includeFlowCatalog === undefined || args.includeFlowCatalog === null) {
					args.includeFlowCatalog = false;
				}
				if (!args.detail && !args.mode) {
					args.detail = "compact";
				}
				if (args.maxDepth === undefined || args.maxDepth === null || String(args.maxDepth) === "") {
					args.maxDepth = 8;
				}
				if (args.allowLarge !== true) {
					args.maxDepth = Math.min(argInt(args.maxDepth, 8, 0, 20), 8);
					args.includeDefinition = false;
				}
				if (/^(?:full|debug)$/i.test(String(args.detail || args.mode || "")) && args.allowLarge !== true) {
					args.detail = "inspect";
					delete args.mode;
					args.maxDepth = Math.min(argInt(args.maxDepth, 4, 0, 20), 4);
					args.includeDefinition = false;
					args.includeSource = false;
					args.includeAnalysis = false;
				}
			} else if (name === "frontend-svelte-palette") {
				if (!args.position) {
					args.position = "inside";
				}
			} else if (name === "frontend-svelte-action" || name === "frontend-svelte-actions") {
				if (name === "frontend-svelte-action") {
					var viewerDebugPort = managedViewerDebugPort(ctx);
					if (viewerDebugPort) {
						args.browserDebugPort = viewerDebugPort;
					} else {
						delete args.browserDebugPort;
					}
				}
				if (!args.origin) {
					args.origin = "mcp";
				}
				if (!args.targetObject) {
					args.targetObject = {
						kind: "frontendBuilder",
						type: "svelte",
						path: "frontends.svelte",
						summary: "Svelte builder"
					};
				}
				if (name === "frontend-svelte-action") {
					var actionAliases = {
						generate: "frontbuilder.svelte.generate",
						build: "frontbuilder.svelte.build",
						openBuilt: "frontbuilder.svelte.openBuilt",
						"open-built": "frontbuilder.svelte.openBuilt",
						dev: "frontbuilder.svelte.dev.start",
						"dev.ensure": "frontbuilder.svelte.dev.start",
						"dev-ensure": "frontbuilder.svelte.dev.start",
						"dev.start": "frontbuilder.svelte.dev.start",
						"dev-start": "frontbuilder.svelte.dev.start",
						"dev.stop": "frontbuilder.svelte.dev.stop",
						"dev-stop": "frontbuilder.svelte.dev.stop",
						"dev.open": "frontbuilder.svelte.dev.open",
						"dev-open": "frontbuilder.svelte.dev.open",
						"dev.sync": "frontbuilder.svelte.dev.sync",
						"dev-sync": "frontbuilder.svelte.dev.sync"
					};
					var rawActionId = String(args.actionId || args.command || args.action && args.action.id || "").trim();
					if (rawActionId) {
						args.action = args.action && typeof args.action === "object" ? args.action : {};
						args.action.id = actionAliases[rawActionId] || rawActionId;
						args.actionId = args.action.id;
					}
				}
			}
		} else if (name === "flow-block-get") {
			if (!args.name && args.block) {
				args.name = args.block;
			}
			var wantsSource = argBool(args.includeSource || args.includeCode || args.includeImplementation || args.includeHooks || args.allowSource, false);
			if (!wantsSource && (String(args.detail || args.mode || "").toLowerCase() === "full" ||
					String(args.detail || args.mode || "").toLowerCase() === "debug")) {
				args.detail = "compact";
				args.fullDetailIgnored = true;
			}
		} else if (name === "flow-block-list") {
			if (args.limit === undefined || args.limit === null || String(args.limit) === "") {
				args.limit = 20;
			}
		} else if (name === "flow-resource-search") {
			args.limit = argInt(args.limit, 10, 1, 10);
			args.maxFileBytes = argInt(args.maxFileBytes, 120000, 1000, 120000);
			args.snippetChars = argInt(args.snippetChars || args.maxSnippetChars, 180, 40, 220);
			if (args.doc === undefined || args.doc === null || String(args.doc) === "") {
				args.doc = false;
			}
			if (args.hints === undefined || args.hints === null || String(args.hints) === "") {
				args.hints = false;
			}
		} else if (name === "flow-resource-get") {
			if (args.allowLarge !== true && (args.maxBytes === undefined || args.maxBytes === null || String(args.maxBytes) === "")) {
				args.maxBytes = 12000;
			}
		} else if (name === "flow-test") {
			if (String(args.flowSource || "").toLowerCase() === "draft" || args.definition !== undefined) {
				throw new Error("flow-test cannot validate FlowScript working copies. Use code-run({project,qname}) after code-set/code-patch; code-run executes the draft without resending code.");
			}
		}
		if (/^(?:flow-)?code-(get|set|patch|check|run|analyze)$/.test(name)) {
			args.draft = true;
		}
		if (/^(?:flow-)?code-(check|run|analyze)$/.test(name)) {
			delete args.code;
			delete args.flowScript;
			delete args.flowSource;
			delete args.definition;
		}
		var workspaceSearch = options.workspaceSearch === true
			&& String(args.scope || "") === "workspace"
			&& !args.project
			&& !args.projectDir;
		if (!workspaceSearch && options.resolveProject !== false) {
			args = resolveProjectDir(args);
		}
		args = inferFrontendMutationSourceFile(name, args);
		return args;
	}

	function runToolBlock(ctx, request, options, handler) {
		try {
			var args = prepareToolArguments(ctx, request, options || {});
			return toolResponse(request, persistSourceMutationResult(request, args, handler(args)), ctx);
		} catch (e) {
			return toolError(request, e, ctx);
		}
	}

	function persistSourceMutationResult(request, args, result) {
		var name = toolName(request || {});
		var frontendMutate = name === "frontend-svelte-mutate"
			|| name === "frontend-svelte-fullsync-schema"
			|| (name === "authoring-mutate" && String(args && args.surface || "") === "frontend"
				&& String(args && args.builder || "") === "svelte");
		if (!frontendMutate || !result || result.ok !== true || typeof result.source !== "string" || !result.sourceFile) {
			return result;
		}
		if (args && (boolArg(args.dryRun, false) === true || boolArg(args.persist, true) === false || boolArg(args.write, true) === false)) {
			result.written = false;
			return result;
		}
		var projectRoot = args && args.projectDir ? new File(String(args.projectDir)).getCanonicalFile() : null;
		var sourceFile = new File(String(result.sourceFile));
		if (!sourceFile.isAbsolute() && projectRoot) {
			sourceFile = new File(projectRoot, String(result.sourceFile));
		}
		sourceFile = sourceFile.getCanonicalFile();
		if (projectRoot) {
			var rootPath = String(projectRoot.getCanonicalPath());
			var filePath = String(sourceFile.getCanonicalPath());
			if (filePath !== rootPath && filePath.indexOf(rootPath + String(File.separator)) !== 0) {
				throw new Error("Refusing to write frontend source outside projectDir: " + filePath);
			}
		}
		writeUtf8(sourceFile, result.source);
		result.sourceFile = String(sourceFile.getAbsolutePath());
		result.written = true;
		result.writtenFile = projectRoot ? relativeProjectPath(projectRoot, sourceFile) : String(sourceFile.getAbsolutePath());
		result.writtenBytes = String(result.source).length;
		result.studioRefresh = studioRefreshFlowEngine(args, "frontend-source-mutation");
		result.refreshed = result.studioRefresh && (result.studioRefresh.refreshed === true || result.studioRefresh.scheduled === true);
		return result;
	}

	function relativeProjectPath(projectRoot, file) {
		try {
			var rootPath = String(projectRoot.getCanonicalPath());
			var filePath = String(file.getCanonicalPath());
			if (filePath === rootPath) {
				return "";
			}
			if (filePath.indexOf(rootPath + String(File.separator)) === 0) {
				return filePath.substring(rootPath.length + 1).replace(/\\/g, "/");
			}
		} catch (_ignoreRelativeProjectPath) {
		}
		return String(file.getAbsolutePath());
	}

	function frontendCreateSourceSpec(args) {
		args = args || {};
		var mutation = args.mutation || {};
		var value = mutation.value || args.insert || args.value || {};
		return args.createSource || args.creation || mutation.__frontendCreateSource || value.__frontendCreateSource || null;
	}

	function isFrontendSourceCreation(args) {
		return frontendCreateSourceSpec(args) !== null;
	}

	function yamlPlainScalar(value) {
		var text = String(value || "").trim();
		if ((text.charAt(0) === "\"" && text.charAt(text.length - 1) === "\"") ||
				(text.charAt(0) === "'" && text.charAt(text.length - 1) === "'")) {
			if (text.charAt(0) === "\"") {
				try {
					return String(JSON.parse(text));
				} catch (_ignoreJsonScalar) {
				}
			}
			return text.substring(1, text.length - 1).replace(/''/g, "'");
		}
		return text;
	}

	function frontendBuilderModelPath(projectRoot, builderName) {
		if (!projectRoot) {
			return "";
		}
		var engineFile = new File(projectRoot, "libs/flow/engine.yaml");
		if (!engineFile.isFile()) {
			return "";
		}
		var builderSafe = safeFileName(builderName || "svelte");
		var lines = readUtf8(engineFile).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
		var builderLine = -1;
		var builderPattern = new RegExp("^    " + builderSafe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\s*$");
		for (var i = 0; i < lines.length; i++) {
			if (builderPattern.test(lines[i])) {
				builderLine = i;
				break;
			}
		}
		if (builderLine < 0) {
			return "";
		}
		var end = lines.length;
		for (var j = builderLine + 1; j < lines.length; j++) {
			if (/^    \S/.test(lines[j]) || /^  \S/.test(lines[j]) || /^\S/.test(lines[j])) {
				end = j;
				break;
			}
		}
		for (var k = builderLine + 1; k < end; k++) {
			var match = /^      modelPath:\s*(.*)$/.exec(lines[k]);
			if (match) {
				return yamlPlainScalar(match[1]);
			}
		}
		return "";
	}

	function frontendMutationUsesFrontAst(mutation) {
		mutation = mutation || {};
		if (mutation.op === "batch" && mutation.mutations) {
			for (var i = 0; i < mutation.mutations.length; i++) {
				if (frontendMutationUsesFrontAst(mutation.mutations[i])) {
					return true;
				}
			}
			return false;
		}
		return String(mutation.path || mutation.from || mutation.source || "").indexOf("frontAst") === 0;
	}

	function inferFrontendMutationSourceFile(name, args) {
		args = args || {};
		if (args.sourceFile || args.sourcePath || isFrontendSourceCreation(args)) {
			return args;
		}
		var isFrontendCode = /^frontend-svelte-code-(?:get|check|set|patch)$/.test(String(name || ""));
		var isFrontendMutate = name === "frontend-svelte-mutate" ||
			(name === "authoring-mutate" && String(args.surface || "") === "frontend" && String(args.builder || "") === "svelte");
		if (!isFrontendMutate && !isFrontendCode) {
			return args;
		}
		if (!isFrontendCode) {
			var mutations = args.mutations || (args.mutation ? [args.mutation] : []);
			var needsFrontAstSource = false;
			for (var i = 0; i < mutations.length; i++) {
				if (frontendMutationUsesFrontAst(mutations[i])) {
					needsFrontAstSource = true;
					break;
				}
			}
			if (!needsFrontAstSource) {
				return args;
			}
		}
		var projectRoot = args.projectDir ? new File(String(args.projectDir)).getCanonicalFile() : null;
		var modelPath = frontendBuilderModelPath(projectRoot, args.builder || "svelte");
		if (!modelPath) {
			throw new Error(name + " requires sourceFile or config.frontbuilder.svelte.modelPath.");
		}
		args.sourceFile = modelPath;
		return args;
	}

	function safeFileName(value) {
		var safe = String(value || "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
		return safe || "project";
	}

	function frontendComponentTag(value) {
		var parts = String(value || "").split(/[^A-Za-z0-9]+/);
		var out = "";
		parts.forEach(function (part) {
			if (part) {
				out += part.substring(0, 1).toUpperCase() + part.substring(1);
			}
		});
		return out || "Component";
	}

	function lowerFirst(value) {
		value = String(value || "");
		return value ? value.substring(0, 1).toLowerCase() + value.substring(1) : "component";
	}

	function frontendSourceLocalName(blockId) {
		blockId = String(blockId || "item");
		var dot = blockId.lastIndexOf(".");
		return dot < 0 ? blockId : blockId.substring(dot + 1);
	}

	function frontendNamespaceFromFocus(args) {
		var focusPath = String(args && (args.focusPath || args.targetPath || args.target || "") || "");
		var parts = focusPath.split(".");
		for (var i = 0; i < parts.length; i++) {
			if (parts[i] === "catalog" && i + 2 < parts.length) {
				return parts[i + 2];
			}
		}
		return "";
	}

	function frontendSourceTemplateValues(builderName, blockId) {
		var dot = String(blockId || "").lastIndexOf(".");
		var namespace = dot < 0 ? "" : String(blockId).substring(0, dot);
		var localName = dot < 0 ? String(blockId || "") : String(blockId).substring(dot + 1);
		var tag = frontendComponentTag(localName);
		return {
			builder: builderName,
			id: blockId,
			namespace: namespace,
			namespacePath: namespace.replace(/\./g, "/"),
			localName: localName,
			LocalName: tag,
			tag: tag,
			actionName: lowerFirst(tag)
		};
	}

	function applyTemplate(template, values) {
		var out = String(template || "");
		Object.keys(values || {}).forEach(function (key) {
			out = out.split("${" + key + "}").join(String(values[key]));
		});
		return out;
	}

	function frontendSourceTargetDirectory(projectRoot, rootDir, create, args) {
		create = create || {};
		args = args || {};
		var targetSourcePath = String(args.sourcePath || args.sourceFile || args.focusSourcePath ||
			create.targetSourcePath || create.__targetSourcePath || create.focusSourcePath || "");
		if (!targetSourcePath) {
			return String(create.fallbackDirectory || "");
		}
		var target = new File(targetSourcePath);
		if (!target.isAbsolute()) {
			target = new File(projectRoot, targetSourcePath);
		}
		target = target.getCanonicalFile();
		if (target.isFile() || String(target.getName()).indexOf("+") === 0) {
			target = target.getParentFile().getCanonicalFile();
		}
		var rootPath = String(rootDir.getCanonicalPath());
		var targetPath = String(target.getCanonicalPath());
		if (targetPath !== rootPath && targetPath.indexOf(rootPath + String(File.separator)) !== 0) {
			throw new Error("Frontend source target escapes builder root: " + targetPath);
		}
		if (targetPath === rootPath) {
			return "";
		}
		return targetPath.substring(rootPath.length + 1).replace(/\\/g, "/");
	}

	function ensureFrontendBuilderModelPath(projectRoot, builderName, file) {
		var fileName = String(file && file.getName ? file.getName() : "");
		if (!/^\+(?:page|layout)\.flow\.svelte$/.test(fileName)) {
			return null;
		}
		var relative = relativeProjectPath(projectRoot, file);
		var builderSafe = safeFileName(builderName);
		if (relative.indexOf("libs/flow/frontbuilder/" + builderSafe + "/model/") !== 0) {
			return null;
		}
		var engineFile = new File(projectRoot, "libs/flow/engine.yaml");
		if (!engineFile.isFile()) {
			return null;
		}
		var original = readUtf8(engineFile).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		var lines = original.split("\n");
		var builderLine = -1;
		var builderPattern = new RegExp("^    " + builderSafe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\s*$");
		for (var i = 0; i < lines.length; i++) {
			if (builderPattern.test(lines[i])) {
				builderLine = i;
				break;
			}
		}
		if (builderLine < 0) {
			return null;
		}
		var end = lines.length;
		for (var j = builderLine + 1; j < lines.length; j++) {
			if (/^    \S/.test(lines[j]) || /^  \S/.test(lines[j]) || /^\S/.test(lines[j])) {
				end = j;
				break;
			}
		}
		for (var k = builderLine + 1; k < end; k++) {
			if (/^      modelPath:/.test(lines[k])) {
				return {
					changed: false,
					modelPath: relative,
					file: relativeProjectPath(projectRoot, engineFile)
				};
			}
		}
		var insertAt = builderLine + 1;
		for (var l = builderLine + 1; l < end; l++) {
			if (/^      target:/.test(lines[l])) {
				insertAt = l + 1;
				break;
			}
		}
		lines.splice(insertAt, 0, "      modelPath: " + yamlScalar(relative));
		writeUtf8(engineFile, lines.join("\n").replace(/\n+$/g, "") + "\n");
		return {
			changed: true,
			modelPath: relative,
			file: relativeProjectPath(projectRoot, engineFile)
		};
	}

	function createFrontendSource(args) {
		args = args || {};
		var create = frontendCreateSourceSpec(args);
		if (!create || typeof create !== "object") {
			throw new Error("frontend source creation requires a __frontendCreateSource payload from the palette.");
		}
		var projectRoot = args.projectDir ? new File(String(args.projectDir)).getCanonicalFile() : null;
		if (!projectRoot) {
			throw new Error("frontend source creation requires project or projectDir.");
		}
		var builderName = String(create.builder || args.builder || "svelte");
		var mutation = args.mutation || {};
		var definition = args.definition && typeof args.definition === "object" ? args.definition : {};
		var baseId = String(args.localName || mutation.localName || definition.localName || create.localName || create.baseId || "project.item");
		var targetNamespace = String(args.namespace || args.targetNamespace || create.__targetNamespace || frontendNamespaceFromFocus(args) || "");
		if (targetNamespace) {
			baseId = targetNamespace + "." + frontendSourceLocalName(baseId);
		}
		var rootDir = new File(projectRoot, "libs/flow/frontbuilder/" + safeFileName(builderName)).getCanonicalFile();
		var rootPath = String(rootDir.getCanonicalPath());
		var file = null;
		var blockId = baseId;
		var source = "";
		var targetRouteDirectory = frontendSourceTargetDirectory(projectRoot, rootDir, create, args);
		var directoryOnly = create.directoryOnly === true || String(create.directoryOnly) === "true";
		for (var attempt = 0; attempt < 100; attempt++) {
			var candidateId = attempt === 0 ? baseId : baseId + (attempt + 1);
			var values = frontendSourceTemplateValues(builderName, candidateId);
			values.targetRouteDirectory = targetRouteDirectory;
			var directory = applyTemplate(create.directory, values);
			var fileName = applyTemplate(create.fileName || "", values);
			values.fileName = fileName;
			source = applyTemplate(create.source, values);
			var candidate = directoryOnly
				? new File(rootDir, directory).getCanonicalFile()
				: new File(new File(rootDir, directory), fileName).getCanonicalFile();
			var candidatePath = String(candidate.getCanonicalPath());
			if (candidatePath !== rootPath && candidatePath.indexOf(rootPath + String(File.separator)) !== 0) {
				throw new Error("Frontend source path escapes builder root: " + candidatePath);
			}
			if (directoryOnly ? !candidate.exists() : !candidate.isFile()) {
				file = candidate;
				blockId = candidateId;
				break;
			}
		}
		if (!file) {
			throw new Error("Unable to allocate a unique frontend source for " + baseId);
		}
		if (directoryOnly) {
			file.mkdirs();
			var markerName = String(create.markerFile || "");
			if (markerName) {
				var marker = new File(file, markerName).getCanonicalFile();
				writeUtf8(marker, applyTemplate(create.markerSource || "", frontendSourceTemplateValues(builderName, blockId)));
				file = marker;
				source = String(create.markerSource || "");
			}
		} else {
			writeUtf8(file, source);
		}
		var result = {
			ok: true,
			target: "frontendSource",
			created: true,
			written: true,
			builder: builderName,
			sourceId: blockId,
			sourceFile: String(file.getAbsolutePath()),
			writtenFile: relativeProjectPath(projectRoot, file),
			writtenBytes: String(source).length
		};
		result.modelPath = ensureFrontendBuilderModelPath(projectRoot, builderName, file);
		result.studioRefresh = studioRefreshFlowEngine(args, "frontend-source-create");
		result.refreshed = result.studioRefresh && (result.studioRefresh.refreshed === true || result.studioRefresh.scheduled === true);
		return result;
	}

	function withNamedFlowSource(ctx, args) {
		args = args || {};
		if (!args.name && args.qname) {
			var parts = String(args.qname).split(".");
			args.name = parts[parts.length - 1];
		}
		if (args.name) {
			var rawQName = String(args.qname || args.flowQName || args.name);
			var projectName = String(args.project || "");
			if (rawQName.charAt(0) === "." && projectName) {
				rawQName = projectName + rawQName;
			} else if (rawQName.indexOf(".") < 0 && projectName) {
				rawQName = projectName + "." + rawQName;
			}
			args.flowQName = rawQName;
		}
		var hasDefinition = args.definition !== undefined && args.definition !== null;
		if (!hasDefinition && (args.flowSource === undefined || args.flowSource === null || String(args.flowSource).trim() === "") && args.name) {
			var status = ctx.flowCodeStatus(args);
			if (status && status.workingCopy === true) {
				var draft = ctx.flowCodeGet(args);
				var validation = ctx.flowSourceValidate(Object.assign({}, args, {
					name: args.name,
					code: draft.code
				}));
				args.flowSource = validation.source;
			} else {
				var flow = ctx.flowGet(args.name, args);
				args.flowSource = flow.source;
			}
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

	function requestValue(ctx, value) {
		if (value === undefined || value === null || value === "") {
			value = "input.request";
		}
		if (typeof value === "string") {
			return ctx.expr(value) || {};
		}
		return value;
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

	function compactFlowListToolValue(request, value) {
		if (!value || typeof value !== "object" || responseDetail(request) === "full") {
			return value;
		}
		var flows = value.flows || [];
		return {
			ok: value.ok !== false,
			count: flows.length,
			flows: flows.map(function (flow) {
				return {
					name: flow.name,
					format: flow.format || ""
				};
			}),
			responseDetail: "summary",
			next: "Use code-get for one Flow or block source, or code-set to edit a working copy."
		};
	}

	function compactDiagnosticCandidate(candidate) {
		candidate = candidate || {};
		var out = {};
		["block", "property", "score", "confidence", "signature"].forEach(function (key) {
			if (candidate[key] !== undefined && candidate[key] !== null && candidate[key] !== "") {
				out[key] = candidate[key];
			}
		});
		if (candidate.description) {
			out.description = String(candidate.description);
		}
		return out;
	}

	function diagnosticLimit(request) {
		var args = toolArguments(request);
		return argInt(args.maxDiagnostics || args.diagnosticLimit || args.diagnosticsLimit, 8, 1, 25);
	}

	function compactFlowCodeDiagnostic(diagnostic) {
		diagnostic = diagnostic || {};
		var out = {};
		["severity", "phase", "code", "line", "message", "block", "property", "path", "actual", "candidateDecision", "next"].forEach(function (key) {
			if (diagnostic[key] !== undefined && diagnostic[key] !== null && diagnostic[key] !== "") {
				out[key] = diagnostic[key];
			}
		});
		if (diagnostic.hint && (!diagnostic.candidates || !diagnostic.candidates.length)) {
			out.hint = diagnostic.hint;
		}
		if (diagnostic.expected) {
			out.expected = (diagnostic.expected || []).slice(0, 12);
			if ((diagnostic.expected || []).length > out.expected.length) {
				out.omittedExpected = diagnostic.expected.length - out.expected.length;
			}
		}
		if (diagnostic.candidates) {
			out.candidates = (diagnostic.candidates || []).slice(0, 3).map(compactDiagnosticCandidate);
		}
		if (diagnostic.create) {
			out.create = diagnostic.create;
		}
		return out;
	}

	function compactFlowCodeDiagnosticReport(request, details) {
		var diagnostics = [];
		var diagnosticCount = 0;
		var hasMore = false;
		if (Object.prototype.toString.call(details) === "[object Array]") {
			diagnostics = details;
			diagnosticCount = diagnostics.length;
		} else if (details && typeof details === "object") {
			diagnostics = details.diagnostics || [];
			diagnosticCount = Number(details.diagnosticCount || diagnostics.length);
			hasMore = details.hasMore === true;
		}
		var limit = diagnosticLimit(request);
		var shown = diagnostics.slice(0, limit).map(compactFlowCodeDiagnostic);
		diagnosticCount = Math.max(diagnosticCount, diagnostics.length);
		return {
			diagnosticCount: diagnosticCount,
			diagnosticsShown: shown.length,
			hasMore: hasMore || diagnosticCount > shown.length,
			diagnostics: shown
		};
	}

	function compactFlowCodeError(request, error) {
		if (!error || typeof error !== "object") {
			return error;
		}
		var out = {};
		["code", "message", "hint"].forEach(function (key) {
			if (error[key] !== undefined && error[key] !== null && error[key] !== "") {
				out[key] = error[key];
			}
		});
		if (error.details) {
			var report = compactFlowCodeDiagnosticReport(request, error.details);
			out.diagnosticCount = report.diagnosticCount;
			out.diagnosticsShown = report.diagnosticsShown;
			out.hasMore = report.hasMore;
			out.diagnostics = report.diagnostics;
		}
		return out;
	}

	function compactFlowCodeWriteToolValue(request, value) {
		if (!value || typeof value !== "object" || responseDetail(request) === "full") {
			return value;
		}
		var name = toolName(request);
		var out = {};
		["ok", "qname", "name", "block", "target", "runtime", "format", "dry", "written", "finalized", "promoted", "blockAlreadySaved", "dirty", "exists", "discarded", "revision", "oldRevision", "workingRevision", "officialRevision", "draftCleared",
			"dboHasChanged", "dboBNew", "dboFlowSourceDirty", "dboVariableCount"].forEach(function (key) {
			if (value[key] !== undefined && value[key] !== null && value[key] !== "") {
				out[key] = value[key];
			}
		});
			if (value.draft === true || value.workingCopy === true) {
				out.workingCopy = true;
				out.unsaved = true;
			}
		if (value.codeFile) {
			out.codeFile = value.codeFile;
		}
		if (value.workingCodeFile) {
			out.workingCodeFile = value.workingCodeFile;
		}
		if (value.officialCodeFile) {
			out.officialCodeFile = value.officialCodeFile;
		}
		if (value.error) {
			out.error = compactFlowCodeError(request, value.error);
		}
		if (value.diagnostics) {
			var report = compactFlowCodeDiagnosticReport(request, {
				diagnostics: value.diagnostics,
				diagnosticCount: value.diagnosticCount,
				hasMore: value.hasMore
			});
			out.diagnosticCount = report.diagnosticCount;
			out.diagnosticsShown = report.diagnosticsShown;
			out.hasMore = report.hasMore;
			out.diagnostics = report.diagnostics;
		}
		if (value.warnings) {
			out.warnings = (value.warnings || []).slice(0, 5).map(compactFlowCodeDiagnostic);
		}
		if (value.inputVariables) {
			out.inputVariables = (value.inputVariables || []).slice(0, 30);
		}
		if (value.inputDefinitions) {
			out.inputDefinitions = compactJsonPreview(value.inputDefinitions, {
				maxDepth: 3,
				maxObjectKeys: 20,
				maxArrayItems: 3,
				maxStringChars: 160
			});
		}
		if (value.testCases) {
			out.testCases = compactJsonPreview(value.testCases, {
				maxDepth: 3,
				maxObjectKeys: 12,
				maxArrayItems: 2,
				maxStringChars: 160
			});
		}
		if (value.registration) {
			out.registration = compactRegistration(value.registration);
		}
		out.responseDetail = "summary";
		if (value.ok === false) {
			out.next = value.draft
				? "Patch the working copy with code-patch, then check again with code-check."
				: "Fix diagnostics, then retry code-set before saving.";
		} else if (name === "flow-code-status" || name === "code-status") {
			out.next = value.dirty
				? "Run/check the working copy, then promote to save or discard to cancel."
				: "No unsaved working copy. Use code-set or code-patch to edit.";
		} else if (name === "flow-code-discard" || name === "code-discard") {
			out.next = "Working copy discarded. Use code-get to read the official Flow or code-set to edit again.";
			} else if (value.blockAlreadySaved) {
				out.next = value.next || "Project-local block source is already saved by code-set/code-patch. Run an executable Flow that uses the block.";
			} else if (value.draft && value.written) {
				out.next = "UNSAVED WORKING COPY: code-set updated and checked only the draft. Run with code-run without sending code, then call code-promote to save; do not stop after draft-only success.";
			} else if (value.draft) {
				out.next = "UNSAVED WORKING COPY: check passed only for the draft. Run with code-run without sending code, then call code-promote to save; do not stop after draft-only success.";
			} else if (name === "flow-code-check" || name === "code-check") {
				out.next = "Check passed.";
		} else if (value.promoted) {
			out.next = "Working copy saved to the official Flow. Stop if code-run already proved the result.";
		} else if (value.dry) {
			out.next = name.indexOf("flow-block-code-") === 0
				? "Low-level validation passed. Call code-set normally to register the block, then run a Flow that uses it."
				: "Low-level validation passed. Prefer the working-copy path: call code-set normally, then code-run and code-promote.";
		} else if (value.block) {
			out.next = "Project-local block source is saved. Validate it through an executable Flow using code-run; do not call flow-test for FlowScript drafts.";
		} else if (value.registration && value.registration.saveMode === "fast") {
			out.next = "Fast save done. Studio refresh is attempted by default; pass refresh:false only when UI refresh must be skipped. If code-run already proved the result, stop. Use flow-test only when a saved-flow validation is still needed. Pass saveProject:true only for full Convertigo export.";
		} else {
			out.next = "Saved. If code-run already proved the result, stop; otherwise use flow-test for one validation.";
		}
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
		var name = toolName(request);
		if (!value || typeof value !== "object") {
			return value;
		}
		if (value.error && (name === "flow-code-run" || name === "code-run")) {
			return compactFlowCodeWriteToolValue(request, value);
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
		if (value.trace !== undefined && (name === "flow-code-run" || name === "code-run") && !argBool(args.includeTrace || args.includeFullTrace || args.fullTrace, false)) {
			var noTraceOut = mutableOut();
			noTraceOut.traceNodeCount = value.trace && value.trace.nodes ? value.trace.nodes.length : 0;
			delete noTraceOut.trace;
			noTraceOut.traceHint = "Trace omitted by default for code-run. Pass includeTrace=true for compact trace or includeFullTrace=true only for full per-node values.";
		} else if (value.trace !== undefined && !argBool(args.includeFullTrace || args.fullTrace, false)) {
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
		if ((name === "flow-code-run" || name === "code-run") && value.schemaUpdates !== undefined &&
				!argBool(args.includeSchemaUpdates || args.includeFullSchemaUpdates || args.fullSchemaUpdates, false)) {
			var schemaOut = mutableOut();
			var schemaLimit = argInt(args.maxSchemaUpdates, 5, 0, 50);
			schemaOut.schemaUpdateCount = (value.schemaUpdates || []).length || 0;
			schemaOut.schemaUpdates = (value.schemaUpdates || []).slice(0, schemaLimit).map(function (update) {
				return {
					scope: update.scope,
					node: update.node,
					block: update.block,
					property: update.property,
					file: update.file,
					schema: compactSchemaSummary(update.schema, argInt(args.maxSchemaPaths, 12, 4, 80))
				};
			});
			if ((value.schemaUpdates || []).length > schemaLimit) {
				schemaOut.schemaUpdatesOmitted = value.schemaUpdates.length - schemaLimit;
			}
			schemaOut.schemaUpdatesHint = "Schema updates compacted by default. Pass includeSchemaUpdates=true only when full learned schemas are required.";
		}
			if ((name === "flow-code-run" || name === "code-run") && value.ok !== false) {
				var runOut = mutableOut();
				if (value.draft === true) {
					runOut.workingCopy = true;
					runOut.unsaved = true;
					delete runOut.draft;
				}
				runOut.next = value.draft === true
					? "PASSED ON DRAFT: code-run proved the working copy. If the returned result matches the user request, call code-promote({project,qname,revision}) now. Do not resend code or rewrite for cosmetic changes."
					: "Official Flow run/test passed. Stop unless the user asked for another validation.";
				if (value.draft === true) {
					var warnings = runOut.warnings || [];
					warnings.push({
						severity: "warning",
						code: "FLOW_CODE_UNSAVED_WORKING_COPY",
						message: "code-run executed an unsaved working copy.",
						hint: "Promote this revision before stopping. Patch only if the runtime result is functionally wrong."
					});
					runOut.warnings = warnings;
				}
			} else if (name === "flow-test" && value.ok !== false) {
			var testOut = mutableOut();
			testOut.next = "Saved Flow test passed. Stop unless the user asked for another validation.";
		}
		var compacted = out || value;
		if ((name === "flow-code-run" || name === "code-run") && compacted && typeof compacted === "object") {
			var runtimeText = "";
			try {
				runtimeText = JSON.stringify(compacted.error || compacted.result || compacted);
			} catch (e) {
				runtimeText = "";
			}
			if (runtimeText.indexOf("Java.type") !== -1 ||
					(runtimeText.indexOf("Java") !== -1 && (runtimeText.indexOf("not defined") !== -1 || runtimeText.indexOf("n'est pas") !== -1))) {
				var hints = compacted.warnings || [];
				hints.push({
					severity: "warning",
					code: "RHINO_USES_PACKAGES_NOT_JAVA_TYPE",
					message: "Rhino blocks do not expose Java.type.",
					hint: "Use Packages.java.lang.ProcessBuilder or Packages.<package.Class> in Rhino 1.9.0, not Java.type(...)."
				});
				compacted.warnings = hints;
			}
		}
		return compacted;
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
		["requested", "registered", "created", "updated", "saved", "projectSaved", "flowDeclarationSaved",
			"saveMode", "refreshed", "schemaCacheCleared", "flowScriptSidecarsRestored",
			"qname", "message"].forEach(function (key) {
			if (registration[key] !== undefined && registration[key] !== null && registration[key] !== "") {
				out[key] = registration[key];
			}
		});
			if (registration.studioRefresh) {
				out.studioRefresh = {
					status: registration.studioRefresh.status,
					scheduled: registration.studioRefresh.scheduled,
					refreshed: registration.studioRefresh.refreshed,
					refreshedQName: registration.studioRefresh.refreshedQName,
					message: registration.studioRefresh.message
				};
			}
			if (registration.flagsBeforeFastSaveClean) {
				out.flagsBeforeFastSaveClean = registration.flagsBeforeFastSaveClean;
			}
			if (registration.flagsAfterFastSaveClean) {
				out.flagsAfterFastSaveClean = registration.flagsAfterFastSaveClean;
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

	function compactFrontendWriteToolValue(request, value) {
		if (wantsFullMutationResponse(request) || !value || typeof value !== "object") {
			return value;
		}
		var out = {};
		["ok", "title", "message", "sourceFile", "revision", "oldRevision", "contentLength",
			"hunks", "errorCount", "warningCount", "written", "writtenFile", "writtenBytes",
			"created", "mutationCount", "refreshed", "schemaRequestable", "schemaLearned"].forEach(function (key) {
			if (value[key] !== undefined && value[key] !== null && value[key] !== "") out[key] = value[key];
		});
		if (typeof value.source === "string") out.sourceChars = value.source.length;
		if (typeof value.code === "string") out.sourceChars = value.code.length;
		if (value.diagnostics) {
			out.diagnostics = (Array.isArray(value.diagnostics) ? value.diagnostics : []).slice(0, 20);
			if (value.diagnostics.length > 20) out.omittedDiagnostics = value.diagnostics.length - 20;
		}
		if (value.error) out.error = compactFlowCodeError(request, value.error);
		if (value.schema) out.schema = compactSchemaSummary(value.schema, 20);
		if (value.debug) out.debug = compactJsonPreview(value.debug, { maxDepth: 2, maxObjectKeys: 12, maxArrayItems: 8 });
		if (value.studioRefresh) {
			out.studioRefresh = compactJsonPreview(value.studioRefresh, { maxDepth: 2, maxObjectKeys: 12, maxArrayItems: 8 });
		}
		if (value.devSync) {
			out.devSync = compactJsonPreview(value.devSync, { maxDepth: 2, maxObjectKeys: 12, maxArrayItems: 8 });
		}
		out.responseDetail = "summary";
		var readTool = "code-get";
		out.next = "Source omitted after validation. Use " + readTool + " to read it again, or detail:'full' only for debugging.";
		return out;
	}

	function compactToolValue(request, value) {
		var name = toolName(request);
		if ((name === "frontend-svelte-tree" || name === "authoring-tree") && value && typeof value === "object") {
			var treeArgs = toolArguments(request);
			var boundedTreeRequest = treeArgs.allowLarge !== true &&
				(treeArgs.includeDefinition === true || Number(treeArgs.maxDepth || 0) > 8);
			if (boundedTreeRequest) {
				value.warnings = Array.isArray(value.warnings) ? value.warnings.slice() : [];
				value.warnings.push({
					code: "TREE_RESPONSE_BOUNDED",
					message: "Tree definitions were omitted and depth was limited to 8. Focus one path for exact properties or set allowLarge:true for explicit debugging."
				});
			}
			if (/^(?:full|debug)$/i.test(String(treeArgs.detail || treeArgs.mode || "")) && treeArgs.allowLarge !== true) {
				value.warnings = Array.isArray(value.warnings) ? value.warnings.slice() : [];
				value.warnings.push({
					code: "FULL_TREE_DETAIL_DOWNGRADED",
					message: "Full tree detail was replaced with a bounded inspection response. Focus one path or set allowLarge:true for explicit debugging."
				});
				value.responseDetail = "inspect";
				value.next = "Repeat with an exact focusPath and property. Use allowLarge:true only for explicit debugging."
			}
			return value;
		}
		if (name === "flow-list") {
			return compactFlowListToolValue(request, value);
		}
		var codeArgs = toolArguments(request);
		var sourceCodeRequest = codeArgs && (
			codeArgs.sourceFile || codeArgs.sourcePath ||
			String(codeArgs.kind || codeArgs.type || "").toLowerCase() === "source" ||
			(String(codeArgs.target || "").toLowerCase() === "frontend" && !codeArgs.block && !codeArgs.blockName));
		if (sourceCodeRequest && (name === "code-set" || name === "code-patch" || name === "code-check")) {
			return compactFrontendWriteToolValue(request, value);
		}
		if (name === "flow-code-set" || name === "flow-code-patch" || name === "flow-code-check" ||
				name === "flow-code-promote" || name === "flow-code-status" || name === "flow-code-discard" ||
				name === "code-set" || name === "code-patch" || name === "code-check" ||
				name === "code-promote" || name === "code-status" || name === "code-discard") {
			return compactFlowCodeWriteToolValue(request, value);
		}
		if (name === "flow-block-code-set" || name === "flow-block-code-patch") {
			return compactFlowCodeWriteToolValue(request, value);
		}
		if (name === "flow-run" || name === "flow-test" || name === "flow-block-test" || name === "flow-code-run" || name === "code-run") {
			return compactRuntimeToolValue(request, value);
		}
		if (name === "flow-analyze" || name === "flow-code-analyze" || name === "code-analyze") {
			return compactAnalyzeToolValue(request, value);
		}
		if (name === "flow-requestable-schema") {
			return compactRequestableSchemaToolValue(request, value);
		}
		if (name === "frontend-svelte-code-check" || name === "frontend-svelte-code-set" ||
				name === "frontend-svelte-code-patch" || name === "frontend-svelte-fullsync-schema" ||
				name === "frontend-svelte-mutate" ||
				(name === "authoring-mutate" && String(toolArguments(request).surface || "") === "frontend")) {
			return compactFrontendWriteToolValue(request, value);
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
		requestValue: requestValue,
		toolArguments: toolArguments,
		prepareToolArguments: prepareToolArguments,
		_frontendPublicBaseUrl: frontendPublicBaseUrl,
		qualifyAuthoringPath: qualifyAuthoringPath,
		qualifyAuthoringResult: qualifyAuthoringResult,
		phaseBudget: phaseBudget,
		withNamedFlowSource: withNamedFlowSource,
		searchWorkspace: searchWorkspace,
		registerFlowDbo: registerFlowDbo,
		syncFlowInputsDbo: syncFlowInputsDbo,
		_markFastSavedClean: markFastSavedClean,
		applyNamedFlowMutation: applyNamedFlowMutation,
		applyNodeMutation: applyNodeMutation,
		toolResponse: toolResponse,
		toolError: toolError,
		toolResult: toolResult,
		persistSourceMutationResult: persistSourceMutationResult,
		isFrontendSourceCreation: isFrontendSourceCreation,
		createFrontendSource: createFrontendSource,
		_enrichSveltePaletteMutations: enrichSveltePaletteMutationsForArgs,
		studioRefreshFlowEngine: studioRefreshFlowEngine,
		finalizeResponse: finalizeResponse,
		sanitizeForMcp: sanitizeForMcp,
		traceJsonl: traceJsonl,
		runToolBlock: runToolBlock,
		notification: notification,
		_normalizeConvertigoYamlObjectHeaders: normalizeConvertigoYamlObjectHeaders,
		_normalizeConvertigoFlowProjectVersion: normalizeConvertigoFlowProjectVersion
	};
}())
