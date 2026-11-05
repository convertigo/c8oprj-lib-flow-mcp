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

	function toolPathContext(request, ctx) {
		var args = toolArguments(request);
		var parent = splitAuthoringParentPath(args.parentPath);
		var target = { projectDir: args.projectDir, project: args.project || parent && parent.project };
		try {
			resolveProjectDir(target);
		} catch (_unresolvedProject) {
			// An invalid target must not prevent reporting the original tool error.
		}
		// Response paths belong to the requested project, even when it is inside the MCP host.
		return target.projectDir ? { scopes: { request: target } } : ctx;
	}

	function shortenKnownSuffix(path) {
		var markers = ["/_flow/", "/_c8oProject/"];
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

	// A property named password, token... in a block or schema contract (a "properties" map) is a descriptor, not a
	// secret: flow-block-get must show how to pass it (email.send password). Its sample values stay hidden unless they
	// are a symbol reference.
	var DESCRIPTOR_VALUE_KEYS = { "default": true, value: true, example: true, examples: true, "const": true };

	function isPropertyDescriptor(value) {
		return !!value && typeof value === "object" && Object.prototype.toString.call(value) === "[object Object]" &&
			["kind", "type", "label"].some(function (name) { return typeof value[name] === "string"; });
	}

	function sanitizeSensitiveDescriptor(value, ctx) {
		var out = {};
		Object.keys(value).forEach(function (childKey) {
			var child = value[childKey];
			if (DESCRIPTOR_VALUE_KEYS[childKey] === true) {
				out[childKey] = child === undefined || child === null || child === "" ||
					typeof child === "string" && /^\$\{[^}]*\}$/.test(child.trim()) ? child : "[redacted]";
				return;
			}
			var clean = sanitizeForMcp(child, ctx, childKey, "descriptor");
			if (clean !== undefined) {
				out[childKey] = clean;
			}
		});
		return out;
	}

	function sanitizeForMcp(value, ctx, key, parentKey) {
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
			return parentKey === "properties" && isPropertyDescriptor(value) ? sanitizeSensitiveDescriptor(value, ctx) : "[redacted]";
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
				var clean = sanitizeForMcp(item, ctx, key, parentKey);
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
			var clean = sanitizeForMcp(value[childKey], ctx, childKey, key);
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

	// The diagnostics of a refusal in the text of the result: a client that shows the text alone (structuredContent
	// ignored) read "FlowScript validation failed." and nothing it could fix. Line, code, construction and fix of the
	// first diagnostics; the hint of the error when it has none.
	function errorDiagnosticLines(error) {
		var details = error && error.details;
		var diagnostics = error && Array.isArray(error.diagnostics) ? error.diagnostics
			: Array.isArray(details) ? details : details && Array.isArray(details.diagnostics) ? details.diagnostics : [];
		var errors = diagnostics.filter(function (diagnostic) { return diagnostic && diagnostic.severity !== "warning"; });
		var lines = errors.slice(0, 5).map(function (diagnostic) {
			var where = [diagnostic.line ? "line " + diagnostic.line : "", diagnostic.block ? diagnostic.block + (diagnostic.property ? "." + diagnostic.property : "") : ""]
				.filter(function (part) { return part; }).join(", ");
			var text = "\n- " + (where ? where + ": " : "") + (diagnostic.code ? diagnostic.code + ": " : "") + String(diagnostic.message || "");
			if (diagnostic.expression && String(diagnostic.message || "").indexOf(String(diagnostic.expression)) === -1) {
				text += " (" + String(diagnostic.expression).substring(0, 200) + ")";
			}
			return text + (diagnostic.hint ? "\n  Fix: " + String(diagnostic.hint) : "");
		});
		if (errors.length > lines.length) {
			lines.push("\n- " + (errors.length - lines.length) + " more in structuredContent.error.diagnostics.");
		}
		if (!lines.length && error && error.hint) {
			return " Fix: " + String(error.hint);
		}
		return lines.join("");
	}

	// A refused code-set or code-patch of a Flow keeps the refused source as its working copy (code-check reports its
	// diagnostics): its revision changed. The text says so with the revision, as an agent reading the text alone
	// retried on the former revision and got FLOW_CODE_DRAFT_REVISION_MISMATCH.
	function keptWorkingCopyLine(value) {
		if (value.ok !== false || value.written !== true || !value.revision || value.dry === true) return "";
		return "\nThe refused source is kept as the working copy, revision " + String(value.revision) +
			": patch it with code-patch on this revision, or replace it with code-set on this revision (code-discard returns to the saved Flow).";
	}

	// The calls written as JavaScript that code-set mapped onto the catalog (autoCorrected) or proposes to map
	// (proposedPatch), in the text too: a client that shows the text alone gets each edit with its line and confidence.
	function intuitiveCallLines(value) {
		function shown(edit) {
			var before = String(edit.oldText || "").trim(), after = String(edit.newText || "").trim();
			return "line " + edit.line + (edit.confidence === undefined ? "" : " (" + edit.confidence + ")") + ": " + (before.length > 90 ? before.substring(0, 90) + "…" : before) +
				" -> " + (after.length > 110 ? after.substring(0, 110) + "…" : after);
		}
		var lines = "";
		var applied = value.autoCorrected && value.autoCorrected.edits || [];
		if (applied.length) {
			lines += "\nAuto-corrected " + applied.length + " call" + (applied.length > 1 ? "s" : "") + " (confidence >= " + value.autoCorrected.threshold + "), written in code:" +
				applied.slice(0, 12).map(function (edit) { return "\n- " + shown(edit); }).join("") +
				(applied.length > 12 ? "\n- " + (applied.length - 12) + " more in structuredContent.autoCorrected." : "");
		}
		var patch = value.proposedPatch || value.error && value.error.details && value.error.details.proposedPatch;
		if (patch && patch.edits && patch.edits.length) {
			lines += "\nProposed patch" + (patch.revision ? " on revision " + patch.revision : "") + " (" + (value.proposedPatch ? "structuredContent.proposedPatch.edits" : "structuredContent.error.details.proposedPatch.edits") + (patch.requiresChoice ? ", choose the marked value before applying" : patch.base === "submitted" ? ", apply to submitted text before code-set" : ", ready for code-patch edits") + "):" +
				patch.edits.slice(0, 12).map(function (edit) { return "\n- " + shown(edit) + (edit.confidence < patch.threshold ? " — " + String(edit.reason || "") : ""); }).join("") +
				(patch.edits.length > 12 ? "\n- " + (patch.edits.length - 12) + " more in structuredContent.proposedPatch.edits." : "");
		}
		if (patch && patch.unresolved && patch.unresolved.length) {
			lines += "\nNo mapping:" + patch.unresolved.slice(0, 5).map(function (entry) { return "\n- line " + entry.line + ": " + entry.reason; }).join("");
		}
		if (patch && patch.next) {
			lines += "\n" + patch.next;
		}
		return lines;
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
			return "Error [" + String(value.error.code || "FLOW_MCP_TOOL_ERROR") + "]: " + String(value.error.message || value.error).replace(/\.$/, "") + "." +
				errorDiagnosticLines(value.error) + keptWorkingCopyLine(value) + intuitiveCallLines(value) + " See structuredContent.error.";
		}
		var parts = [];
		if (value.ok === true) {
			parts.push("OK");
		}
		if (value.name) {
			parts.push(String(value.name));
		}
		if (value.query && typeof value.query !== "object") {
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
		if (value.registration && value.registration.sessionNote) {
			parts.push(String(value.registration.sessionNote).replace(/\.$/, ""));
		}
		if (value.registration && value.registration.accessibilityNote) {
			parts.push(String(value.registration.accessibilityNote).replace(/\.$/, ""));
		}
		parts.push(value.hints ? "Use structuredContent for data; pass hints=false after reading hints." : "Use structuredContent for data.");
		return parts.join(". ") + intuitiveCallLines(value);
	}

	// value: sanitized already (toolResult), the structuredContent the text summarizes.
	function textContent(value) {
		var notices = [];
		["operatorNote", "argumentWarning"].forEach(function (key) {
			if (value && value[key]) {
				var text = String(value[key]);
				notices.push(key + ": " + (text.length > 2000 ? text.substring(0, 2000) + "… (see structuredContent)" : text));
			}
		});
		return [{
			type: "text",
			text: (notices.length ? notices.join("\n") + "\n" : "") + textSummary(value)
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

	/**
	 * Hands a Project Explorer reload to the queue of the tree refreshes of the project, in a Studio that has it
	 * (ProjectTreeObject.reloadWrittenObject): the projections the reload compares are made off the UI thread (on a
	 * large project, the whole tree of its Flow engine), the writes received meanwhile are merged into one pass, and
	 * the UI thread only updates its tree, inside reloadNotingProjectFlag (the flag lock taken briefly before and after
	 * the reload, never during it). written: the project when objects were added (its whole tree), one of its Flows, or
	 * null for sources only; engineSources: the kind of the sources written or removed that the tree of the Flow engine
	 * shows ("frontend", "catalog", "runtime", which picks the caches invalidated), "" for none; refreshResources: the
	 * files written become Eclipse resources first, off the UI thread. Called on the UI thread (the explorer model).
	 * @return false in an older Studio, or for an object the queue does not reload: the caller reloads it itself
	 */
	function queueStudioReload(view, project, written, engineSources, refreshResources) {
		var projectTreeObject = null;
		try {
			projectTreeObject = view.getProjectRootObject(String(project.getName()));
		} catch (_noProjectTree) {
			return false;
		}
		if (projectTreeObject == null || typeof projectTreeObject.reloadWrittenObject !== "function") {
			return false;
		}
		var aroundReload = new Packages.java.util.function.Consumer({ accept: function (reload) {
			reloadNotingProjectFlag(project, function () {
				reload.run();
			});
		}});
		return projectTreeObject.reloadWrittenObject(written == null ? null : written, String(engineSources || ""),
			refreshResources === true, aroundReload) === true;
	}

	/**
	 * The UI part of studioRefreshQName: queued (see queueStudioReload), or, in an older Studio, the object reloaded
	 * here, its projections made on the UI thread.
	 * @return "queued" or "reloaded"
	 */
	function studioReloadObject(view, target) {
		var project = target.getProject();
		if (queueStudioReload(view, project, target, "", false)) {
			return "queued";
		}
		reloadNotingProjectFlag(project, function () {
			view.reloadDatabaseObject(target);
			var treeObject = view.findTreeObjectByUserObject(target);
			if (treeObject != null) {
				view.refreshTreeObject(treeObject);
			}
		});
		return "reloaded";
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
					studioReloadObject(view, target);
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

	/**
	 * The UI part of studioRefreshFlowEngine: queued (see queueStudioReload), the resources refreshed and the tree of
	 * the Flow engine projected off the UI thread; in an older Studio, everything here, on the UI thread. A frontend
	 * write invalidates the caches of the project frontend in the queue (the notification of each source invalidates
	 * by its kind); a removal (any other reason) the data caches of every project, as here.
	 * @return "queued", "reloaded" or "skipped" (no Project Explorer)
	 */
	function studioReloadFrontend(plugin, project, reason) {
		var ConvertigoPlugin = Packages.com.twinsoft.convertigo.eclipse.ConvertigoPlugin;
		var queueView = plugin.getProjectExplorerView();
		var engineSources = String(reason || "") === "frontend-source-mutation" ? "frontend" : "catalog";
		if (queueView != null && queueStudioReload(queueView, project, null, engineSources, true)) {
			return "queued";
		}
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
			return "skipped";
		}
		var flowEngine = project.getFlowEngine();
		var treeObject = flowEngine == null ? null : view.findTreeObjectByUserObject(flowEngine);
		reloadNotingProjectFlag(project, function () {
			if (treeObject != null) {
				view.reloadTreeObject(treeObject);
				view.refreshTreeObject(treeObject);
			} else {
				view.refreshTree();
			}
		});
		return "reloaded";
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
					studioReloadFrontend(plugin, project, reason);
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

	var localSharedMaps = {};

	// The Flow runtimes of a server are separate scopes: maps shared by all of them live in the servlet context.
	function sharedMap(attribute) {
		var servletContext = Packages.com.twinsoft.convertigo.engine.Engine.getServletContext();
		if (servletContext == null) {
			return localSharedMaps[attribute] || (localSharedMaps[attribute] = new Packages.java.util.concurrent.ConcurrentHashMap());
		}
		var map = servletContext.getAttribute(attribute);
		if (map == null) {
			new Packages.org.mozilla.javascript.Synchronizer(function () {
				if (servletContext.getAttribute(attribute) == null) {
					servletContext.setAttribute(attribute, new Packages.java.util.concurrent.ConcurrentHashMap());
				}
			}, servletContext)();
			map = servletContext.getAttribute(attribute);
		}
		return map;
	}

	function projectFlagLock(project) {
		var locks = sharedMap("lib_flow_mcp.projectFlagLocks");
		var key = String(project.getName());
		locks.putIfAbsent(key, new Packages.java.util.concurrent.locks.ReentrantLock());
		return locks.get(key);
	}

	function studioReloadFlags() {
		return sharedMap("lib_flow_mcp.studioReloadProjectFlags");
	}

	/**
	 * Serializes the MCP writes of the change flag of a project. A Flow registration lowers the flag that
	 * project.add() raised back to the value it read first: a flag raised or lowered by another call in the
	 * meantime would be lost. Returns the function that releases the lock (a no-op when it was not acquired).
	 */
	function lockProjectFlags(project, status) {
		var lock = null;
		// a Studio reload running meanwhile does not take this write for its own mark, lock acquired or not
		projectFlagWrites(project);
		try {
			lock = projectFlagLock(project);
			if (!lock.tryLock(30, Packages.java.util.concurrent.TimeUnit.SECONDS)) {
				lock = null;
				if (status) {
					status.error = "timeout";
				}
			}
		} catch (noLock) {
			lock = null;
			if (status) {
				status.error = String(noLock && noLock.message || noLock);
			}
		}
		if (status) {
			status.acquired = lock != null;
		}
		var ended = false;
		return function () {
			if (!ended) {
				ended = true;
				projectFlagWrites(project);
			}
			if (lock != null) {
				lock.unlock();
				lock = null;
			}
		};
	}

	/**
	 * Counts the writes of the change flag of a project (one at the start of a write, one at its end) and returns the
	 * count: a reload that sees the same count before and after it ran alone.
	 */
	function projectFlagWrites(project, read) {
		var counters = sharedMap("lib_flow_mcp.projectFlagWrites");
		var key = String(project.getName());
		counters.putIfAbsent(key, new Packages.java.util.concurrent.atomic.AtomicLong());
		var counter = counters.get(key);
		return Number(read === true ? counter.get() : counter.incrementAndGet());
	}

	/** Runs fn under the flag lock if it is free within 2 s; returns whether it ran. */
	function brieflyWithProjectFlagLock(project, fn) {
		var lock = null;
		try {
			lock = projectFlagLock(project);
			if (!lock.tryLock(2, Packages.java.util.concurrent.TimeUnit.SECONDS)) {
				return false;
			}
		} catch (_noLock) {
			return false;
		}
		try {
			fn();
			return true;
		} finally {
			lock.unlock();
		}
	}

	/**
	 * Runs a Project Explorer reload (UI thread) and notes when it is the reload that marked the project as
	 * changed: the Studio marks the project of any changed child, such as a Flow engine holding the draft of
	 * another Flow, and only a Save lowers it. The note carries Project.getLastChange(), so that any later
	 * change of the project invalidates it.
	 * The flag lock is taken before and after the reload, never during it: a reload can wait minutes on the UI thread
	 * (for the frontend authoring lock, for a dialog), and a lock held meanwhile made every Flow registration wait 30 s
	 * and then write its flags without it. A flag write that ran during the reload (another count) leaves the mark,
	 * as does a lock busy for more than 2 s.
	 */
	function reloadNotingProjectFlag(project, reload) {
		var before = null;
		brieflyWithProjectFlagLock(project, function () {
			// the reload also moves lastChange when the project is already marked: a reload-only mark is followed
			before = {
				writes: projectFlagWrites(project, true),
				reloadOnly: project.hasChanged !== true || studioReloadNoted(project, Number(project.getLastChange()))
			};
		});
		reload();
		if (before == null || before.reloadOnly !== true) {
			return;
		}
		brieflyWithProjectFlagLock(project, function () {
			if (project.hasChanged === true && projectFlagWrites(project, true) === before.writes) {
				studioReloadFlags().put(String(project.getName()), Packages.java.lang.Long.valueOf(project.getLastChange()));
			}
		});
	}

	/** Whether the noted reload mark is still the last change of the project (lastChange read before ours). */
	function studioReloadNoted(project, lastChange) {
		try {
			var noted = studioReloadFlags().get(String(project.getName()));
			return noted != null && Number(noted) === Number(lastChange);
		} catch (_noNote) {
			return false;
		}
	}

	/** Unsaved work of the project besides its own flag: Flow or engine drafts, changed or new objects. */
	function projectHoldsUnsavedWork(project) {
		var projectQName = String(project.getQName());
		return pendingStudioDrafts(project, "").length > 0 || unsavedProjectChanges(project, "").some(function (qname) {
			return qname !== projectQName;
		});
	}

	function withProjectFlagLock(project, fn) {
		var unlock = lockProjectFlags(project);
		try {
			return fn();
		} finally {
			unlock();
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
		result.projectFlagLock = {};
		var unlockProjectFlags = lockProjectFlags(project, result.projectFlagLock);
		try {
			var projectWasChanged = false;
			var projectLastChange = -1;
			try {
				projectWasChanged = project.hasChanged === true;
				projectLastChange = Number(project.getLastChange());
			} catch (_ignoreProjectChanged) {
			}
			var includeTrace=args.includeTrace;
			if(includeTrace!==undefined&&typeof includeTrace!=="boolean"){
				var error=new Error("includeTrace takes true or false, not "+JSON.stringify(includeTrace)+".");
				error.code="NATIVE_PROPERTY_VALUE_INVALID";
				throw error;
			}
			var name = String(args.name || "");
			var saveProject = assertProjectSaveAllowed(args, name);
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
				assertFlowNameFree(args, name);
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
			if (writeResult && writeResult.flowMetadata && typeof writeResult.flowMetadata.authenticatedContextRequired === "boolean") flow.setAuthenticatedContextRequired(writeResult.flowMetadata.authenticatedContextRequired);
			result.flagsBeforeFastSaveClean = flowDboFlags(project, flow);
			result.registered = true;
			result.qname = String(flow.getQName());
			try {
				flow.hasChanged = true;
				project.hasChanged = true;
			} catch (_ignoreDirtyFlags) {
			}
			if (saveProject) {
				result.saveMode = "project";
				Engine.theApp.databaseObjectsManager.exportProject(project);
				result.saved = true;
				result.projectSaved = true;
			} else {
				result.saved = true;
				result.flowDeclarationSaved = saveFlowDeclaration(project, flow, name, args, writeResult);
				// A mark only left by a Studio reload goes once nothing is unsaved; while drafts remain, the note
				// follows the lastChange our own add() moved.
				var reloadNoted = projectWasChanged && studioReloadNoted(project, projectLastChange);
				if (reloadNoted && !projectHoldsUnsavedWork(project)) {
					projectWasChanged = false;
					studioReloadFlags().remove(String(project.getName()));
				}
				markFastSavedClean(project, flow, projectWasChanged, flowWasChanged);
				if (reloadNoted && projectWasChanged) {
					studioReloadFlags().put(String(project.getName()), Packages.java.lang.Long.valueOf(project.getLastChange()));
				}
			}
		} finally {
			unlockProjectFlags();
		}
		result.flagsAfterFastSaveClean = flowDboFlags(project, flow);
		sessionReport(project, result);
		accessibilityReport(Engine, writeResult, result);
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

	// A promotion saves sources and the project declaration and leaves the HTTP sessions alone: the project reloaded
	// keeps the authenticated user of each session (SessionAttribute.authenticatedUser, in the HTTP session). What a
	// client logged in before loses after a pause is its session, closed after httpSessionTimeout idle seconds: 60 in
	// the projects the bootstrap created before 1800 became its default, which looked like each promotion logging
	// the client out. The answer says so.
	function sessionReport(project, result) {
		result.sessionsReset = false;
		try {
			var timeout = Number(project.getHttpSessionTimeout());
			if (!isFinite(timeout)) return;
			result.httpSessionTimeout = timeout;
			if (timeout > 0 && timeout < 300) {
				result.sessionNote = "Project " + String(project.getName()) + " closes an HTTP session idle for " + timeout +
					" s (httpSessionTimeout): a client that logged in before a pause must log in again, promotion or not. " +
					"For API clients and long tests, set the project property HTTP session timeout to 1800 (the Convertigo default).";
			}
		} catch (_ignoreSessionTimeout) {
		}
	}

	// The Studio runs every requestable over HTTP, a private one included (Studio mode, for the tests of the developer),
	// where a server refuses a private requestable to anyone but an administrator: an anonymous HTTP call to a private
	// Flow answers in the Studio, which an agent read as a security defect of the Flow. The promotion of a private Flow
	// in the Studio says so.
	function accessibilityReport(Engine, writeResult, result) {
		try {
			if (Engine.isStudioMode() !== true || !declaresPrivateAccessibility(writeResult)) return;
			result.accessibilityNote = STUDIO_PRIVATE_NOTE;
		} catch (_ignoreAccessibility) {
		}
	}

	var STUDIO_PRIVATE_NOTE = "Private Flow: refused over HTTP to anyone but an administrator, as on a server; an older Studio still ran " +
		"it over HTTP for an anonymous call (Studio mode), so prove the refusal with a session that is not an administrator.";

	// @return whether the saved source declares _flow.accessibility private (its header, before the function)
	function declaresPrivateAccessibility(writeResult) {
		var code = writeResult && (writeResult.code !== undefined && writeResult.code !== null ? writeResult.code : writeResult.source);
		if (code === undefined || code === null) return false;
		var text = String(code);
		var body = text.search(/(^|\n)\s*(?:async\s+)?(?:function|flow)\s+[A-Za-z_$]/);
		var header = body < 0 ? text : text.substring(0, body);
		return /(^|[\s{,])["']?accessibility["']?\s*:\s*["']private["']/i.test(header);
	}

	function saveFlowDeclaration(project, flow, name, args, writeResult) {
		args = args || {};
		var projectDir = new File(String(project.getDirPath()));
		var projectFile = new File(projectDir, "c8oProject.yaml");
		var Yaml = Packages.com.twinsoft.convertigo.engine.util.YamlConverter;
		if (projectFile.isFile() && String(Yaml.getFormat(projectFile)) === "STANDARD") {
			return saveStandardFlowDeclaration(projectFile, flow, name, args, writeResult);
		}
		var sequencesDir = new File(new File(projectDir, "_c8oProject"), "sequences");
		var sequenceFile = new File(sequencesDir, String(name) + ".yaml");
		var changed = false;
		if (!sequenceFile.isFile()) {
			writeUtf8(sequenceFile, "includeTrace: " + (boolArg(args.includeTrace, false) ? "true" : "false") + "\n");
			changed = true;
		}
		var nativeContent = readUtf8(sequenceFile), nativeNext = nativeContent.replace(/^authenticatedContextRequired:.*\n/gm, "");
		if (flow.getAuthenticatedContextRequired()) nativeNext = "authenticatedContextRequired: true\n" + nativeNext;
		if (nativeNext !== nativeContent) { writeUtf8(sequenceFile, nativeNext); changed = true; }
		if (syncFlowInputDeclarationYaml(sequenceFile, name, writeResult, flow)) {
			changed = true;
		}
		return ensureProjectFlowDeclaration(projectDir, name) || changed;
	}

	// Patch the saved DOM, not the live project: unrelated Studio drafts must remain unsaved.
	// The engine codec owns quoting, multiline values, include paths and incremental writes.
	function saveStandardFlowDeclaration(projectFile, flow, name, args, writeResult) {
		var Yaml = Packages.com.twinsoft.convertigo.engine.util.YamlConverter;
		var document = Yaml.readYaml(projectFile);
		function children(parent) {
			var out = [], nodes = parent.getChildNodes();
			for (var i = 0; i < nodes.getLength(); i++) {
				var child = nodes.item(i);
				if (child.getNodeType() === 1) out.push(child);
			}
			return out;
		}
		function scalar(parent, key, value) {
			children(parent).filter(function (child) { return String(child.getTagName()) === key; })
				.forEach(function (child) { parent.removeChild(child); });
			if (value !== undefined) {
				var child = document.createElement(key);
				child.setTextContent(value === null ? "" : String(value));
				parent.appendChild(child);
			}
		}
		var project = children(document.getDocumentElement()).filter(function (child) {
			return String(child.getAttribute("yaml_key")).indexOf(" [core.Project]") >= 0;
		})[0];
		if (!project) throw new Error("Missing project declaration");
		var identity = String(name) + " [flow.Flow]";
		var bean = children(project).filter(function (child) {
			return String(child.getAttribute("yaml_key")) === identity;
		})[0];
		if (!bean) {
			bean = document.createElement("bean");
			bean.setAttribute("yaml_key", identity);
			bean.setAttribute("yaml_file", "sequences/" + name + ".yaml");
			project.appendChild(bean);
			scalar(bean, "includeTrace", boolArg(args.includeTrace, false));
		}
		scalar(bean, "authenticatedContextRequired", flow.getAuthenticatedContextRequired() ? true : undefined);
		var definitions = writeResult && writeResult.inputDefinitions;
		var keys = definitions && typeof definitions === "object" ? Object.keys(definitions).filter(function (key) {
			return /^[A-Za-z_$][\w$]*$/.test(key) && key.indexOf("__") !== 0;
		}).sort() : [];
		if (keys.length) {
			var ids = {};
			children(bean).forEach(function (child) {
				var match = /^([A-Za-z_$][\w$]*) \[(variables\.Requestable(?:MultiValued)?Variable-\d+)\]$/.exec(String(child.getAttribute("yaml_key")));
				if (match && match[1].indexOf("__") !== 0) {
					ids[match[1]] = match[2];
					bean.removeChild(child);
				}
			});
			keys.forEach(function (key, index) {
				var definition = Object.assign({}, definitions[key] || {});
				var nativeVariable = flow.getVariable(key);
				if (nativeVariable) {
					if (definition.visibility === undefined) definition.visibility = Number(nativeVariable.getVisibility());
					if (definition.isFileUpload === undefined) definition.isFileUpload = Boolean(nativeVariable.getIsFileUpload());
				}
				var cls = flowInputVariableClass(definition);
				var id = ids[key] && ids[key].indexOf(cls + "-") === 0 ? ids[key] : cls + "-" + stableFlowInputPriority(name, key, index);
				renderFlowInputVariableYaml(key, definition, id); // Shared contract validation, before any disk write.
				var variable = document.createElement("bean");
				variable.setAttribute("yaml_key", key + " [" + id + "]");
				scalar(variable, "description", definition.description == null ? "Flow input " + key : definition.description);
				var type = flowInputSchemaType(definition.type || definition.kind || "string");
				if (type !== "xsd:string") scalar(variable, "schemaType", type);
				if (definition.required === true) scalar(variable, "required", true);
				if (definition.visibility !== undefined && Number(definition.visibility) !== 0) scalar(variable, "visibility", definition.visibility);
				if (definition.isFileUpload === true) scalar(variable, "isFileUpload", true);
				scalar(variable, "value", flowInputYamlDefault(definition));
				bean.appendChild(variable);
			});
		}
		Yaml.writeYaml(document, projectFile, new File(projectFile.getParentFile(), "_c8oProject"));
		return true;
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
		markFastSavedClean(project, flow, boolArg(args.cleanProject, false) === true ? false : null);
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
		// The promoted source is written: a Flow engine without drafts has nothing left to save, while the flag
		// its draft raised would mark the project at the next Project Explorer reload of the Studio.
		try {
			var flowEngine = project.getFlowEngine();
			if (flowEngine != null && flowEngine.getSourceDrafts().isEmpty() && flowEngine.isEngineSourceDirty() !== true) {
				flowEngine.hasChanged = false;
			}
		} catch (_ignoreFlowEngineClean) {
		}
		// null leaves the project flag as it is: writing back a value read earlier could lose a concurrent change
		if (projectWasChanged !== null && projectWasChanged !== undefined) {
			try {
				project.hasChanged = projectWasChanged === true;
			} catch (_ignoreProjectClean) {
			}
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

	function syncFlowInputDeclarationYaml(sequenceFile, flowName, writeResult, flow) {
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
		// The declared input contract is authoritative; preserve only reserved native __ variables.
		var filtered = removeFlowInputVariableBlocks(content, Object.keys(ids).filter(function (key) { return key.indexOf("__") !== 0; }));
		if (filtered.length && filtered.charAt(filtered.length - 1) !== "\n") {
			filtered += "\n";
		}
		keys.forEach(function (key, index) {
			var definition = Object.assign({}, inputDefinitions[key] || {});
			// Omitted native flags preserve an existing variable; false/zero is an explicit reset.
			var nativeVariable = flow && typeof flow.getVariable === "function" ? flow.getVariable(key) : null;
			if (nativeVariable) {
				if (definition.visibility === undefined && typeof nativeVariable.getVisibility === "function") definition.visibility = Number(nativeVariable.getVisibility());
				if (definition.isFileUpload === undefined && typeof nativeVariable.getIsFileUpload === "function") definition.isFileUpload = Boolean(nativeVariable.getIsFileUpload());
			}
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
		["required","isFileUpload","multi","multiValued"].forEach(function(key){
			if(definition[key]!==undefined&&typeof definition[key]!=="boolean"){
				var error=new Error("input."+name+"."+key+" takes a normalized boolean before native persistence, not "+JSON.stringify(definition[key])+".");
				error.code="NATIVE_PROPERTY_VALUE_INVALID";throw error;
			}
		});
		if(definition.visibility!==undefined&&(typeof definition.visibility!=="number"||!isFinite(definition.visibility)||Math.floor(definition.visibility)!==definition.visibility||definition.visibility< -1||definition.visibility>15)){
			var error=new Error("input."+name+".visibility takes -1 or an integer bitmask from 0 to 15, not "+JSON.stringify(definition.visibility)+".");error.code="FLOW_INPUT_VISIBILITY_INVALID";throw error;
		}
		if(definition.description!==undefined&&typeof definition.description!=="string"){
			var error=new Error("input."+name+".description takes text, not "+JSON.stringify(definition.description)+".");error.code="FLOW_INPUT_DESCRIPTION_INVALID";throw error;
		}
		var declaredType=definition.type||definition.kind||"string", allowedTypes=["string","integer","number","boolean","array","object","any","unknown","null"];
		(Array.isArray(declaredType)?declaredType:[declaredType]).forEach(function(type){
			if(typeof type!=="string"||allowedTypes.indexOf(type)<0){var error=new Error("input."+name+".type takes one of "+allowedTypes.join(", ")+", not "+JSON.stringify(type)+".");error.code="FLOW_INPUT_SCHEMA_INVALID";throw error;}
		});
		var lines = ["↓" + name + " [" + id + "]: "];
		var description = definition.description !== undefined && definition.description !== null
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
		if (definition.visibility !== undefined && Number(definition.visibility) !== 0) lines.push("  visibility: " + Number(definition.visibility));
		if (definition.isFileUpload === true) lines.push("  isFileUpload: true");
		var value = flowInputYamlDefault(definition);
		if (value !== undefined) {
			lines.push("  value: " + yamlScalar(value));
		}
		return lines.join("\n") + "\n";
	}

	// As Flow.flowInputDefaultValue in Java: a variable keeps scalars, an object default is its JSON text
	// (never "[object Object]"). The rows of a multi-valued default are left to the input sync of the engine.
	function flowInputYamlDefault(definition) {
		var value = definition.default;
		if (value === undefined || value === null || typeof value !== "object") {
			return value;
		}
		return flowInputVariableClass(definition) === "variables.RequestableMultiValuedVariable"
			? undefined
			: JSON.stringify(value);
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
		// As YamlConverter.writeYamlText: Convertigo reads a single-quoted scalar ('' for a quote); a
		// double-quoted one would keep its quotes in the value.
		return "'" + text.replace(/\r/g, "").replace(/'/g, "''") + "'";
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

	// Called before any write: a requested project save is refused while other unsaved
	// Studio work exists, so the MCP change is not applied half-way. Returns whether a
	// project save was requested.
	function assertProjectSaveAllowed(args, flowName) {
		args = args || {};
		var saveProject = boolArg(args.saveProject, false) === true ||
			boolArg(args.exportProject, false) === true ||
			boolArg(args.autoSave, false) === true;
		if (!saveProject || boolArg(args.saveStudioDrafts, false) === true || !args.project || typeof Packages === "undefined") {
			return saveProject;
		}
		var name = String(flowName || args.name || String(args.qname || "").split(".").pop() || "");
		var project = Packages.com.twinsoft.convertigo.engine.Engine.theApp.databaseObjectsManager
			.getOriginalProjectByName(String(args.project), false);
		var pending = project == null ? [] : pendingStudioDrafts(project, name);
		if (pending.length) {
			var error = new Error("Saving project " + args.project + " would also save unsaved Studio work (" +
				pending.slice(0, 10).join(", ") + (pending.length > 10 ? ", ..." : "") + "). Nothing was changed.");
			error.code = "PROJECT_HAS_STUDIO_DRAFTS";
			error.hint = "Resolve the listed drafts before saving the project or adding a reference: code-get each Flow to retain its exact code, " +
				"then code-promote({project,name,revision}) if valid, or code-discard({project,name}) after retaining it. " +
				"If validation needs the missing reference, retain the code, discard that invalid draft, add the reference, then code-set the retained code. " +
				"Save other Studio drafts explicitly. Add all required references before writing new Flows.";
			error.details = {project:String(args.project),pendingDrafts:pending,requiresChoice:true};
			throw error;
		}
		return saveProject;
	}

	// Unsaved Studio work a project export would write along with the MCP change:
	// other Flow working copies, FlowEngine source drafts and the Engine source.
	function pendingStudioDrafts(project, flowName) {
		var pending = [];
		try {
			var sequences = project.getSequencesList().toArray();
			for (var i = 0; i < sequences.length; i++) {
				var sequence = sequences[i];
				if (isFlowDbo(sequence) && String(sequence.getName()) !== String(flowName || "") &&
						sequence.isFlowSourceDirty() === true) {
					pending.push("flow " + String(sequence.getName()));
				}
			}
		} catch (_ignoreFlowDrafts) {
		}
		try {
			var flowEngine = project.getFlowEngine();
			if (flowEngine != null) {
				if (flowEngine.isEngineSourceDirty() === true) {
					pending.push("_flow/engine.yaml");
				}
				var root = new File(String(project.getDirPath()));
				var drafts = flowEngine.getSourceDrafts().keySet().toArray();
				for (var j = 0; j < drafts.length; j++) {
					pending.push(relativeProjectPath(root, new File(String(drafts[j]))));
				}
			}
		} catch (_ignoreSourceDrafts) {
		}
		return pending;
	}

	// Objects edited in the Studio and not saved yet (changed or new), which an export of the project
	// would write too. Flow sources and FlowEngine drafts are reported by pendingStudioDrafts; the
	// object about to be deleted and its children do not count.
	function unsavedProjectChanges(project, exceptQName) {
		var changed = [];
		var FlowEngineClass = null;
		try {
			FlowEngineClass = Packages.java.lang.Class.forName("com.twinsoft.convertigo.beans.flow.FlowEngine");
		} catch (_noFlowEngineClass) {
		}
		function walk(dbo, depth) {
			if (dbo == null || depth > 64 || changed.length >= 20) {
				return;
			}
			var qname = "";
			try {
				qname = String(dbo.getQName());
			} catch (_noQName) {
			}
			if (exceptQName && qname === String(exceptQName)) {
				return;
			}
			if (isFlowDbo(dbo) || (FlowEngineClass != null && FlowEngineClass.isInstance(dbo))) {
				return;
			}
			try {
				// a project only marked by a Studio reload, unchanged since, holds no work of its own
				if ((dbo.hasChanged === true || dbo.bNew === true) &&
						!(depth === 0 && dbo.bNew !== true && studioReloadNoted(dbo, Number(dbo.getLastChange())))) {
					changed.push(qname);
				}
			} catch (_noFlags) {
			}
			var children = [];
			try {
				children = dbo.getAllChildren().toArray();
			} catch (_noChildren) {
			}
			for (var i = 0; i < children.length; i++) {
				walk(children[i], depth + 1);
			}
		}
		walk(project, 0);
		return changed;
	}

	function assertNoUnsavedProjectChanges(project, projectName, exceptQName) {
		var changed = unsavedProjectChanges(project, exceptQName);
		if (changed.length) {
			var error = new Error("Saving project " + projectName + " would also save unsaved Studio changes (" +
				changed.slice(0, 10).join(", ") + (changed.length > 10 ? ", ..." : "") + "). Nothing was changed.");
			error.code = "PROJECT_HAS_UNSAVED_CHANGES";
			error.hint = "Let the user save the project in the Studio, or pass saveProject:false to leave the change for the next Save of the project.";
			throw error;
		}
	}

	// A Flow cannot take the name of a sequence the project file still declares: its deletion is not
	// saved yet, and declaring both would bring the sequence back, and rename the Flow, at the next load.
	function assertFlowNameFree(args, flowName) {
		args = args || {};
		var name = String(flowName || args.name || String(args.qname || args.flowQName || "").split(".").pop() || "");
		if (!args.project || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || typeof Packages === "undefined") {
			return;
		}
		var project = Packages.com.twinsoft.convertigo.engine.Engine.theApp.databaseObjectsManager
			.getOriginalProjectByName(String(args.project), false);
		if (project == null || projectSequenceByName(project, name) != null) {
			return;
		}
		var projectFile = new File(String(project.getDirPath()), "c8oProject.yaml");
		if (!projectFile.isFile()) {
			return;
		}
		var declared = new RegExp("^  \u2193" + name + " \\[(sequences\\.[A-Za-z0-9_.]+)\\]\\s*:", "m").exec(readUtf8(projectFile));
		var Yaml = Packages.com.twinsoft.convertigo.engine.util.YamlConverter;
		if (String(Yaml.getFormat(projectFile)) === "STANDARD") {
			declared = null;
			var beans = Yaml.readYaml(projectFile, true).getElementsByTagName("bean");
			for (var i = 0; i < beans.getLength(); i++) {
				var identity = String(beans.item(i).getAttribute("yaml_key"));
				if (identity.indexOf(name + " [sequences.") === 0) {
					declared = [identity, identity.substring(name.length + 2, identity.length - 1)];
					break;
				}
			}
		}
		if (declared) {
			var error = new Error(args.project + "." + name + " is still saved as a " + declared[1].substring("sequences.".length) +
				" in c8oProject.yaml: its deletion is not saved. Nothing was changed.");
			error.code = "FLOW_NAME_DELETION_UNSAVED";
			error.hint = "Ask the user to save the project in the Studio, then create the Flow. Delete with flow-object-remove without saveProject:false, so that the deletion is saved at once.";
			throw error;
		}
	}

	function loadedProjectTargets() {
		var targets = [];
		if (typeof Packages === "undefined") {
			return targets;
		}
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		var dbom;
		var names;
		try {
			dbom = Engine.theApp.databaseObjectsManager;
			names = Engine.isStudioMode()
				? dbom.getStudioProjects().getProjects(true).keySet()
				: dbom.getAllProjectNamesList(false);
		} catch (e) {
			// no running Convertigo engine (standalone tests): no workspace project
			return targets;
		}
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
		// tools/list exposes trusted public descriptors, not runtime values. Their JSON Schemas
		// must retain field names such as maxTokens, inputTokens and password. Keep the runtime
		// scrubber everywhere else, including objects named inputSchema in tools/call results.
		var tools = request && request.method === "tools/list" && response && response.result && response.result.tools;
		var schemas = tools && typeof tools.length === "number" ? tools.map(function (tool) {
			return { inputSchema: tool.inputSchema, outputSchema: tool.outputSchema };
		}) : null;
		response = sanitizeForMcp(response, toolPathContext(request, ctx));
		if (schemas && response.result && response.result.tools) {
			response.result.tools.forEach(function (tool, index) {
				if (schemas[index].inputSchema !== undefined) tool.inputSchema = schemas[index].inputSchema;
				if (schemas[index].outputSchema !== undefined) tool.outputSchema = schemas[index].outputSchema;
			});
		}
		if (request && request.method === "tools/call" && response && response.result) {
			var structured = response.result.structuredContent;
			if (toolName(request) === "flow-resource-get" && structured && !structured.error && structured.ok !== false) {
				// One document per response. Keep old callers explicit about the renamed field;
				// readable calls opt out of structuredContent (some clients prefer it over content).
				// tools/list deliberately omits outputSchema for this mixed-format tool.
				var resourceText = typeof structured.text === "string" ? structured.text : structured.content;
				if (typeof resourceText === "string") {
					if (toolArguments(request).format === "text") {
						var metadata = {};
						Object.keys(structured).forEach(function (key) {
							if (key !== "text" && key !== "content") metadata[key] = structured[key];
						});
						// Guides are complete documents. Project previews also need their hash,
						// truncation flag and notices, separate from the source text.
						var prefix = structured.source === "resources/read" ? "" : "Resource metadata: " + JSON.stringify(metadata) + "\n\n";
						response.result.content = [{ type: "text", text: prefix + resourceText }];
						delete response.result.structuredContent;
					} else {
						structured.text = resourceText;
						structured.content = "Resource text is in text (structuredContent.text in the MCP envelope). Use that field from this response; do not fetch again.";
					}
				}
			}
			if (structured && (structured.error || structured.ok === false)) response.result.isError = true;
		}
		traceJsonl(ctx, "response", request || {}, response);
		return response;
	}

	function toolResult(value, ctx) {
		if (value && value.error) {
			var copy = {};
			Object.keys(value).forEach(function (key) { copy[key] = value[key]; });
			copy.error = normalizeToolError(value.error);
			value = copy;
		}
		value = sanitizeForMcp(value, ctx);
		var result = { content: textContent(value), structuredContent: value };
		if (value && (value.error || value.ok === false)) result.isError = true;
		return result;
	}

	function toolResponse(request, value, ctx) {
		request = request || {};
		var original=toolArguments(request);
		var authoringWarning = authoringArgumentWarning(request);
		if (value && authoringWarning) value.argumentWarning = [value.argumentWarning, authoringWarning].filter(function(text) { return !!text; }).join("\n");
		var ignored = ignoredToolArguments(request);
		if (value && !value.error && ignored.length) {
			var warning = "Ignored arguments " + ignored.join(", ") + ": " + toolName(request) +
				" uses the current working copy. Save source with code-set or code-patch first.";
			value.argumentWarning = value.argumentWarning ? value.argumentWarning + "\n" + warning : warning;
		}
		if(value && !value.error && original.includeTrace!==undefined && typeof original.includeTrace!=="boolean") {
			var checked=ctx.nativePropertyContract().scalar(original.includeTrace,{type:"boolean"},"includeTrace");
			value.normalizations=(value.normalizations||[]).concat(checked.normalizations);
		}
		value = enrichSveltePaletteMutations(request, value);
		var notices = {};
		["normalizations", "argumentWarning", "operatorNote"].forEach(function (key) {
			if (value && value[key] !== undefined && value[key] !== null && value[key].length) notices[key] = value[key];
		});
		value = compactToolValue(request, value);
		if (value && typeof value === "object") {
			Object.keys(notices).forEach(function (key) { value[key] = notices[key]; });
		}
		return finalizeResponse(ctx, request, jsonRpcResult(request.id, toolResult(value, toolPathContext(request, ctx))));
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

	function cleanInsertValue(insert) {
		var value = {};
		Object.keys(insert || {}).forEach(function (key) {
			if (key.indexOf("__") !== 0) {
				value[key] = insert[key];
			}
		});
		return value;
	}

	// Each palette item gets the authoring-mutate call the Studio would make for it:
	// creation recipes and virtual prototypes as an engine action (sourceChanges),
	// engine config items as an engine mutation, source items as a frontAst mutation
	// at the requested position.
	function enrichSveltePaletteMutationsForArgs(args, value) {
		if (!value || typeof value !== "object" || !Array.isArray(value.items)) {
			return value;
		}
		args = args || {};
		var focus = value.focus || {};
		var focusPath = String(focus.path !== undefined ? focus.path : args.focusPath || "");
		// The project may only be carried by the qualified parentPath (Project::path).
		var parent = splitAuthoringParentPath(args.parentPath);
		var project = String(args.project || parent && parent.project || "");
		if (!args.project && project) {
			args = Object.assign({}, args, { project: project });
		}
		value.items.forEach(function (item) {
			if (!item || typeof item !== "object" || item.apply) {
				return;
			}
			var slot = item.targetSlot || {};
			if (item.authoringAction) {
				var action = {
					id: String(item.authoringAction.id || item.id || ""),
					surface: String(item.authoringAction.surface || args.surface || "frontend"),
					targetPath: focusPath,
					position: String(args.position || "inside")
				};
				if (item.authoringAction.builder || args.builder) {
					action.builder = String(item.authoringAction.builder || args.builder);
				}
				if (slot.id) {
					action.targetSlotId = String(slot.id);
				}
				item.apply = {
					tool: "authoring-mutate",
					arguments: { project: project, surface: action.surface, builder: action.builder || "", action: action }
				};
				// The engine resolves the action target in a tree built without the Catalog
				// unless asked: a Catalog creation carries the option its palette used.
				if (focusPath === "catalog" || focusPath.indexOf(".catalog") >= 0) {
					item.apply.arguments.includeFrontendCatalog = true;
				}
				return;
			}
			if (!item.insert || item.mutation) {
				return;
			}
			var insert = item.insert;
			if (insert.__engineMutationPath) {
				item.mutation = { value: insert };
				item.apply = {
					tool: "authoring-mutate",
					arguments: {
						project: project,
						parentPath: qualifyAuthoringPath(args, focusPath),
						surface: String(args.surface || "frontend"),
						builder: String(args.builder || "svelte"),
						mutation: item.mutation
					}
				};
				return;
			}
			var path = String(insert.__frontendMutationPath || slot.sourceMutationPath || focus.insertMutationPath || focus.sourceMutationPath || "");
			var sourceFile = String(insert.__frontendSourcePath || slot.sourcePath || focus.insertSourcePath || focus.sourcePath || "");
			if (!path || path.indexOf("frontAst") !== 0 || !sourceFile) {
				return;
			}
			var cleaned = cleanInsertValue(insert);
			if (insert.__frontendPropertyDefinition === true) {
				var propertyName = String(insert.name || insert.id || "property");
				delete cleaned.name;
				delete cleaned.id;
				item.mutation = { op: "replace", path: path + "." + propertyName, value: cleaned };
			} else if (slot.index !== undefined && slot.index !== null) {
				item.mutation = { op: "insert", path: path, index: Math.max(0, Number(slot.index) || 0), value: cleaned };
			} else {
				item.mutation = { op: String(insert.__frontendMutationOp || "append"), path: path, value: cleaned };
			}
			item.apply = {
				tool: "frontend-svelte-mutate",
				arguments: {
					project: project,
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


	function normalizeToolError(error) {
		error = error || {};
		var out = {};
		// Preserve bounded diagnostics/recovery fields from checked drafts, never exception internals.
		["diagnostics", "diagnosticCount", "diagnosticsShown", "hasMore"].forEach(function (key) {
			if (error[key] !== undefined) out[key] = error[key];
		});
		out.code = String(error.code || "FLOW_MCP_TOOL_ERROR");
		out.message = String(error.message || error);
		out.hint = error.hint ? String(error.hint) : "";
		out.details = error.details === undefined ? null : error.details;
		return out;
	}

	function toolError(request, error, ctx) {
		request = request || {};
		var normalized = normalizeToolError(error);
		if (normalized.code === "UNKNOWN_BLOCK") {
			var diagnostic = withBlockContract(request, withWorkspaceProviders(request,
				Object.assign({}, normalized.details || {}, {code:normalized.code,message:normalized.message}), true));
			normalized.details = diagnostic;
			if (diagnostic.next) normalized.hint = diagnostic.next + (normalized.hint ? " " + normalized.hint : "");
		}
		if (request.method && request.method !== "tools/call") {
			return finalizeResponse(ctx, request, jsonRpcError(request.id, -32000, normalized.message, {
				code: normalized.code, hint: normalized.hint, details: normalized.details
			}));
		}
		return finalizeResponse(ctx, request, jsonRpcResult(request.id, toolResult(Object.assign({ error: normalized }, authoringArgumentWarning(request) ? {argumentWarning: authoringArgumentWarning(request)} : {}), toolPathContext(request, ctx))));
	}

	function toolOutputSchema(successSchema) {
		var error = { type: "object", additionalProperties: true,
			description: "Tool failed: read code, message, hint and details before retrying." };
		var notices = {
			experience: { type: "object", description: "ACE advice for a first domain gesture or a matching diagnostic.",
				properties: { reason: { type: "string" }, drawer: { type: "string" }, entries: { type: "array", items: {
					type: "object", properties: { id: { type: "string" }, text: { type: "string" } }, required: ["id", "text"]
				} } }, required: ["reason", "drawer", "entries"] },
			argumentWarning: { type: "string", description: "Arguments ignored by the tool and how to correct the call." },
			operatorNote: { type: "string", description: "A note from the person supervising the agent." },
			normalizations: { type: "array", items: { type: "object" } }
		};
		var properties = { error: error };
		Object.keys(notices).forEach(function (key) { properties[key] = notices[key]; });
		var schema = { type: "object", properties: properties, additionalProperties: true };
		// An unconstrained success branch makes anyOf redundant. Most tools use
		// that default: keep the advertised catalog small instead of repeating it.
		if (successSchema) {
			var success = copyJson(successSchema);
			success.properties = success.properties || {};
			Object.keys(notices).forEach(function (key) { success.properties[key] = notices[key]; });
			schema.anyOf = [success,
				{ type: "object", properties: { error: error }, required: ["error"], additionalProperties: true }];
		}
		return schema;
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

	// Tools that write into their target project: the target must be explicit and never the MCP project itself.
	var projectWritingTools = {
		"authoring-mutate": true,
		"code-discard": true,
		"code-patch": true,
		"code-promote": true,
		"code-set": true,
		"flow-block-code-patch": true,
		"flow-block-code-set": true,
		"flow-block-mock": true,
		"flow-code-discard": true,
		"flow-code-patch": true,
		"flow-code-promote": true,
		"flow-code-set": true,
		"flow-fullsync-scaffold": true,
		"flow-entity-model-set": true,
		"flow-object-remove": true,
		"flow-project-reference": true,
		"flow-project-remove": true,
		"flow-resource-delete": true,
		"flow-resource-patch": true,
		"flow-schema-reset": true,
		"flow-sync-inputs": true,
		"frontend-svelte-asset-import": true,
		"frontend-svelte-code-patch": true,
		"frontend-svelte-code-set": true,
		"frontend-svelte-mutate": true,
		"tags-apply": true
	};

	// Without project, an agent that has not created its application yet retries the same call: the error names the
	// bootstrap that creates it and, when the engine runs, the Flow projects already loaded besides the libraries.
	function missingProjectHint(ctx, name) {
		var names = [];
		try {
			var own = ctx && ctx.convertigoContext && ctx.convertigoContext().project;
			var server = own != null ? String(own.getName()) : "";
			loadedProjectTargets().forEach(function (target) {
				if (target.project !== server && !/^lib_/.test(target.project) &&
						new File(target.projectDir, "_flow/engine.yaml").isFile()) {
					names.push(target.project);
				}
			});
		} catch (_ignoreProjectList) {
		}
		names.sort();
		return " If the application project does not exist yet, create it first with flow-project-bootstrap({ project:\"<NewProject>\" })" +
			" (ui:true for a Svelte frontend), then call " + name + " with project:\"<NewProject>\"." +
			(names.length ? " Flow projects loaded: " + names.slice(0, 12).join(", ") + (names.length > 12 ? ", ..." : "") + "." : "");
	}

	function isServerProject(ctx, project) {
		try {
			var own = ctx.convertigoContext().project;
			return own != null && String(own.getName()) === String(project);
		} catch (e) {
			return false;
		}
	}

	// These source arguments are deliberately removed, not arbitrary provider
	// extensions: tool input schemas otherwise remain open to provider properties.
	function authoringArgumentWarning(request) {
		if (["authoring-mutate", "frontend-svelte-mutate"].indexOf(toolName(request)) < 0) return "";
		var allowed = "project projectDir projectName surface builder action transfer mutation mutations sourceFile sourcePath source target definition name flowName qname flowQName flowSource engineSource frontendSourceDrafts sourceRemovals parentPath focusPath rootPath path arguments persist write dryRun includeTree includeFrontendCatalog includeFlowCatalog includeBindings includeDefinition includeSource includeAnalysis includeSchema includePrivate includeTrace includeFullResponse fullResponse detail mode maxDepth reveal doc hints revision baseRevision baseHash sourceWritable readOnly readOnlyReference".split(" ");
		var ignored = Object.keys(toolArguments(request)).filter(function(key) { return allowed.indexOf(key) < 0; });
		var action = toolArguments(request).action;
		if (action && /(?:^|\.)(?:page|layout)$/.test(String(action.id || "")) && action.name !== undefined) ignored.push("action.name (create a Route segment first)");
		if (action && typeof action === "object") Object.keys(action).forEach(function(key) {
			if (["id", "targetPath", "surface", "builder", "position", "targetSlotId", "name", "properties"].indexOf(key) < 0) ignored.push("action." + key);
		});
		return ignored.length ? "Ignored arguments " + ignored.join(", ") + ": pass items[].apply.arguments unchanged; creation parameters belong in action (name for a route segment)." : "";
	}

	function ignoredToolArguments(request) {
		if (!/^(?:flow-)?code-(check|run|analyze)$/.test(toolName(request))) return [];
		var args = toolArguments(request);
		return ["code", "flowScript", "flowSource", "definition"].filter(function (key) {
			return Object.prototype.hasOwnProperty.call(args, key);
		});
	}

	function prepareToolArguments(ctx, request, options) {
		options = options || {};
		var args = copyJson(toolArguments(request || {}));
		var name = toolName(request || {});
		if(args.includeTrace!==undefined && typeof args.includeTrace!=="boolean") {
			var checked=ctx.nativePropertyContract().scalar(args.includeTrace,{type:"boolean"},"includeTrace");
			args.includeTrace=checked.value;
		}
		// A compact code-run omits traces. Avoid allocating every per-node scope
		// snapshot only to discard it in compactRuntimeToolValue below.
		if ((name === "code-run" || name === "flow-code-run") && args.includeTrace === undefined &&
				!argBool(args.includeFullResponse || args.fullResponse, false)) {
			args.includeTrace = argBool(args.includeFullTrace || args.fullTrace, false);
		}
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
			"flow-entity-model-get": true,
			"flow-entity-model-check": true,
			"flow-entity-model-set": true,
			"flow-list": true,
			"flow-object-remove": true,
			"flow-project-metadata": true,
			"flow-resource-delete": true,
			"flow-resource-get": true,
			"flow-resource-patch": true,
			"flow-resource-search": true,
			"flow-search": true,
			"flow-requestable-list": true,
			"flow-requestable-schema": true
		};
		if (requiresProject[name] === true && !hasExplicitProject && String(args.scope || "") !== "workspace") {
			throw new Error(name + " requires an explicit project. This MCP endpoint runs in lib_flow_mcp and is not necessarily the target project; call " + name + " with project:\"<target project>\"." + missingProjectHint(ctx, name));
		}
		if (projectWritingTools[name] === true) {
			if (!hasExplicitProject) {
				throw new Error(name + " writes into a project and requires project:\"<target project>\". Without it the write would land in lib_flow_mcp, the project serving this MCP endpoint." + missingProjectHint(ctx, name));
			}
			if (args.project && !args.projectDir && isServerProject(ctx, args.project)) {
				throw new Error(name + " refuses to write into " + args.project + ", the project serving this MCP endpoint. Pass the application project.");
			}
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
			if (!args.detail) {
				args.detail = "compact";
			}
			if (args.limit === undefined || args.limit === null || String(args.limit) === "") {
				args.limit = 8;
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
					// The binding picker reads the current value from the node definition.
					if (!args.property) {
						args.includeDefinition = false;
					}
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
		ignoredToolArguments(request).forEach(function (key) { delete args[key]; });
		var workspaceSearch = options.workspaceSearch === true
			&& String(args.scope || "") === "workspace"
			&& !args.project
			&& !args.projectDir;
		if (!workspaceSearch && options.resolveProject !== false) {
			args = resolveProjectDir(args);
		}
		if (args.contentFile !== undefined) {
			throw new Error(name + " takes its content inline (code or codepatch); MCP tools never read the agent's files.");
		}
		if ((name === "flow-resource-patch" || name === "flow-resource-delete") && args.path) {
			assertNoWorkingCopy(args, String(args.path), name);
		}
		// Project block tools read the working copies and refuse to overwrite one.
		if (/^(?:authoring|frontend-svelte|flow-block-code)-/.test(name) || name === "flow-app-progress") {
			args = withSourceDrafts(args, name === "authoring-mutate" || name === "frontend-svelte-mutate" ||
				name === "frontend-svelte-fullsync-schema");
		}
		args = inferFrontendMutationSourceFile(name, args);
		// Capture the target project's tag/source working copies at the host boundary,
		// before calling a provider. The Studios use the very same preparation.
		delete args.tagContext;
		var host = Packages.com.twinsoft.convertigo.engine.Engine;
		// without the Convertigo classes (headless tests), Rhino resolves Engine to a package, not a class
		if (!/^\[JavaPackage /.test(String(host)) && host.theApp != null && host.theApp.databaseObjectsManager != null) {
			args = JSON.parse(String(Packages.com.twinsoft.convertigo.engine.flow.FlowEngineBridge.prepareProjectRequest(
				new Packages.org.codehaus.jettison.json.JSONObject(JSON.stringify(args)))));
		}
		return args;
	}

	function runToolBlock(ctx, request, options, handler) {
		try {
			var args = prepareToolArguments(ctx, request, options || {});
			var inferred = observedSourceRevision(ctx, request, args);
			var result = persistSourceMutationResult(request, args, handler(args));
			rememberSourceRevision(ctx, request, args, result);
			if (inferred && result) result.revisionInferred = true;
			return toolResponse(request, result, ctx);
		} catch (e) {
			return toolError(request, e, ctx);
		}
	}

	function persistSourceMutationResult(request, args, result) {
		var name = toolName(request || {});
		if (!result || result.ok !== true || (name !== "authoring-mutate" && name !== "frontend-svelte-mutate" &&
				name !== "frontend-svelte-fullsync-schema")) {
			return result;
		}
		var engineTarget = String(result.target || "") === "engine";
		var sourceChanges = result.sourceChanges && typeof result.sourceChanges === "object" ? result.sourceChanges : null;
		var frontendSource = !engineTarget && typeof result.source === "string" && !!result.sourceFile &&
			(name !== "authoring-mutate" || String(args && args.surface || "") === "frontend");
		if (!sourceChanges && !frontendSource && !engineTarget) {
			return result;
		}
		var persist = args && args.__persist !== undefined ? args.__persist === true
			: !(args && (boolArg(args.dryRun, false) === true || boolArg(args.persist, true) === false || boolArg(args.write, true) === false));
		if (!persist) {
			result.written = false;
			return result;
		}
		var store = sourceStore(args);
		if (engineTarget) {
			// Standalone, the engine wrote engine.yaml itself; a loaded FlowEngine keeps it as its working copy.
			if (store.drafts && typeof result.source === "string") {
				store.project.getFlowEngine().setEngineSource(String(result.source));
				result.written = true;
				result.draft = true;
			}
			if (!sourceChanges) {
				return result;
			}
		}
		if (!args || !args.projectDir) {
			throw new Error("Persisting Flow sources requires projectDir.");
		}
		var projectRoot = new File(String(args.projectDir)).getCanonicalFile();
		var flowRoot = String(new File(projectRoot, "_flow").getCanonicalPath());
		function projectFile(path) {
			var file = new File(String(path));
			if (!file.isAbsolute()) {
				file = new File(projectRoot, String(path));
			}
			file = file.getCanonicalFile();
			if (String(file.getCanonicalPath()).indexOf(flowRoot + String(File.separator)) !== 0) {
				throw new Error("Refusing to write a Flow source outside the project _flow: " + String(path));
			}
			return file;
		}
		var sources = {};
		var files = [];
		Object.keys(sourceChanges || {}).forEach(function (path) {
			if (typeof sourceChanges[path] !== "string") {
				throw new Error("Flow source change must contain text: " + path);
			}
			var file = projectFile(path);
			sources[String(file.getAbsolutePath())] = sourceChanges[path];
			files.push(file);
		});
		if (frontendSource) {
			var sourceFile = projectFile(result.sourceFile);
			sources[String(sourceFile.getAbsolutePath())] = result.source;
			files.push(sourceFile);
			result.sourceFile = String(sourceFile.getAbsolutePath());
			result.writtenBytes = String(result.source).length;
		}
		var written = store.write(sources);
		result.written = true;
		result.draft = written.draft;
		result.writtenFiles = files.map(function (file) {
			return relativeProjectPath(projectRoot, file);
		});
		result.writtenFile = result.writtenFiles[result.writtenFiles.length - 1];
		if (result.path) result.parentPath = qualifyAuthoringPath(args, result.path);
		if (result.selectionSourcePath) {
			result.selectionSourcePath = relativeProjectPath(projectRoot, new File(String(result.selectionSourcePath)));
		}
		if (written.draft) {
			result.dirty = true;
			notifySourceMutations(args, projectRoot, files);
		}
		result.studioRefresh = studioRefreshFlowEngine(args, "frontend-source-mutation");
		result.refreshed = result.studioRefresh && (result.studioRefresh.refreshed === true || result.studioRefresh.scheduled === true);
		return result;
	}

	// Studio and admin listeners (tree, web Studio, frontend dev sync in the Studio) follow the working copies.
	function notifySourceMutations(args, projectRoot, files) {
		var dir = String(projectRoot.getAbsolutePath());
		var paths = files.map(function (file) {
			return String(file.getAbsolutePath());
		});
		var reveal = boolArg(args && args.reveal, false);
		if (!queueSourceNotifications(dir, paths, reveal)) {
			notifyBridge(dir, paths, reveal);
		}
	}

	function notifyBridge(dir, paths, reveal) {
		var Bridge = Packages.com.twinsoft.convertigo.engine.flow.FlowEngineBridge;
		paths.forEach(function (path) {
			try {
				Bridge.notifySourceMutationWithReveal(dir, path, reveal);
			} catch (_ignoreNotify) {
			}
		});
	}

	function studioMode() {
		try {
			return Packages.com.twinsoft.convertigo.engine.Engine.isStudioMode() === true;
		} catch (_notStudio) {
			return false;
		}
	}

	var localSourceNotifications = new Packages.java.util.concurrent.ConcurrentHashMap();

	// One daemon worker thread for the server, started on demand and stopped after 30 s without work: the notifications
	// run in the order of the writes, and no idle thread is kept.
	function sourceNotificationExecutor() {
		var holder;
		try {
			holder = sharedMap("lib_flow_mcp.sourceNotifications");
		} catch (_noServer) {
			holder = localSourceNotifications;
		}
		var executor = holder.get("executor");
		if (executor == null) {
			var concurrent = Packages.java.util.concurrent;
			var threads;
			try {
				threads = Packages.java.lang.Thread.ofPlatform().daemon(true).name("Flow MCP source notifications").factory();
			} catch (_olderJava) {
				threads = concurrent.Executors.defaultThreadFactory();
			}
			var created = new concurrent.ThreadPoolExecutor(0, 1, 30, concurrent.TimeUnit.SECONDS,
				new concurrent.LinkedBlockingQueue(), threads);
			executor = holder.putIfAbsent("executor", created);
			if (executor == null) {
				executor = created;
			} else {
				created.shutdown();
			}
		}
		return executor;
	}

	/**
	 * Queues the notification of source writes, in the Studio: there it refreshes the Project Explorer and reveals the
	 * source on the UI thread, and synchronizes the development viewer under the frontend authoring lock of the server,
	 * which the Studio holds while it describes its tree; on the caller's thread, a write could wait minutes for its
	 * answer. A server notifies on the caller's thread (false): the notification drops the source snapshots the next
	 * call reads.
	 * options (tests): background (default: Studio mode), notify(projectDir, path, reveal) replacing the bridge.
	 * @return true when queued, false when the caller notifies
	 */
	function queueSourceNotifications(projectDir, paths, reveal, options) {
		options = options || {};
		var background = options.background !== undefined ? options.background === true : studioMode();
		var list = (paths || []).map(function (path) { return String(path); });
		if (!background || list.length === 0) {
			return false;
		}
		var dir = String(projectDir || "");
		var shown = reveal === true;
		var notify = typeof options.notify === "function" ? options.notify : null;
		try {
			sourceNotificationExecutor().execute(new Packages.java.lang.Runnable({ run: function () {
				if (notify) {
					list.forEach(function (path) {
						try {
							notify(dir, path, shown);
						} catch (_ignoreNotify) {
						}
					});
				} else {
					notifyBridge(dir, list, shown);
				}
			}}));
			return true;
		} catch (_noBackground) {
			return false;
		}
	}


	// The FlowEngine of a project loaded in this Convertigo owns the working copies
	// of its sources, as in the Studio: reads see the drafts, writes become drafts,
	// and only the project Save writes them. Without a loaded project (standalone
	// runtime, projectDir only), sources are read and written on disk.
	function loadedFlowEngineProject(args) {
		args = args || {};
		if (typeof Packages === "undefined") {
			return null;
		}
		try {
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			if (Engine.theApp == null || Engine.theApp.databaseObjectsManager == null) {
				return null;
			}
			var projectDir = args.projectDir ? new File(String(args.projectDir)).getCanonicalFile() : null;
			var name = String(args.project || (projectDir ? projectDir.getName() : "") || "");
			if (!name) {
				return null;
			}
			var project = Engine.theApp.databaseObjectsManager.getLoadedProjectByName(name);
			if (project == null || project.getFlowEngine() == null) {
				return null;
			}
			if (projectDir && String(project.getDirFile().getCanonicalPath()) !== String(projectDir.getCanonicalPath())) {
				return null;
			}
			return project;
		} catch (_ignoreLoadedProject) {
			return null;
		}
	}

	function collectSourceDrafts(project, drafts, visited) {
		if (project == null || visited[String(project.getName())]) {
			return drafts;
		}
		visited[String(project.getName())] = true;
		var flowEngine = project.getFlowEngine();
		if (flowEngine != null) {
			var entries = flowEngine.getSourceDrafts().entrySet().toArray();
			for (var i = 0; i < entries.length; i++) {
				drafts[String(entries[i].getKey())] = String(entries[i].getValue());
			}
		}
		var references = project.getReferenceList().toArray();
		for (var j = 0; j < references.length; j++) {
			try {
				var referencedName = references[j].getParser ? String(references[j].getParser().getProjectName() || "") : "";
				if (referencedName) {
					collectSourceDrafts(Packages.com.twinsoft.convertigo.engine.Engine.theApp.databaseObjectsManager
						.getLoadedProjectByName(referencedName), drafts, visited);
				}
			} catch (_ignoreReferenceDrafts) {
			}
		}
		return drafts;
	}

	function sourceStore(args) {
		var project = loadedFlowEngineProject(args);
		var flowEngine = project == null ? null : project.getFlowEngine();
		function absolute(file) {
			return String(file.getCanonicalPath());
		}
		return {
			drafts: flowEngine != null,
			project: project,
			sourceDrafts: function () {
				return project == null ? {} : collectSourceDrafts(project, {}, {});
			},
			exists: function (file) {
				return flowEngine != null ? flowEngine.hasSource(absolute(file)) === true : file.isFile();
			},
			discard: function (file) {
				return flowEngine != null && flowEngine.discardSource(absolute(file)) === true;
			},
			dirty: function (file) {
				return flowEngine != null && flowEngine.isSourceDirty(absolute(file)) === true;
			},
			read: function (file) {
				return flowEngine != null ? String(flowEngine.getSource(absolute(file))) : readUtf8(file);
			},
			// sources: { absolutePath: text }. Validated as a whole by the FlowEngine. Every caller notifies the written
			// sources (FlowEngineBridge.notifySourceMutation), which invalidates the data caches of their project and of
			// the projects using it: those of every other project, their authoring answers and source snapshots, stay.
			write: function (sources) {
				var paths = Object.keys(sources || {});
				if (flowEngine == null) {
					paths.forEach(function (path) {
						writeUtf8(new File(path), sources[path]);
					});
					return { paths: paths, draft: false };
				}
				var map = new Packages.java.util.LinkedHashMap();
				paths.forEach(function (path) {
					map.put(path, String(sources[path]));
				});
				flowEngine.setSources(map);
				Packages.com.twinsoft.convertigo.engine.flow.FlowStudioSupport.clearCatalogCache(flowEngine);
				return { paths: paths, draft: true };
			}
		};
	}

	// Resource tools write files: never under a Studio working copy of the same source.
	function assertNoWorkingCopy(args, path, name) {
		// The FlowEngine keeps working copies of Flow sources only (FlowEngine.canonicalSourcePath): the libraries of
		// the project (libs/) and the other files (guides in .md, .java, .html...) are plain files, and the FlowEngine
		// refuses to tell the state of such a file.
		var relative = path.replace(/\\/g, "/").replace(/^(?:\.?\/)+/, "");
		if (/^libs\//.test(relative) || !/\.(?:flow\.svelte|flow\.css|block\.js|type\.yaml|schema\.json|yaml|json|js|svelte)$/.test(relative)) {
			return;
		}
		var store = sourceStore(args);
		if (!store.drafts || !args.projectDir) {
			return;
		}
		var root = new File(String(args.projectDir)).getCanonicalFile();
		var file = new File(root, path.replace(/^\/+/, "")).getCanonicalFile();
		var engineFile = new File(root, "_flow/engine.yaml").getCanonicalFile();
		var dirty = String(file.getCanonicalPath()) === String(engineFile.getCanonicalPath())
			? store.project.getFlowEngine().isEngineSourceDirty() === true
			: store.dirty(file);
		if (dirty) {
			var error = new Error(name + " refused: " + path + " has unsaved Studio changes.");
			error.code = "SOURCE_WORKING_COPY";
			error.hint = "Ask the user to save the project (or reload it), or edit the source with code-get/code-set, which work on the working copy.";
			throw error;
		}
	}

	// Engine requests of a loaded project see its working copies, like Studio requests.
	// A mutation then returns sources instead of writing them: persistSourceMutationResult
	// hands them to the FlowEngine, as FlowEngineBridge.authoringMutate does.
	function withSourceDrafts(args, mutating) {
		var store = sourceStore(args);
		if (!store.drafts) {
			return args;
		}
		var drafts = store.sourceDrafts();
		Object.keys(args.frontendSourceDrafts || {}).forEach(function (key) {
			drafts[key] = args.frontendSourceDrafts[key];
		});
		args.frontendSourceDrafts = drafts;
		args.engineSource = String(store.project.getFlowEngine().getEngineSource());
		if (mutating) {
			args.__persist = !(boolArg(args.dryRun, false) === true || boolArg(args.persist, true) === false ||
				boolArg(args.write, true) === false);
			args.write = false;
			args.persist = false;
		}
		return args;
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

	// engineSource: the Engine source of the request (a loaded FlowEngine working copy), else engine.yaml.
	function frontendBuilderModelPath(projectRoot, builderName, engineSource) {
		var source = engineSource !== undefined && engineSource !== null && String(engineSource).trim() ? String(engineSource) : "";
		if (!source) {
			var engineFile = projectRoot ? new File(projectRoot, "_flow/engine.yaml") : null;
			if (!engineFile || !engineFile.isFile()) {
				return "";
			}
			source = readUtf8(engineFile);
		}
		var builderSafe = safeFileName(builderName || "svelte");
		var lines = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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
		if (args.sourceFile || args.sourcePath || frontendCreateSourceSpec(args) !== null) {
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
		var modelPath = frontendBuilderModelPath(projectRoot, args.builder || "svelte", args.engineSource);
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
			// The engine reads the first flowQName segment as the project: a bare Flow name
			// (standalone, no project) would address the working copy of another qname.
			if (rawQName.indexOf(".") > 0) {
				args.flowQName = rawQName;
			}
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
		assertFlowNameFree(args, args.name);
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

	function compactFlowListToolValue(request, value) {
		// A success-only list projection must never hide a tool failure.
		if (!value || typeof value !== "object" || value.error || responseDetail(request) === "full") {
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

	// Blocks of the loaded workspace projects (data libraries such as lib_flow_sql), found by their id and description
	// for a block the target project does not know: it becomes usable once the project references its library.
	var WORKSPACE_BLOCK_SKIPPED = { lib_flow_engine: true, lib_flow_mcp: true };
	var WORKSPACE_BLOCK_SYNONYMS = {
		db: ["sql", "data"], database: ["sql", "data"], jdbc: ["sql"], hsqldb: ["sql"], postgres: ["sql"], mysql: ["sql"],
		select: ["query", "read", "page"], find: ["query", "read"], list: ["page", "query"], fetch: ["read", "get"],
		insert: ["mutate", "write"], update: ["mutate", "write"], delete: ["mutate", "write"], save: ["write", "mutate"],
		couch: ["couchdb"], fullsync: ["couchdb"], table: ["sql", "baserow"], crud: ["data"]
	};
	var workspaceBlockIndex = { at: 0, entries: null };

	function blockWords(text) {
		return String(text || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/)
			.filter(function (word) { return word.length >= 2; });
	}

	function workspaceBlockEntries() {
		var now = Number(System.currentTimeMillis());
		if (workspaceBlockIndex.entries && now - workspaceBlockIndex.at < 30000) {
			return workspaceBlockIndex.entries;
		}
		var entries = [];
		loadedProjectTargets().forEach(function (target) {
			if (WORKSPACE_BLOCK_SKIPPED[target.project]) return;
			var root = new File(new File(String(target.projectDir), "_flow"), "blocks");
			(function walk(dir, namespace) {
				var files = dir.isDirectory() ? dir.listFiles() : null;
				for (var i = 0; files && i < files.length; i++) {
					var name = String(files[i].getName());
					if (files[i].isDirectory()) {
						walk(files[i], namespace.concat([name]));
						continue;
					}
					var match = /^(.+)\.block\.js$/.exec(name);
					if (!match) continue;
					var head = "";
					try {
						head = String(new Packages.java.lang.String(Files.readAllBytes(files[i].toPath()), StandardCharsets.UTF_8)).substring(0, 4000);
					} catch (e) {
					}
					if (/"private"\s*:\s*true/.test(head)) continue;
					var description = /"description"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(head);
					entries.push({ project: target.project, block: namespace.concat([match[1]]).join("."),
						description: description ? description[1] : "" });
				}
			})(root, []);
		});
		workspaceBlockIndex = { at: now, entries: entries };
		return entries;
	}

	// The best workspace blocks for a block id or a need, outside the target project.
	function workspaceBlockProviders(targetProject, query, limit) {
		var exact = String(query || "");
		var words = {};
		blockWords(query).forEach(function (word) {
			words[word] = true;
			(WORKSPACE_BLOCK_SYNONYMS[word] || []).forEach(function (synonym) { words[synonym] = true; });
		});
		return workspaceBlockEntries().filter(function (entry) {
			return entry.project !== String(targetProject || "");
		}).map(function (entry) {
			var score = entry.block === exact ? 1000 : 0;
			blockWords(entry.block).forEach(function (word) { if (words[word]) score += 3; });
			blockWords(entry.description).forEach(function (word) { if (words[word]) score += 1; });
			return { entry: entry, score: score };
		}).filter(function (item) {
			return item.score >= 3;
		}).sort(function (a, b) {
			return b.score - a.score || a.entry.block.localeCompare(b.entry.block);
		}).slice(0, limit || 3).map(function (item) {
			return { project: item.entry.project, block: item.entry.block,
				description: item.entry.description.length > 120 ? item.entry.description.substring(0, 119) + "…" : item.entry.description };
		});
	}

	// Guides shipped by workspace libraries (_flow/resources/guide/*.md), served as flow://lib/<project>/<guide>.
	function libraryGuides() {
		var guides = [];
		loadedProjectTargets().forEach(function (target) {
			// Core backend guides are library resources too; only MCP duplicates the fixed guides.
			if (target.project === "lib_flow_mcp") return;
			var dir = new File(new File(new File(new File(String(target.projectDir), "_flow"), "resources"), "guide"), "");
			var files = dir.isDirectory() ? dir.listFiles() : null;
			for (var i = 0; files && i < files.length; i++) {
				var name = String(files[i].getName());
				var match = /^([A-Za-z0-9_.-]+)\.md$/.exec(name);
				if (!match || !files[i].isFile()) continue;
				var text = "";
				try {
					text = String(new Packages.java.lang.String(Files.readAllBytes(files[i].toPath()), StandardCharsets.UTF_8));
				} catch (e) {
				}
				var title = /^#\s+(.+)$/m.exec(text);
				guides.push({
					uri: "flow://lib/" + target.project + "/" + match[1],
					name: target.project + " " + match[1],
					description: (title ? title[1] : target.project + " guide") + " (guide of the workspace library " + target.project + ")",
					mimeType: "text/markdown",
					project: target.project,
					file: String(files[i].getCanonicalPath())
				});
			}
		});
		return guides;
	}

	function libraryGuideText(uri) {
		var found = libraryGuides().filter(function (guide) { return guide.uri === String(uri || ""); })[0];
		return found ? String(new Packages.java.lang.String(Files.readAllBytes(new File(found.file).toPath()), StandardCharsets.UTF_8)) : null;
	}

	function withWorkspaceProviders(request, diagnostic, exactOnly) {
		if (!diagnostic || diagnostic.code !== "UNKNOWN_BLOCK") return diagnostic;
		var block = String(diagnostic.block || (/Unknown Flow block:\s*([A-Za-z0-9_.$-]+)/.exec(String(diagnostic.message || "")) || [])[1] || "");
		var target = String(toolArguments(request).project || "");
		var providers = [];
		try {
			providers = block ? workspaceBlockProviders(target, block, 3) : [];
		} catch (e) {
			providers = [];
		}
		if (exactOnly) providers = providers.filter(function (provider) { return provider.block === block; });
		if (!providers.length) return diagnostic;
		var guides = libraryGuides().filter(function (guide) { return guide.project === providers[0].project; });
		diagnostic.workspaceProviders = providers;
		if (guides.length) diagnostic.workspaceGuides = guides.map(function (guide) { return guide.uri; });
		diagnostic.candidateDecision = { recommendation: "reference", tool: "flow-project-reference",
			reference: providers[0].project, bestBlock: providers[0].block };
		delete diagnostic.contract;
		diagnostic.next = "The workspace project " + providers[0].project + " provides " + providers[0].block +
			": add it with flow-project-reference({project:\"" + (target || "<project>") + "\", reference:\"" + providers[0].project +
			"\"}), use the block, then check again. Do not mock a block that a workspace library provides." +
			(guides.length ? " Read its guide first: " + guides.map(function (guide) { return guide.uri; }).join(", ") + "." : "");
		return diagnostic;
	}

	// Diagnostics about how a block is called name the call that reads its contract (properties, outputs, errors and
	// examples): agents otherwise read the library sources with shell tools.
	var BLOCK_CONTRACT_DIAGNOSTICS = {
		UNKNOWN_BLOCK_PROPERTY: true,
		FLOWSCRIPT_PROPERTY_TYPE_MISMATCH: true,
		FLOWSCRIPT_INVALID_BLOCK_CALL_SIGNATURE: true,
		FLOWSCRIPT_BLOCK_ARGUMENTS_NAMED: true,
		FLOWSCRIPT_TEXT_PROPERTY_PATH: true,
		BLOCK_NOT_AVAILABLE_ON_TARGET: true,
		INVALID_PROPERTY_VALUE: true,
		MISSING_REQUIRED_PROPERTY: true
	};

	function withBlockContract(request, diagnostic) {
		if (!diagnostic || typeof diagnostic !== "object" || diagnostic.contract) {
			return diagnostic;
		}
		var code = String(diagnostic.code || "");
		var block = "";
		if (code === "UNKNOWN_BLOCK") {
			var decision = diagnostic.candidateDecision || {};
			block = String(decision.bestBlock || diagnostic.candidates && diagnostic.candidates[0] && diagnostic.candidates[0].block || "");
		} else if (BLOCK_CONTRACT_DIAGNOSTICS[code] === true) {
			block = String(diagnostic.block || "");
		}
		if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(block)) {
			return diagnostic;
		}
		var project = String(toolArguments(request).project || "");
		diagnostic.contract = "flow-block-get({ " + (project ? "project: \"" + project + "\", " : "") + "name: \"" + block + "\" })";
		var sentence = "The contract of " + block + " (properties, outputs, errors, examples): " + diagnostic.contract +
			"; never read library sources for it.";
		diagnostic.next = diagnostic.next ? String(diagnostic.next) + " " + sentence : sentence;
		return diagnostic;
	}

	function compactFlowCodeDiagnostic(diagnostic) {
		diagnostic = diagnostic || {};
		var out = {};
		["severity", "phase", "code", "line", "message", "block", "property", "path", "expression", "actual", "candidateDecision", "workspaceProviders", "workspaceGuides", "contract", "next"].forEach(function (key) {
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
		var shown = diagnostics.slice(0, limit).map(function (diagnostic) {
			return compactFlowCodeDiagnostic(withBlockContract(request, withWorkspaceProviders(request, diagnostic)));
		});
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
			if (error.code === "FLOW_CODE_DRAFT_REVISION_MISMATCH" && error.details.receivedRevision !== undefined && error.details.currentRevision !== undefined) {
				out.details = {property:"revision",receivedRevision:String(error.details.receivedRevision),currentRevision:String(error.details.currentRevision)};
				return out;
			}
			var report = compactFlowCodeDiagnosticReport(request, error.details);
			out.details = report;
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
		["ok", "qname", "name", "block", "target", "runtime", "format", "dry", "unchanged", "written", "finalized", "promoted", "blockAlreadySaved", "dirty", "exists", "discarded", "revision", "oldRevision", "workingRevision", "officialRevision", "draftCleared", "linted", "changedLines",
			"revisionInferred", "dboHasChanged", "dboBNew", "dboFlowSourceDirty", "dboVariableCount"].forEach(function (key) {
			if (value[key] !== undefined && value[key] !== null && value[key] !== "") {
				out[key] = value[key];
			}
		});
			if (value.draft === true || value.workingCopy === true) {
				out.workingCopy = true;
				out.unsaved = true;
			}
		// Corrections are an audit trail, never a lossy preview. Keep the full
		// source and every before/after even in the default compact response.
		if (value.fixes && value.fixes.length) {
			out.fixes = value.fixes;
			out.code = value.code;
		}
		// So are the calls auto-corrected, and the proposed patch is passed unchanged to code-patch
		if (value.autoCorrected) {
			out.autoCorrected = value.autoCorrected;
			out.code = value.code;
		}
		if (value.proposedPatch) {
			out.proposedPatch = value.proposedPatch;
			if (!value.proposedPatch.revision && value.code) out.code = value.code;
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
			out.warnings = (value.warnings || []).slice(0, 5).map(function (warning) {
				return compactFlowCodeDiagnostic(withBlockContract(request, warning));
			});
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
		if (value.ok === false && value.proposedPatch && value.proposedPatch.edits && value.proposedPatch.edits.length) {
			out.next = value.proposedPatch.next;
		} else if (value.ok === false && out.error && out.error.code === "FLOW_CODE_DRAFT_REVISION_MISMATCH" && out.error.details && out.error.details.currentRevision) {
			out.next = "Review the working copy with code-get at revision " + out.error.details.currentRevision +
				", then promote exactly the checked revision. A transcription error in revision needs no source patch.";
		} else if (value.ok === false) {
			out.next = value.draft
				? "Patch the working copy with code-patch, then check again with code-check."
				: "Fix diagnostics, then retry code-set before saving.";
		} else if (name === "flow-code-status" || name === "code-status") {
			out.next = value.dirty
				? "Run/check the working copy, then promote to save or discard to cancel."
				: "No unsaved working copy. Use code-set or code-patch to edit.";
		} else if (name === "flow-code-discard" || name === "code-discard") {
			out.next = "Working copy discarded. Use code-get to read the official Flow or code-set to edit again.";
			} else if (value.unchanged === true && value.draft !== true) {
				out.next = "Source unchanged; the saved Flow is active.";
			} else if (value.blockAlreadySaved) {
				out.next = value.next || "Project-local block source is already saved by code-set/code-patch. Run an executable Flow that uses the block.";
			} else if (value.draft && value.written) {
				out.next = "UNSAVED WORKING COPY: code-set updated and checked only the draft. Run with code-run without sending code, then call code-promote with this revision to save; do not stop after draft-only success.";
			} else if (value.draft) {
				out.next = "UNSAVED WORKING COPY: check passed only for the draft. Run with code-run without sending code, then call code-promote with this revision to save; do not stop after draft-only success.";
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
			out.next = "Fast save done. Studio refresh is attempted by default; pass refresh:false only when UI refresh must be skipped. If code-run already proved the result, stop. Use flow-test only when a saved-flow validation is still needed. saveProject:true exports the whole project and is refused while other unsaved Studio work exists.";
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
			if (value.trace && value.trace.nodes) noTraceOut.traceNodeCount = value.trace.nodes.length;
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
						revision: value.revision,
						qname: value.qname,
						message: "code-run executed an unsaved working copy.",
						hint: "Resume this exact revision with code-patch or save it with code-promote: " + String(value.revision || "")
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
			"saveMode", "refreshed", "schemaCacheCleared", "sessionsReset", "httpSessionTimeout", "sessionNote", "accessibilityNote",
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
			if (registration.projectFlagLock && registration.projectFlagLock.acquired !== true) {
				out.projectFlagLock = registration.projectFlagLock;
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
		["ok", "title", "message", "sourceFile", "revision", "oldRevision", "revisionInferred", "proposedPatch", "contentLength",
			"hunks", "errorCount", "warningCount", "written", "writtenFile", "writtenFiles", "writtenBytes",
			"draft", "dirty", "sourceId", "selectionSourcePath", "path", "selectionPath", "parentPath",
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
		out.next = value.draft === true
			? "Written as working copies of the loaded project, like Studio edits: they are used by the tree, checks and dev preview, and written to disk when the project is saved. Use code-get to read them again."
			: "Source omitted after validation. Use code-get to read it again, or detail:'full' only for debugging.";
		return out;
	}

	function boundedCodeRead(request, value) {
		var args = toolArguments(request);
		var hasStart = args.startLine !== undefined && args.startLine !== null && String(args.startLine) !== "";
		var hasEnd = args.endLine !== undefined && args.endLine !== null && String(args.endLine) !== "";
		if ((!hasStart && !hasEnd) || !value || value.ok === false || typeof value.code !== "string" || value.partial === true) return value;
		function reject(code, message) { var error = new Error(message); error.code = code; throw error; }
		if (hasStart !== hasEnd) reject("CODE_RANGE_INCOMPLETE", "A bounded code-get requires both startLine and endLine.");
		if (args.revision !== undefined && args.revision !== null && String(args.revision) !== "" && String(args.revision) !== String(value.revision)) {
			reject("CODE_STALE_REVISION", "Source changed since the requested revision. Read its current revision before requesting a range.");
		}
		var lines = value.code.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
		var start = Number(args.startLine), end = Number(args.endLine);
		if (!isFinite(start) || !isFinite(end) || Math.floor(start) !== start || Math.floor(end) !== end ||
			start < 1 || end < start || end > lines.length || end - start + 1 > 500) {
			reject("CODE_RANGE_INVALID", "Use inclusive one-based bounds inside the " + lines.length + " line source, at most 500 lines.");
		}
		var out = Object.assign({}, value);
		out.code = lines.slice(start - 1, end).join("\n");
		out.partial = true;
		out.startLine = start;
		out.endLine = end;
		out.totalLines = lines.length;
		out.totalContentLength = value.code.length;
		out.contentLength = out.code.length;
		delete out.descriptor;
		delete out.implementationSource;
		out.next = "Use this revision with code-patch, or request another bounded range.";
		return out;
	}

	function compactToolValue(request, value) {
		var name = toolName(request);
		if (name === "code-get" || name === "flow-code-get" || name === "flow-block-code-get") return boundedCodeRead(request, value);
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
		if ((name === "authoring-palette" || name === "frontend-svelte-palette") && value && typeof value === "object" &&
				Object.prototype.toString.call(value.items) === "[object Array]" && responseDetail(request) !== "full") {
			// a candidate is what to insert and how: its documentation, icons and duplicate mutation stay out
			value.items = value.items.map(function (item) {
				var properties = item && item.properties && typeof item.properties === "object" ? item.properties : {};
				var out = {};
				["id", "label", "category", "kind", "description", "provider", "apply"].forEach(function (key) {
					if (item[key] !== undefined && item[key] !== null && item[key] !== "") out[key] = item[key];
				});
				var names = Object.keys(properties).filter(function (key) {
					var property = properties[key] || {};
					return key !== "id" && property.hidden !== true && property.category !== "Information";
				});
				// every property, the texts of the interface (labels, placeholders) last: a cut at 24 in alphabetical
				// order dropped source, selectable and selected of a DataTable
				var text = function (key) { return /(?:Label|Text|Placeholder)$/.test(key); };
				names = names.filter(function (key) { return !text(key); }).concat(names.filter(text));
				if (item && item.events && typeof item.events === "object") {
					var handlers = Object.keys(item.events).map(function (key) {
						return String(item.events[key] && item.events[key].handler || ("On" + key.charAt(0).toUpperCase() + key.substring(1)));
					});
					if (handlers.length) out.events = handlers;
				}
				if (names.length) {
					out.properties = names.map(function (key) {
						var property = properties[key] || {};
						return key + ":" + String(property.type || property.kind || "unknown") +
							(Object.prototype.toString.call(property.enum) === "[object Array]" && property.enum.length <= 8
								? "(" + property.enum.join("|") + ")" : "");
					});
				}
				return out;
			});
			value.responseDetail = "compact";
			value.next = "Execute items[].apply unchanged. Use detail:\"full\" only to read a candidate's documentation.";
		}
		if (name === "flow-catalog" && value && typeof value === "object") {
			var catalogArgs = toolArguments(request);
			var need = String(catalogArgs.query || catalogArgs.q || catalogArgs.search || "");
			if (need) {
				try {
					var providers = workspaceBlockProviders(catalogArgs.project, need, 5);
					if (providers.length) {
						value.workspaceProviders = providers;
						var catalogGuides = libraryGuides().filter(function (guide) {
							return providers.some(function (provider) { return provider.project === guide.project; });
						}).map(function (guide) { return guide.uri; });
						if (catalogGuides.length) value.workspaceGuides = catalogGuides;
						value.workspaceNext = "These blocks come from workspace projects the project does not reference yet: add one with flow-project-reference({project, reference}) before using its blocks.";
					}
				} catch (e) {
				}
			}
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
		if (name === "flow-test" || name === "flow-code-run" || name === "code-run") {
			return compactRuntimeToolValue(request, value);
		}
		if (name === "flow-code-analyze" || name === "code-analyze") {
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
		return value;
	}

	function parseRequest(value, ctx) {
		value = value || {};
		if (typeof value === "string") {
			try { value = JSON.parse(value); }
			catch (invalidJson) { return { id: null, __flowMcpProtocolError: { code: -32700, message: "Parse error: invalid JSON." } }; }
		}
		if (!value || typeof value !== "object" || (Array.isArray(value) && !value.length)) {
			return { id: null, __flowMcpProtocolError: { code: -32600, message: "Invalid JSON-RPC request." } };
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

	// Relay to the Convertigo MCP (lib_ConvertigoMCP) of the same server: the tools it already provides and that apply
	// to a Flow project are listed and called through this endpoint, so that one MCP serves both. The call goes back
	// to the server over HTTP with the headers of the client (the two endpoints share their tokens).
	var LEGACY_RELAY_TOOLS = {
		"browser-verify": true,
		"databaseobject-schema": true,
		"databaseobject-search": true,
		"databaseobject-tree-get": true,
		"image-describe": true,
		"log-view": true,
		"marketplace-describe": true,
		"marketplace-import": true,
		"marketplace-list": true,
		"project-list": true,
		"project-list-symbols": true,
		"project-save": true,
		"project-security-audit": true,
		"rag-query": true,
		"report-create": true,
		"requestable-execute": true,
		"scheduler-apply": true,
		"scheduler-list": true,
		"subagent-run": true
	};
	// subagent-run: the verifier, and the constructor of the Flow pack only. A constructor relayed here always carries
	// inputs.pack "flow": lib_ConvertigoMCP then runs its Vibe session with the convertigo-flow server alone (the same
	// token and headers), on one side of the project (inputs.scope), never the legacy objects of the Convertigo pack.
	var RELAYED_SUBAGENT_PROFILES = ["verifier", "constructor"];
	var FLOW_CONSTRUCTOR_SCOPES = ["backend", "frontend"];
	var LEGACY_RELAY_HEADERS = ["User-Agent", "Authorization", "X-Convertigo-Agent-Provider", "X-Convertigo-Guidance-Version", "Convertigo-Guidance-Version",
		"MCP-Protocol-Version", "X-Convertigo-Viewer-Debug-Port", "X-Convertigo-Conversation-Id",
		"X-Convertigo-Reveal-Mode", "X-Convertigo-No-Log", "X-Convertigo-Subagent-Run"];
	var LEGACY_RELAY_NOTE = " (Relayed to the Convertigo MCP of this server.)";

	function relayedBrowserDescriptor(copy) {
		var props = copy.inputSchema && copy.inputSchema.properties;
		copy.description = String(copy.description || "") +
			" A new check requires non-empty paths describing the journeys to walk (checks alone is insufficient). " +
			(props && props.inputs
				? 'For a Flow dev viewer, include inputs.project with the application project: {url:"<openUrl from dev.open>",paths:["Open the home page and check its title"],inputs:{project:"MyApp"}}. '
				: 'This browser-verify schema cannot carry inputs.project, which a Flow dev viewer requires. For Flow use subagent-run({profile:"verifier",task:"Verify the home page",inputs:{project:"MyApp",url:"<openUrl from dev.open>",paths:["Open the home page and check its title"]}}); collect its report with subagent-run({runId}). ') +
			"Resume a running check with verificationId alone.";
		if (props && props.paths) props.paths.description = "Required for a new check: non-empty plain-language journeys to walk (prefer an array). checks does not replace paths.";
		if (props && props.inputs) props.inputs.description = String(props.inputs.description || "") +
			" For a Flow dev viewer, include project: the application project name; required before dev.ensure can run.";
		return copy;
	}

	function legacyRelayEnabled() {
		return String(System.getProperty("convertigo.flow.mcp.legacyRelay", "true")).toLowerCase() !== "false";
	}

	function legacyRelayTool(name) {
		return legacyRelayEnabled() && LEGACY_RELAY_TOOLS[String(name || "")] === true;
	}

	function legacyEndpoint(ctx) {
		var context = ctx && typeof ctx.convertigoContext === "function" ? ctx.convertigoContext() : null;
		var servletRequest = context && context.httpServletRequest;
		if (!servletRequest) {
			throw new Error("The Convertigo MCP relay needs an HTTP request.");
		}
		var scheme = String(servletRequest.getScheme() || "http").toLowerCase() === "https" ? "https" : "http";
		var host = scheme === "https" ? "localhost" : "127.0.0.1";
		return {
			url: scheme + "://" + host + ":" + Number(servletRequest.getLocalPort()) +
				String(servletRequest.getContextPath() || "").replace(/\/+$/, "") + "/api/mcp?jsonOnly=true",
			servletRequest: servletRequest
		};
	}

	function legacyPost(ctx, payload, timeoutSeconds) {
		var endpoint = legacyEndpoint(ctx);
		var HttpRequest = Packages.java.net.http.HttpRequest;
		function post(url) {
			var builder = HttpRequest.newBuilder(Packages.java.net.URI.create(url))
				.timeout(Packages.java.time.Duration.ofSeconds(timeoutSeconds))
				.header("Content-Type", "application/json")
				.header("Accept", "application/json, text/event-stream");
			LEGACY_RELAY_HEADERS.forEach(function (name) {
				var value = endpoint.servletRequest.getHeader(name);
				if (value !== null && value !== undefined && String(value) !== "") {
					builder.header(name, String(value));
				}
			});
			var request = builder.POST(HttpRequest.BodyPublishers.ofString(JSON.stringify(payload), StandardCharsets.UTF_8)).build();
			var client = Packages.java.net.http.HttpClient.newBuilder()
				.connectTimeout(Packages.java.time.Duration.ofSeconds(5)).build();
			return client.send(request, Packages.java.net.http.HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
		}
		var response;
		try { response = post(endpoint.url); }
		catch (error) {
			// A TLS-terminating proxy rewrites getScheme(), not the local connector.
			// Retry only a proven plaintext connector, on this same loopback port/path.
			// Certificate/hostname errors must never select this path.
			if (endpoint.url.indexOf("https://localhost:") !== 0 ||
					String(error).indexOf("Unrecognized SSL message, plaintext connection?") < 0) throw error;
			response = post(endpoint.url.replace("https://localhost:", "http://127.0.0.1:"));
		}
		var body = String(response.body() || "");
		if (Number(response.statusCode()) >= 400 && !/^\s*\{/.test(body)) {
			throw new Error("The Convertigo MCP answered HTTP " + response.statusCode() + ".");
		}
		return JSON.parse(body);
	}

	// A legacy description may illustrate a field with an example taken from one business application (a demo account
	// such as `name.demo / password`): the Flow MCP keeps its catalogue neutral and gives a generic example instead.
	var NEUTRAL_RELAY_EXAMPLE = "For example: sign in as the demo user, open a record, change a field and save it, " +
		"then check that the list shows the new value.";
	function neutralRelayDescriptions(node) {
		if (Array.isArray(node)) {
			node.forEach(neutralRelayDescriptions);
		} else if (node && typeof node === "object") {
			for (var key in node) {
				if (!Object.prototype.hasOwnProperty.call(node, key)) {
					continue;
				}
				if (key === "description" && typeof node[key] === "string" && /\(\w+\.demo \/ \w+\)/.test(node[key])) {
					node[key] = node[key].replace(/For example:[\s\S]*$/, NEUTRAL_RELAY_EXAMPLE);
				} else {
					neutralRelayDescriptions(node[key]);
				}
			}
		}
		return node;
	}

	// The Flow facade of subagent-run: the verifier, and the constructor of one side of a parallel build.
	function relayedSubagentDescriptor(tool) {
		var properties = tool.inputSchema && tool.inputSchema.properties;
		if (properties && properties.profile) {
			properties.profile.enum = RELAYED_SUBAGENT_PROFILES.slice(0);
			properties.profile["default"] = "verifier";
			properties.profile.description = "verifier: functional and visual browser proofs on the Studio viewer, read-only, by a vision model. " +
				"constructor: a write-capable sub-agent with the Flow tools only, for one side of a parallel build " +
				"(flow://guide/fullstack-paperboard); one per scope and project at a time.";
		}
		if (properties && properties.inputs) {
			properties.inputs.description = "verifier: project, the application project required to ensure its dev viewer; url, the viewer URL (openUrl of frontend-svelte-action dev.sync or dev.open); paths: one " +
				"plain-language user journey per item (sign in, go through pages, fill and submit a form); checks: acceptance criteria with the exact " +
				"expected texts; hints: demo accounts, expected values, what just changed; viewport: desktop (default), mobile or <width>x<height>. " +
				"constructor: project (required), scope (required): backend (Flows, project blocks, engine.yaml, tests) or frontend " +
				"(_flow/frontbuilder sources, theme, assets); contracts: the Flows with their inputs and output fields; notes: rules and values that matter.";
		}
		tool.description = String(tool.description || "") + " Flow: profile verifier, or constructor with inputs.scope backend or frontend. " +
			"A call answers within about 50 s (start a constructor with waitSec 5): while it answers status:\"running\", call subagent-run " +
			"again with runId alone.";
		return tool;
	}

	function relayRequestHeader(ctx, name) {
		try {
			var context = ctx && typeof ctx.convertigoContext === "function" ? ctx.convertigoContext() : null;
			var servletRequest = context && context.httpServletRequest;
			var value = servletRequest ? servletRequest.getHeader(name) : null;
			return value === null || value === undefined ? "" : String(value).trim();
		} catch (e) {
			return "";
		}
	}

	function subagentInputs(value) {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			return copyJson(value);
		}
		if (typeof value === "string" && /^\s*\{/.test(value)) {
			try {
				var parsed = JSON.parse(value);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					return parsed;
				}
			} catch (e) {
			}
		}
		return {};
	}

	function subagentRelayError(code, message, hint, details) {
		var error = new Error(message);
		error.code = code;
		error.hint = hint;
		error.details = details;
		return error;
	}

	// The subagent-run request the relay forwards, or the refusal answered before any hop: {request} or {error}.
	function relayedSubagentRequest(ctx, request) {
		var params = request && request.params || {};
		if (String(params.name || "") !== "subagent-run") {
			return { request: request };
		}
		var args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
		var profile = String(args.profile === undefined || args.profile === null ? "" : args.profile).trim().toLowerCase();
		if (String(args.runId || "").trim() !== "" || profile === "" || profile === "verifier") {
			return { request: request };
		}
		if (profile !== "constructor") {
			return { error: subagentRelayError("SUBAGENT_PROFILE_NOT_RELAYED", "subagent-run profile " + profile + " is not available through the Flow MCP.",
				"Use profile verifier for a browser proof, or constructor with inputs.scope backend or frontend for one side of a parallel build.",
				{ profile: profile, profiles: RELAYED_SUBAGENT_PROFILES.slice(0) }) };
		}
		if (relayRequestHeader(ctx, "X-Convertigo-Subagent-Run") !== "" || relayRequestHeader(ctx, "X-Convertigo-Subagent-Scope") !== "") {
			return { error: subagentRelayError("SUBAGENT_NESTED", "A constructor sub-agent does not start sub-agents: the main agent does.",
				"Put what is missing in the openIssues of your report.", { profile: profile }) };
		}
		var inputs = subagentInputs(args.inputs);
		var project = String(inputs.project || "").trim();
		var scope = String(inputs.scope || "").trim().toLowerCase();
		if (project === "" || FLOW_CONSTRUCTOR_SCOPES.indexOf(scope) === -1) {
			return { error: subagentRelayError("SUBAGENT_SCOPE_REQUIRED", "A Flow constructor needs inputs.project and inputs.scope backend or frontend: " +
				"the one project it builds in and the side of it that it owns.",
				"subagent-run({profile:\"constructor\", task, inputs:{project:\"<project>\", scope:\"backend\", contracts, notes}, waitSec:5}), " +
				"then the same with scope frontend; see the Parallel Build of flow://guide/fullstack-paperboard.",
				{ project: project, scope: scope, scopes: FLOW_CONSTRUCTOR_SCOPES.slice(0) }) };
		}
		if (isServerProject(ctx, project)) {
			return { error: subagentRelayError("SUBAGENT_SCOPE_REQUIRED", "A Flow constructor never builds in " + project + ", the project serving this MCP endpoint.",
				"Pass the application project in inputs.project.", { project: project }) };
		}
		inputs.project = project;
		inputs.scope = scope;
		inputs.pack = "flow";
		var forwardedArgs = copyJson(args);
		forwardedArgs.profile = "constructor";
		forwardedArgs.inputs = inputs;
		var forwarded = copyJson(request);
		forwarded.params = copyJson(params);
		forwarded.params.arguments = forwardedArgs;
		return { request: forwarded };
	}

	// The text content of a relayed answer that carries structuredContent only. A sub-agent or a verification still
	// running must say how to collect it, also to a client that shows the text content alone.
	function relaySummary(value) {
		if (value && typeof value === "object" && !value.error && /^(?:running|finished)$/.test(String(value.status || "")) &&
				(value.runId || value.verificationId)) {
			var id = value.runId ? "runId=" + value.runId : "verificationId=" + value.verificationId;
			var parts = ["status=" + value.status, id];
			if (value.status === "running") {
				if (value.message) parts.push(String(value.message));
				else parts.push("Call the same tool again with " + (value.runId ? "runId" : "verificationId") + " alone to wait for the report.");
			} else {
				var report = value.report && typeof value.report === "object" ? value.report : value;
				if (report.verdict) parts.push("verdict=" + report.verdict);
				if (report.summary) {
					var summary = String(report.summary);
					parts.push(summary.length > 600 ? summary.substring(0, 600) + "…" : summary);
				}
			}
			parts.push("Use structuredContent for data.");
			return parts.join(". ");
		}
		return textSummary(value === undefined ? {} : value);
	}

	// The relayed tool descriptors, or [] when lib_ConvertigoMCP does not answer (the Flow tools stay available).
	function legacyRelayTools(ctx) {
		if (!legacyRelayEnabled()) {
			return [];
		}
		// Catalog visibility depends on the current caller and feedback consent: a
		// tools/list is kept per caller, relayed headers and consent inputs only
		// (legacyRelayRevision). tools/call still makes only one hop.
		var tools = [];
		try {
			var answer = legacyPost(ctx, { jsonrpc: "2.0", id: "flow-relay-list", method: "tools/list", params: {} }, 30);
			tools = (answer && answer.result && answer.result.tools || []).filter(function (tool) {
				return tool && LEGACY_RELAY_TOOLS[String(tool.name)] === true;
			}).map(function (tool) {
				var copy = neutralRelayDescriptions(JSON.parse(JSON.stringify(tool)));
				copy.description = String(copy.description || "") + LEGACY_RELAY_NOTE;
				if (String(copy.name) === "browser-verify") return relayedBrowserDescriptor(copy);
				return String(copy.name) === "subagent-run" ? relayedSubagentDescriptor(copy) : copy;
			});
		} catch (e) {
			tools = [];
		}
		return tools;
	}

	// The relay answers in JSON only: it sends no progress while lib_ConvertigoMCP works. An MCP client drops a call that
	// sends no response or progress for 300 s (Claude Code), and the agent then reads nothing of why: a relayed
	// requestable-execute waited for a busy Studio and was dropped after 300 s, then the next relayed call too. The relay
	// gives up first and says so.
	var LEGACY_RELAY_TIMEOUT_DEFAULT = 240;

	function legacyRelayTimeoutSeconds() {
		var value = parseInt(String(System.getProperty("convertigo.flow.mcp.legacyRelayTimeoutSeconds", "")), 10);
		return isNaN(value) ? LEGACY_RELAY_TIMEOUT_DEFAULT : Math.max(5, Math.min(value, 290));
	}

	function relayTimedOut(error) {
		try {
			if (error && error.javaException instanceof Packages.java.net.http.HttpTimeoutException) {
				return true;
			}
		} catch (_noJavaException) {
		}
		return /HttpTimeoutException|HttpConnectTimeoutException|request timed out/i.test(String(error && error.message || error));
	}

	// The project a relayed call names: project, or the project of a requestable <project>.<name>.
	function relayedProjectName(request) {
		var args = request && request.params && request.params.arguments || {};
		if (typeof args.project === "string" && args.project.trim() !== "") {
			return args.project.trim();
		}
		var requestable = typeof args.requestable === "string" ? args.requestable.trim() : "";
		return /^[A-Za-z0-9_-]+\./.test(requestable) ? requestable.substring(0, requestable.indexOf(".")) : "";
	}

	/**
	 * What a relayed call that timed out may have waited for, read without waiting more than about 1 s: whether the
	 * Studio UI thread runs a task, and whether the change flag lock of the project is held. Every field is best effort.
	 */
	function studioWaitDiagnostics(projectName) {
		var out = { studioMode: studioMode() };
		if (projectName) {
			try {
				var lock = sharedMap("lib_flow_mcp.projectFlagLocks").get(String(projectName));
				out.projectFlagLock = lock == null ? { locked: false } : { locked: lock.isLocked() === true, queued: Number(lock.getQueueLength()) };
			} catch (_noFlagLock) {
			}
		}
		if (!out.studioMode) {
			return out;
		}
		try {
			var concurrent = Packages.java.util.concurrent;
			var ran = new concurrent.CountDownLatch(1);
			Packages.com.twinsoft.convertigo.eclipse.ConvertigoPlugin.asyncExec(new Packages.java.lang.Runnable({ run: function () {
				ran.countDown();
			}}));
			out.studioUiThreadResponsive = ran.await(1, concurrent.TimeUnit.SECONDS) === true;
		} catch (_noStudioProbe) {
		}
		return out;
	}

	function legacyRelayTimeoutError(request, waited) {
		var name = String(request && request.params && request.params.name || "");
		var details = { tool: name, waitedSeconds: waited };
		var studio = studioWaitDiagnostics(relayedProjectName(request));
		Object.keys(studio).forEach(function (key) {
			details[key] = studio[key];
		});
		var busyStudio = studio.studioUiThreadResponsive === false;
		var error = new Error("The Convertigo MCP did not answer " + name + " within " + waited + " s, so the Flow MCP stopped waiting. " +
			"The call may still be running on the server" + (busyStudio ? ", and the Studio UI thread is not answering: the Studio is busy " +
			"(a Project Explorer reload, or a dialog waiting for an answer)." : "."));
		error.code = "LEGACY_RELAY_TIMEOUT";
		error.hint = (busyStudio ? "Look at the Studio window and answer any dialog. " : "") +
			"Do not send the same call again at once: the relayed tools wait behind it. Prove a Flow with code-run, or with its HTTP " +
			"URL (.json?__sequence=<name>), then retry " + name + " once" + (busyStudio ? " when the Studio answers again." : ".");
		if (name === "subagent-run") {
			var runId = String(request.params.arguments && request.params.arguments.runId || "");
			if (runId) details.runId = runId;
			error.hint = runId ? "Call subagent-run with runId alone: " + runId + ". The existing run continues; do not start a second run."
				: "The start may still be running. Do not repeat the task. Recover runId from its activity or SUBAGENT_BUSY, then call subagent-run with runId alone.";
		}
		error.details = details;
		return error;
	}

	function legacyRelayCall(ctx, request) {
		var subagent = relayedSubagentRequest(ctx, request);
		if (subagent.error) {
			return toolError(request, subagent.error, ctx);
		}
		var timeoutSeconds = legacyRelayTimeoutSeconds();
		try {
			if (String(request.params && request.params.name) === "subagent-run") {
				// Each hop collects a bounded slice of the existing asynchronous run. Never stretch an HTTP call
				// across the verifier budget: return its runId and activity, then collect the same run again.
				subagent.request = copyJson(subagent.request);
				timeoutSeconds = Math.max(timeoutSeconds, 10);
				var args = subagent.request.params.arguments || {};
				subagent.request.params.arguments = args;
				if (args.waitSec !== undefined || timeoutSeconds < 55) args.waitSec = Math.max(5, Math.min(argInt(args.waitSec, 50, 5, 280), 50, Math.max(5, timeoutSeconds - 5)));
				var inputs = subagentInputs(args.inputs);
				if (!args.runId && String(args.profile || "verifier") === "verifier" && /\/gw\//.test(String(inputs.url || args.url || ""))) {
					var project = String(inputs.project || args.project || "").trim();
					if (!project) {
						throw subagentRelayError("VERIFIER_PROJECT_REQUIRED", "A Flow dev viewer needs inputs.project before verification.",
							"Pass inputs.project with the application project and inputs.url with its viewer openUrl.", { property: "inputs.project" });
					}
					var prepared = prepareToolArguments(ctx, { params: { name: "frontend-svelte-action", arguments: {
						project: project, actionId: "dev.ensure", wait: true
					} } }, {});
					var ensured = ctx.callBlock("authoring.action", prepared, { trace: false });
					if (!ensured || ensured.ok !== true || ensured.pending === true) {
						throw subagentRelayError("VERIFIER_DEV_UNAVAILABLE", "The application dev viewer is not ready.",
							"Run frontend-svelte-action dev.ensure for " + project + " and resolve its diagnostics before verifying.", ensured || {});
					}
					if (ensured.openUrl) { inputs.url = String(ensured.openUrl); args.inputs = inputs; }
				}
			}
			var answer = legacyPost(ctx, {
				jsonrpc: "2.0",
				id: request.id === undefined ? null : request.id,
				method: "tools/call",
				params: subagent.request.params || {}
			}, timeoutSeconds);
			answer.id = request.id === undefined ? null : request.id;
			// The relay asks jsonOnly=true, and lib_ConvertigoMCP then answers a successful call with structuredContent
			// only. content is required in a CallToolResult: the MCP Python SDK (Vibe) rejects such an answer and the
			// agent sees a transport failure. The summary leaves the data in structuredContent, as for the Flow tools.
			if (answer && answer.result && Object.prototype.toString.call(answer.result.content) !== "[object Array]") {
				answer.result.content = [{
					type: "text",
					text: relaySummary(answer.result.structuredContent)
				}];
			}
			return answer;
		} catch (error) {
			if (error && /^VERIFIER_/.test(String(error.code || ""))) return toolError(request, error, ctx);
			if (relayTimedOut(error)) {
				return toolError(request, legacyRelayTimeoutError(request, timeoutSeconds), ctx);
			}
			return toolError(request, new Error("Convertigo MCP relay failed for " + (request.params && request.params.name) +
				": " + (error && error.message || error) + ". Check that lib_ConvertigoMCP is loaded on this server."), ctx);
		}
	}

	// A constructor sub-agent of a parallel build (relayed subagent-run, profile constructor, Flow pack) owns one side of
	// its project: its session sends X-Convertigo-Subagent-Scope. Its writes to the other side, the project-level
	// operations and the browser proofs are refused: the main agent integrates, saves, proves and keeps PROGRESS.md.
	var SUBAGENT_SCOPES = { backend: true, frontend: true };
	var SUBAGENT_PROGRESS_FILE = "docs/generated/PROGRESS.md";
	var MAIN_AGENT_TOOLS = {
		"browser-verify": true, "flow-project-bootstrap": true, "flow-project-remove": true, "marketplace-import": true,
		"flow-project-symbol-set": true, "project-save": true, "report-create": true, "scheduler-apply": true, "subagent-run": true
	};
	var BACKEND_WRITE_TOOLS = {
		"flow-entity-model-set": true,
		"flow-block-code-patch": true, "flow-block-code-set": true, "flow-block-mock": true, "flow-code-discard": true,
		"flow-code-patch": true, "flow-code-promote": true, "flow-code-set": true, "flow-fullsync-scaffold": true,
		"flow-object-remove": true, "flow-schema-reset": true, "flow-sync-inputs": true
	};
	var FRONTEND_WRITE_TOOLS = {
		"frontend-svelte-action": true, "frontend-svelte-asset-import": true, "frontend-svelte-code-patch": true,
		"frontend-svelte-code-set": true, "frontend-svelte-mutate": true
	};

	function frontendSourceArguments(args) {
		return !!(args.sourceFile || args.sourcePath || String(args.kind || args.type || "").toLowerCase() === "source" ||
			(String(args.target || "").toLowerCase() === "frontend" && !args.block && !args.blockName));
	}

	// The side a tool call writes: "backend", "frontend", "main" (the main agent's own operations) or "" (a read, or
	// a write that belongs to no side).
	function subagentCallSide(name, args) {
		args = args || {};
		if (MAIN_AGENT_TOOLS[name] === true) {
			return "main";
		}
		if (BACKEND_WRITE_TOOLS[name] === true) {
			return "backend";
		}
		if (FRONTEND_WRITE_TOOLS[name] === true) {
			return "frontend";
		}
		if (/^code-(?:set|patch|promote|discard)$/.test(name)) {
			return frontendSourceArguments(args) ? "frontend" : "backend";
		}
		if (name === "authoring-mutate") {
			var surface = String(args.surface || "").toLowerCase();
			if (surface === "frontend" || frontendSourceArguments(args)) {
				return "frontend";
			}
			return surface === "" ? "" : "backend";
		}
		if (name === "flow-resource-patch" || name === "flow-resource-delete") {
			if (String(args.scope || "").toLowerCase() === "engine-internal") {
				return "main";
			}
			var path = String(args.path || "").replace(/\\/g, "/").replace(/^(?:\.\/|\/)+/, "");
			if (path === SUBAGENT_PROGRESS_FILE) {
				return "main";
			}
			if (path.indexOf("_flow/frontbuilder/") === 0) {
				return "frontend";
			}
			return path.indexOf("_flow/") === 0 || path.indexOf("libs/") === 0 ? "backend" : "";
		}
		return "";
	}

	// The refusal of a call outside the scope of the constructor session that sends it, else null.
	function subagentScopeRefusal(ctx, request) {
		var scope = relayRequestHeader(ctx, "X-Convertigo-Subagent-Scope").toLowerCase();
		if (SUBAGENT_SCOPES[scope] !== true) {
			return null;
		}
		var name = toolName(request || {});
		var side = subagentCallSide(name, toolArguments(request || {}));
		if (side === "" || side === scope) {
			return null;
		}
		var error = new Error(side === "main"
			? name + " belongs to the main agent: it integrates both sides, saves the project, runs the browser proofs and keeps " +
				SUBAGENT_PROGRESS_FILE + ". This constructor owns the " + scope + " only."
			: "This constructor owns the " + scope + " of the project: " + name + " writes the " + side +
				", which another constructor or the main agent owns.");
		error.code = "SUBAGENT_SCOPE";
		error.hint = scope === "frontend"
			? "Bind to the Flows as their contract says; put a missing or wrong field (Flow, field, why) in the openIssues of your report."
			: "Keep the agreed inputs and output fields; put what the pages need from the frontend in the openIssues of your report.";
		error.details = { scope: scope, tool: name, side: side };
		return error;
	}

	// Stable results: what tools/list, the guides and skills (resources/read, flow-resource-get of a flow:// uri),
	// flow-catalog and authoring-palette answer stays the same while nothing it is computed from changes. The result is
	// kept as JSON text for every runtime of the server and answered again in the envelope of the new request, with its
	// id. It is kept and served after authentication only: every key starts with the caller jwt.guardRequest records on
	// the HTTP request, a server-side attribute a client cannot send; a request without one (refused, or an expired
	// leased token let through for its handshake) is neither answered from the store nor kept. Each key holds what its
	// result depends on (stableToolsListKey, stableResourceKey, stableToolLookup); a time-to-live bounds what no revision
	// tells (files changed outside Convertigo, the legacy endpoint), any other tool call drops the project answers and
	// flow-cache-clear drops them all. Errors, partial answers, mutations, runs and logs are never kept.
	var STABLE_RESULTS = "lib_flow_mcp.stableResults.v1";
	var STABLE_STATE = "lib_flow_mcp.stableResultsState.v1";
	var STABLE_CALLER_ATTRIBUTE = "com.convertigo.flow.mcp.caller";
	var STABLE_MAX_ENTRIES = 256;
	var STABLE_MAX_CHARS = 8 * 1024 * 1024;
	var STABLE_TTL_MS = { "tools/list": 120000, resource: 600000, tool: 30000 };
	// The request headers an answer may depend on besides its arguments: its presentation (Vibe errors, public URLs,
	// viewer and reveal modes), the agent host and the sub-agent session.
	var STABLE_HEADERS = ["User-Agent", "Host", "X-Forwarded-Proto", "X-Forwarded-Host", "X-Convertigo-Agent-Provider",
		"X-Convertigo-Agent-Profile", "X-Convertigo-Guidance-Version", "Convertigo-Guidance-Version", "MCP-Protocol-Version",
		"X-Convertigo-Viewer-Debug-Port", "X-Convertigo-Reveal-Mode", "X-Convertigo-Subagent-Run", "X-Convertigo-Subagent-Scope"];
	// The tools kept, by the capability they run (mcp.tool.run).
	var STABLE_TOOLS = { "flow-catalog": "block.list", "authoring-palette": "authoring.palette", "frontend-svelte-palette": "authoring.palette" };
	// The tools that write nothing: a call of any other one (a mutation, a run, an unknown tool) drops the kept project
	// answers, which the next calls compute again.
	var STABLE_READ_TOOLS = {};
	["flow-catalog", "authoring-palette", "frontend-svelte-palette", "authoring-tree", "frontend-svelte-tree", "frontend-svelte-actions",
		"flow-block-get", "flow-block-mock-list", "flow-list", "flow-search", "flow-library-search", "flow-resource-get",
		"flow-resource-search", "flow-requestable-list", "flow-requestable-schema", "flow-cache-info", "code-get", "code-rg",
		"code-status", "code-check", "code-analyze", "tags-get", "project-list", "project-list-symbols", "log-view", "rag-query",
		"marketplace-list", "marketplace-describe", "databaseobject-schema", "databaseobject-search", "databaseobject-tree-get",
		"scheduler-list", "image-describe", "browser-verify"].forEach(function (name) {
		STABLE_READ_TOOLS[name] = true;
	});
	var STABLE_RESOURCE_URI = /^flow:\/\/(guide|skills|lib)\/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)$/;

	function sha256Hex(text) {
		var digest = Packages.java.security.MessageDigest.getInstance("SHA-256")
			.digest(new Packages.java.lang.String(String(text)).getBytes(StandardCharsets.UTF_8));
		return String(Packages.java.util.HexFormat.of().formatHex(digest));
	}

	function stableServletRequest(ctx) {
		try {
			var context = ctx && typeof ctx.convertigoContext === "function" ? ctx.convertigoContext() : null;
			return context && context.httpServletRequest || null;
		} catch (e) {
			return null;
		}
	}

	// The authenticated caller (kind, scope, user, token id), null for a request without one. A call without an HTTP
	// request is the server's own, authenticated as internal by jwt.authenticateRequest.
	function stableCaller(ctx) {
		var http = stableServletRequest(ctx);
		if (!http) {
			return "internal";
		}
		try {
			var caller = http.getAttribute(STABLE_CALLER_ATTRIBUTE);
			return caller === null || caller === undefined || String(caller) === "" ? null : String(caller);
		} catch (e) {
			return null;
		}
	}

	function stableHeaderValues(ctx, names) {
		var http = stableServletRequest(ctx);
		return names.map(function (name) {
			var value = null;
			try {
				value = http ? http.getHeader(name) : null;
			} catch (e) {
			}
			return name + "=" + (value === null || value === undefined ? "" : String(value));
		});
	}

	function stableFileFingerprint(file) {
		return file && file.isFile() ? canonicalPath(file) + "#" + file.lastModified() + ":" + file.length() : "missing";
	}

	function stableBridge() {
		try {
			var bridge = Packages.com.twinsoft.convertigo.engine.flow.FlowEngineBridge;
			return typeof bridge.cacheGeneration === "function" && typeof bridge.dataGeneration === "function" ? bridge : null;
		} catch (e) {
			return null;
		}
	}

	// The generation of the Flow caches of the server: flow-cache-clear and an engine reloaded change it.
	function stableGeneration() {
		var bridge = stableBridge();
		return bridge ? "generation:" + bridge.cacheGeneration() : "generation:none";
	}

	// What the files of a project answer: the revision of the data caches of every project (a write Convertigo is told
	// about, a project loaded, deployed or reloaded) and of this one, which follows the projects it uses.
	function stableProjectRevision(projectDir) {
		var bridge = stableBridge();
		if (!bridge) {
			return "data:none";
		}
		return "data:" + bridge.dataGeneration() + ":" + (projectDir ? bridge.metadataSourceRevision(String(projectDir)) : "");
	}

	// The code answering: the blocks of the catalog the request runs with (their files, the references and the drafts,
	// lib_flow_engine blocks.__flowCatalogFingerprint), this library, and the cache generation. Null for a catalog of no
	// known revision: nothing is then kept.
	function stableCodeRevision(ctx) {
		var catalog = ctx && ctx.blocks && ctx.blocks.__flowCatalogFingerprint;
		if (!catalog) {
			return null;
		}
		var library = api.__flowFile ? new File(String(api.__flowFile)) : null;
		return sha256Hex(String(catalog)) + "\n" + stableFileFingerprint(library) + "\n" + stableGeneration();
	}

	// The project lib_ConvertigoMCP as loaded: a reload, a deployment or an edit of its tools changes it.
	function legacyProjectRevision() {
		try {
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			if (Engine.theApp == null || Engine.theApp.databaseObjectsManager == null) {
				return "legacy:standalone";
			}
			var project = Engine.theApp.databaseObjectsManager.getLoadedProjectByName("lib_ConvertigoMCP");
			if (project == null) {
				return "legacy:absent";
			}
			var bridge = stableBridge();
			return "legacy:" + System.identityHashCode(project) + ":" + project.getVersion() + ":" + project.getLastChange() + ":" +
				(bridge ? bridge.metadataSourceRevision(String(project.getDirPath())) : "");
		} catch (e) {
			return "legacy:unknown";
		}
	}

	// What lib_ConvertigoMCP reads to list report-create (js/reporting.js resolveMode and tigoMode): the mcp.report.mode
	// and assistant.feedback.policy symbols, the Studio mode, the choice of the user in agents/feedback/settings.json and
	// the server feedback key. Null when they cannot be read: the list is then not kept.
	function feedbackConsentRevision() {
		try {
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var dbom = Engine.theApp != null ? Engine.theApp.databaseObjectsManager : null;
			var workspace = String(Engine.USER_WORKSPACE_PATH || "");
			var settings = new File(workspace, "agents/feedback/settings.json");
			var settingsDigest = !settings.isFile() ? "missing" : settings.length() > 65536 ? stableFileFingerprint(settings)
				: sha256Hex(String(new Packages.java.lang.String(Files.readAllBytes(settings.toPath()), StandardCharsets.UTF_8)));
			return ["consent", String(Engine.isStudioMode()),
				dbom ? String(dbom.getCompiledValue("${mcp.report.mode=off}")) : "",
				dbom ? String(dbom.symbolsGetValue("assistant.feedback.policy")) : "",
				settingsDigest,
				stableFileFingerprint(new File(workspace, "agents/feedback/server-key")),
				sha256Hex(String(System.getenv("TIGO_FEEDBACK_KEY") || ""))].join("\n");
		} catch (e) {
			return null;
		}
	}

	// What the descriptors relayed from lib_ConvertigoMCP depend on, null when it cannot be told: the headers relayed
	// (the bearer, the provider whose gateway tools leave its catalog, the guidance version...), the endpoint, the
	// legacy project as loaded and the feedback consent.
	function legacyRelayRevision(ctx) {
		if (!legacyRelayEnabled()) {
			return "relay:off";
		}
		var http = stableServletRequest(ctx);
		if (!http) {
			return "relay:none";
		}
		var consent = feedbackConsentRevision();
		if (consent === null) {
			return null;
		}
		var endpoint;
		try {
			endpoint = String(http.getScheme()) + "://" + Number(http.getLocalPort()) + String(http.getContextPath() || "");
		} catch (e) {
			return null;
		}
		return ["relay", endpoint].concat(stableHeaderValues(ctx, LEGACY_RELAY_HEADERS), [legacyProjectRevision(), consent]).join("\n");
	}

	function stableStore() {
		return sharedMap(STABLE_RESULTS);
	}

	function stableEpochCounter() {
		var state = sharedMap(STABLE_STATE);
		state.putIfAbsent("epoch", new Packages.java.util.concurrent.atomic.AtomicLong());
		return state.get("epoch");
	}

	function stableEntry(kind, parts, ttl) {
		return { kind: kind, entry: kind + ":" + sha256Hex(JSON.stringify(parts)), ttl: ttl };
	}

	function stableRead(key) {
		var store = stableStore();
		var kept = store.get(key.entry);
		if (kept == null) {
			return null;
		}
		if (Number(System.nanoTime()) - Number(kept.getKey().getKey()) > key.ttl * 1000000) {
			store.remove(key.entry, kept);
			return null;
		}
		return JSON.parse(String(kept.getValue()));
	}

	function stableWrite(key, value) {
		var text = JSON.stringify(value);
		if (text === undefined || text.length > STABLE_MAX_CHARS / 8) {
			return;
		}
		var Entry = Packages.java.util.AbstractMap.SimpleImmutableEntry;
		var Long = Packages.java.lang.Long;
		var store = stableStore();
		// Stored at System.nanoTime(): one clock for every runtime of the JVM, for the age and the order of the entries.
		store.put(key.entry, new Entry(new Entry(Long.valueOf(System.nanoTime()), Long.valueOf(text.length)),
			new Packages.java.lang.String(text)));
		// Bounded: the oldest entries leave first, past the count or the size.
		var entries = [];
		var chars = 0;
		var iterator = store.entrySet().iterator();
		while (iterator.hasNext()) {
			var each = iterator.next();
			var meta = each.getValue().getKey();
			entries.push({ key: each.getKey(), value: each.getValue(), at: Number(meta.getKey()), chars: Number(meta.getValue()) });
			chars += Number(meta.getValue());
		}
		entries.sort(function (a, b) { return a.at - b.at; });
		for (var i = 0, count = entries.length; i < entries.length && (count > STABLE_MAX_ENTRIES || chars > STABLE_MAX_CHARS); i++) {
			if (store.remove(entries[i].key, entries[i].value)) {
				count--;
				chars -= entries[i].chars;
			}
		}
	}

	// A result worth keeping: a success, complete, without a note meant for this call only.
	function stableSucceeded(response) {
		var result = response && !response.error ? response.result : null;
		if (!result || typeof result !== "object" || result.isError === true) {
			return false;
		}
		var data = result.structuredContent;
		return !(data && typeof data === "object" && (data.error || data.ok === false || data.partial === true ||
			data.operatorNote !== undefined || data.responseBudget !== undefined));
	}

	function stableAnswer(ctx, request, kept) {
		var response = { jsonrpc: "2.0", id: request.id === undefined ? null : request.id, result: kept.result };
		traceJsonl(ctx, "response", request, response);
		return response;
	}

	// tools/list: the Flow descriptors (blocks, this library) and the relayed ones (stableRevision of the relay), for
	// this caller, its headers and its page.
	function stableToolsListKey(ctx, request) {
		var caller = stableCaller(ctx);
		var code = caller === null ? null : stableCodeRevision(ctx);
		var relay = code === null ? null : legacyRelayRevision(ctx);
		if (relay === null) {
			return null;
		}
		var params = request.params && typeof request.params === "object" ? request.params : {};
		return stableEntry("tools/list", [caller, code, relay, String(params.cursor || ""), String(params.limit || "")]
			.concat(stableHeaderValues(ctx, STABLE_HEADERS)), STABLE_TTL_MS["tools/list"]);
	}

	// The file of a guide or skill: flow://guide/<name> and flow://skills/<skill>/SKILL in this project
	// (_flow/resources/**.md, mcp.resources.read), flow://lib/<project>/<guide> in a loaded library (libraryGuides).
	function stableResourceFile(ctx, uri) {
		var match = STABLE_RESOURCE_URI.exec(String(uri || ""));
		if (!match || /(^|\/)\.\.?(\/|$)/.test(match[2])) {
			return null;
		}
		if (match[1] === "lib") {
			var library = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(match[2]);
			if (!library || library[1] === "lib_flow_mcp") {
				return null;
			}
			var target = loadedProjectTargets().filter(function (each) { return each.project === library[1]; })[0];
			return target ? new File(String(target.projectDir), "_flow/resources/guide/" + library[2] + ".md") : null;
		}
		var root = knownProjectDir(ctx);
		return root ? new File(root, "_flow/resources/" + match[1] + "/" + match[2] + ".md") : null;
	}

	// resources/read of a guide or skill: its uri and the hash of its content, for this caller.
	function stableResourceKey(ctx, request) {
		var uri = String(request.params && request.params.uri || "");
		var file = stableResourceFile(ctx, uri);
		var caller = file && file.isFile() ? stableCaller(ctx) : null;
		var code = caller === null ? null : stableCodeRevision(ctx);
		if (code === null) {
			return null;
		}
		var content = sha256Hex(String(new Packages.java.lang.String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)));
		return stableEntry("resource", [caller, uri, canonicalPath(file), content, code], STABLE_TTL_MS.resource);
	}

	// The kept answer of a request of the mcp.stable block (tools/list, resources/read), or the key to keep it under,
	// computed before its answer; null when it is not kept.
	function stableLookup(ctx, request) {
		var method = request && request.method;
		var key = method === "tools/list" ? stableToolsListKey(ctx, request)
			: method === "resources/read" ? stableResourceKey(ctx, request)
				: null;
		if (!key) {
			return null;
		}
		var kept = stableRead(key);
		return { key: key, response: kept ? stableAnswer(ctx, request, kept) : null };
	}

	// flow-catalog and authoring-palette: their prepared arguments (the target project, its working copies and tag
	// context), what the files of the project answer, the mutations made through this endpoint, the code, the caller
	// and its headers. A call with a deadline of its own is not kept.
	function stableToolLookup(ctx, request, target, args) {
		var name = toolName(request);
		if (STABLE_TOOLS[name] !== target || !args || args.answerBefore !== undefined && args.answerBefore !== null &&
				String(args.answerBefore) !== "") {
			return null;
		}
		var caller = stableCaller(ctx);
		var code = caller === null ? null : stableCodeRevision(ctx);
		if (code === null) {
			return null;
		}
		var key = stableEntry("tool", [name, target, caller, sha256Hex(JSON.stringify(args)), stableProjectRevision(args.projectDir),
			String(stableEpochCounter().get()), code].concat(stableHeaderValues(ctx, STABLE_HEADERS)), STABLE_TTL_MS.tool);
		var kept = stableRead(key);
		return { key: key, response: kept ? stableAnswer(ctx, request, kept) : null };
	}

	function stableKeep(ctx, request, lookup, response) {
		if (lookup && lookup.key && !lookup.response && stableSucceeded(response)) {
			stableWrite(lookup.key, { result: response.result });
		}
	}

	function stableClear(kind) {
		var store = stableStore();
		if (!kind) {
			store.clear();
			return;
		}
		var keys = store.keySet().toArray();
		for (var i = 0; i < keys.length; i++) {
			if (String(keys[i]).indexOf(kind + ":") === 0) {
				store.remove(keys[i]);
			}
		}
	}

	// After a tools/call: a tool that may write drops the kept project answers; flow-cache-clear drops them all.
	// An omitted revision means the last source this authenticated conversation actually read/wrote,
	// never the source at write time. The existing writer still compares it (and rechecks under its lock).
	// Use the bounded, expiring server store; unidentified clients keep the explicit-revision contract.
	function sourceObservationKey(ctx, args, request) {
		var http = stableServletRequest(ctx), caller = stableCaller(ctx), conversation = "", subagent = "";
		if (!http || !caller) return null;
		try { conversation = String(http.getHeader("X-Convertigo-Conversation-Id") || http.getHeader("Mcp-Session-Id") || ""); } catch (e) {}
		if (!conversation) return null;
		try { subagent = String(http.getHeader("X-Convertigo-Subagent-Run") || ""); } catch (e) {}
		var target = args.sourceFile ? "source:" + String(args.sourceFile).replace(/\\/g, "/")
			: /flow-block-code-/.test(toolName(request)) ? "block:" + String(args.block || args.name || "") + ":" + String(args.target || "backend") : "flow:" + String(args.name || args.flow || args.qname || "").split(".").pop();
		if (target === "flow:" || !args.projectDir) return null;
		return stableEntry("source-observation", [caller, conversation, subagent, canonicalPath(new File(String(args.projectDir))), target,
			stableGeneration()], 60 * 60 * 1000);
	}

	function observedSourceRevision(ctx, request, args) {
		if (!/(?:^|-)code-(?:set|patch)$/.test(toolName(request)) || args.revision || args.baseRevision || args.baseHash) return false;
		var key = sourceObservationKey(ctx, args, request), observation = key && stableRead(key);
		if (!observation || !observation.revision) return false;
		args.revision = observation.revision;
		return true;
	}

	function rememberSourceRevision(ctx, request, args, result) {
		if (!result || !result.revision) return;
		var name = toolName(request);
		if (!/(?:^|-)code-(?:get|set|patch)$/.test(name) ||
			!(result.written === true || /-get$/.test(name) && result.ok === true)) return;
		if (result.sourceFile && !args.sourceFile) args = Object.assign({}, args, {sourceFile:result.sourceFile});
		var key = sourceObservationKey(ctx, args, request);
		if (key) stableWrite(key, {revision: String(result.revision)});
	}

	function stableToolCalled(name) {
		name = String(name || "");
		if (STABLE_READ_TOOLS[name] === true) {
			return;
		}
		stableEpochCounter().incrementAndGet();
		stableClear(name === "flow-cache-clear" ? "" : "tool");
	}

	var api = {
		// Low-level host services for the private mcp.experience block. No ACE policy in this protocol helper.
		_experienceHost: function (ctx) {
			return { sharedMap: sharedMap, hash: sha256Hex, http: stableServletRequest(ctx), caller: stableCaller(ctx),
				setting: symbolValue("flow.mcp.experience") || configMcpValue(ctx, "experience") || "on",
				session: configMcpValue(ctx, "experienceSession"), engineDir: knownEngineDir(), projectDir: knownProjectDir(ctx),
				targets: loadedProjectTargets, resolveProject: resolveProjectDir };
		},
		jsonRpcResult: jsonRpcResult,
		jsonRpcError: jsonRpcError,
		libraryGuides: libraryGuides,
		libraryGuideText: libraryGuideText,
		legacyRelayTool: legacyRelayTool,
		legacyRelayTools: legacyRelayTools,
		legacyRelayCall: legacyRelayCall,
		subagentScopeRefusal: subagentScopeRefusal,
		_subagentCallSide: subagentCallSide,
		acceptNotification: acceptNotification,
		parseRequest: parseRequest,
		requestValue: requestValue,
		toolArguments: toolArguments,
		prepareToolArguments: prepareToolArguments,
		observedSourceRevision: observedSourceRevision,
		rememberSourceRevision: rememberSourceRevision,
		_frontendPublicBaseUrl: frontendPublicBaseUrl,
		qualifyAuthoringPath: qualifyAuthoringPath,
		qualifyAuthoringResult: qualifyAuthoringResult,
		phaseBudget: phaseBudget,
		withNamedFlowSource: withNamedFlowSource,
		searchWorkspace: searchWorkspace,
		registerFlowDbo: registerFlowDbo,
		_sessionReport: sessionReport,
		_accessibilityReport: accessibilityReport,
		syncFlowInputsDbo: syncFlowInputsDbo,
		_markFastSavedClean: markFastSavedClean,
		applyNamedFlowMutation: applyNamedFlowMutation,
		toolResponse: toolResponse,
		toolError: toolError,
		toolOutputSchema: toolOutputSchema,
		toolResult: toolResult,
		persistSourceMutationResult: persistSourceMutationResult,
		sourceStore: sourceStore,
		queueSourceNotifications: queueSourceNotifications,
		withSourceDrafts: withSourceDrafts,
		pendingStudioDrafts: pendingStudioDrafts,
		assertProjectSaveAllowed: assertProjectSaveAllowed,
		assertNoUnsavedProjectChanges: assertNoUnsavedProjectChanges,
		unsavedProjectChanges: unsavedProjectChanges,
		withProjectFlagLock: withProjectFlagLock,
		_reloadNotingProjectFlag: reloadNotingProjectFlag,
		_lockProjectFlags: lockProjectFlags,
		_studioReloadNoted: studioReloadNoted,
		_queueStudioReload: queueStudioReload,
		_studioReloadObject: studioReloadObject,
		_studioReloadFrontend: studioReloadFrontend,
		assertFlowNameFree: assertFlowNameFree,
		frontendCreateSourceSpec: frontendCreateSourceSpec,
		_enrichSveltePaletteMutations: enrichSveltePaletteMutationsForArgs,
		studioRefreshFlowEngine: studioRefreshFlowEngine,
		finalizeResponse: finalizeResponse,
		sanitizeForMcp: sanitizeForMcp,
		traceJsonl: traceJsonl,
		runToolBlock: runToolBlock,
		notification: notification,
		stableLookup: stableLookup,
		stableToolLookup: stableToolLookup,
		stableKeep: stableKeep,
		stableToolCalled: stableToolCalled,
		_stableClear: stableClear,
		_stableSize: function () { return Number(stableStore().size()); },
		_normalizeConvertigoYamlObjectHeaders: normalizeConvertigoYamlObjectHeaders,
		_normalizeConvertigoFlowProjectVersion: normalizeConvertigoFlowProjectVersion
	};
	return api;
}())
