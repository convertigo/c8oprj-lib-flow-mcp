const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:progress-check",
  "tags": [
    "mcp",
    "app",
    "progress",
    "paperboard"
  ],
  "description": "Summarizes Flow full-stack paperboard progress from stable MCP-visible signals.",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Target Convertigo project name."
    },
    "qname": {
      "kind": "text",
      "type": "string",
      "description": "Optional executable Flow qname that should exist."
    },
    "engineSource": {
      "kind": "text",
      "type": "string",
      "description": "Optional FlowEngine source override for standalone tests or draft inspection."
    },
    "includeFrontend": {
      "kind": "literal",
      "type": "boolean",
      "default": true,
      "description": "Inspect the Svelte frontend builder and route tree."
    },
    "mode": {
      "kind": "text",
      "type": "string",
      "default": "poc",
      "enum": [
        "poc",
        "hardening"
      ],
      "description": "POC stops at a runnable preview. Hardening adds schema, debt, mock and structural acceptance."
    },
    "detail": {
      "kind": "text",
      "type": "string",
      "default": "compact",
      "enum": [
        "compact",
        "full"
      ],
      "description": "Response detail. Compact keeps actionable diagnostics and counts; full includes paperboard and binding inventories."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response."
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  },
  "runtime": "rhino",
  "display": "tool flow-app-progress -> {{ input.out }}"
}

(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function boolValue(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		if (typeof value === "boolean") {
			return value;
		}
		return String(value) === "true";
	}

	function arrayValue(value) {
		if (!value) {
			return [];
		}
		return Object.prototype.toString.call(value) === "[object Array]" ? value : [];
	}

	function objectValue(value) {
		return value && typeof value === "object" && Object.prototype.toString.call(value) !== "[object Array]" ? value : null;
	}

	function flowName(flow) {
		return String(flow && (flow.qname || flow.flowQName || flow.name || flow.id) || "");
	}

	function flowLocalName(value, project) {
		value = String(value || "").replace(/^\.+/, "");
		project = String(project || "");
		if (project && value.indexOf(project + ".") === 0) {
			return value.substring(project.length + 1);
		}
		var parts = value.split(".").filter(function (part) {
			return !!part;
		});
		return parts.length ? parts[parts.length - 1] : value;
	}

	function flowMatchesQName(flow, wanted, project) {
		wanted = String(wanted || "").trim();
		if (!wanted) {
			return true;
		}
		var qname = String(flow && flow.qname || "");
		var name = String(flow && flow.name || "");
		var wantedLocal = flowLocalName(wanted, project);
		var qnameLocal = flowLocalName(qname, project);
		return qname === wanted
			|| name === wanted
			|| (project && qname === String(project) + "." + wantedLocal)
			|| name === wantedLocal
			|| qnameLocal === wantedLocal;
	}

	function compactFlows(flows) {
		return flows.map(function (flow) {
			return {
				qname: flowName(flow),
				name: flow.name || flow.id || "",
				private: flow["private"] === true,
				sample: /^sample_/.test(String(flow.name || flow.id || flowName(flow)))
			};
		}).filter(function (flow) {
			return flow.qname || flow.name;
		});
	}

	function isMock(block) {
		if (!block) {
			return false;
		}
		if (block.mock === true) {
			return true;
		}
		var tags = block.tags || [];
		for (var i = 0; i < tags.length; i++) {
			if (String(tags[i]).toLowerCase() === "mock") {
				return true;
			}
		}
		return false;
	}

	function compactMock(block) {
		return {
			block: block.blockId || block.block || block.name || "",
			description: block.description || block.desc || "",
			outputs: block.outputs || {},
			properties: block.properties || block.props || {}
		};
	}

	function blockCallPattern(blockId) {
		return new RegExp("(^|[^A-Za-z0-9_$])" + String(blockId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(");
	}

	function projectBlockSources(projectDir) {
		var File = Packages.java.io.File;
		var FileUtils = Packages.org.apache.commons.io.FileUtils;
		var root = new File(String(projectDir || ""), "libs/flow/blocks");
		var sources = [];
		function visit(directory, prefix) {
			var files = directory && directory.listFiles();
			if (!files) return;
			for (var i = 0; i < files.length; i++) {
				var file = files[i];
				var relative = prefix ? prefix + "/" + file.getName() : String(file.getName());
				if (file.isDirectory()) visit(file, relative);
				else if (/\.block\.js$/.test(relative)) {
					sources.push({
						block: relative.replace(/\.block\.js$/, "").replace(/\//g, "."),
						code: String(FileUtils.readFileToString(file, "UTF-8"))
					});
				}
			}
		}
		visit(root, "");
		return sources.sort(function (a, b) { return a.block.localeCompare(b.block); });
	}

	function backendSourceCorpus(ctx, args, flows, blocks) {
		var sources = [];
		arrayValue(flows).forEach(function (flow) {
			try {
				var source = ctx.flowCodeGet({
					projectDir: args.projectDir,
					qname: flow.qname || "",
					name: flow.name || "",
					draft: false
				});
				if (source && source.code) sources.push(String(source.code));
			} catch (_ignoredFlow) {
			}
		});
		arrayValue(blocks).forEach(function (block) {
			if (block && block.code) sources.push(String(block.code));
		});
		return sources.join("\n");
	}

	function unusedProjectBlocks(ctx, args, flows) {
		var blocks = projectBlockSources(args.projectDir);
		var corpus = backendSourceCorpus(ctx, args, flows, blocks);
		return blocks.filter(function (block) {
			return !blockCallPattern(block.block).test(corpus);
		}).map(function (block) { return block.block; });
	}

	function collectBindingOutputRoots(value, actionIds, roots) {
		if (!value || typeof value !== "object") return;
		if (Object.prototype.toString.call(value) === "[object Array]") {
			value.forEach(function (item) { collectBindingOutputRoots(item, actionIds, roots); });
			return;
		}
		if (value.mode === "source" && value.source && value.source.category === "requestable" &&
			actionIds[String(value.source.actionId || "")]) {
			var path = arrayValue(value.path);
			if (!path.length) roots["*"] = true;
			else if (path[0] && path[0].kind === "property") roots[String(path[0].name || "")] = true;
		}
		Object.keys(value).forEach(function (key) {
			collectBindingOutputRoots(value[key], actionIds, roots);
		});
	}

	function frontendOutputRoots(frontend, auditQName, project) {
		var actionIds = {};
		var paperboard = frontend && frontend.paperboard || {};
		arrayValue(paperboard.actions).forEach(function (action) {
			if (flowMatchesQName({ qname: action.requestable, name: action.requestable }, auditQName, project)) {
				actionIds[String(actionResultId(action) || action.id || "")] = true;
			}
		});
		var roots = {};
		arrayValue(paperboard.dataSources).forEach(function (source) { collectBindingOutputRoots(source, actionIds, roots); });
		arrayValue(paperboard.blocks).forEach(function (block) { collectBindingOutputRoots(block, actionIds, roots); });
		return roots;
	}

	function unusedFrontendOutputs(ctx, mcp, args, frontend, auditQName) {
		if (!auditQName || !frontend || frontend.checked !== true) return [];
		try {
			var output = ctx.outputSchemaSource(mcp.withNamedFlowSource(ctx, {
				project: args.project,
				projectDir: args.projectDir,
				qname: auditQName,
				detail: "full"
			}));
			var schema = output && (output.schema || output.effective || output.sources && output.sources.effective) || {};
			var properties = schema.properties || {};
			var used = frontendOutputRoots(frontend, auditQName, args.project);
			if (used["*"]) return [];
			return Object.keys(properties).filter(function (name) { return !used[name]; }).sort();
		} catch (_ignored) {
			return [];
		}
	}

	function walk(node, visitor) {
		if (!node) {
			return;
		}
		visitor(node);
		var children = (node.children || []).concat(node.items || []);
		for (var i = 0; i < children.length; i++) {
			walk(children[i], visitor);
		}
	}

	function nodeDefinition(node) {
		var value = node && node.definition;
		var definition = {};
		if (value && typeof value === "object") {
			Object.keys(value).forEach(function (key) { definition[key] = value[key]; });
		} else if (value) {
			try {
				definition = JSON.parse(String(value));
			} catch (ignored) {
			}
		}
		var info = node && node.info;
		if (info && typeof info !== "object") {
			try {
				info = JSON.parse(String(info));
			} catch (ignoredInfo) {
				info = null;
			}
		}
		if (info && typeof info === "object") {
			["sourcePath", "sourceRelativePath", "sourceMutationPath", "sourcePropertyMutationPaths"].forEach(function (key) {
				if (definition[key] === undefined && info[key] !== undefined) {
					definition[key] = info[key];
				}
			});
			if (definition.sourceFile === undefined && info.file !== undefined) {
				definition.sourceFile = info.file;
			}
		}
		return definition;
	}

	function addLimited(list, item, limit) {
		if (!item || list.length >= limit) {
			return;
		}
		list.push(item);
	}

	function visibleLabel(node, definition) {
		return String(definition.label || definition.title || definition.text || node.summary || definition.id || node.name || "");
	}

	function lowerFirst(value) {
		value = String(value || "");
		return value ? value.charAt(0).toLowerCase() + value.substring(1) : "";
	}

	function requestableFlowName(requestable) {
		var parts = String(requestable || "").split(".").filter(function (part) {
			return !!part;
		});
		return parts.length ? parts[parts.length - 1] : "";
	}

	function actionResultId(action) {
		return String(action.target || action.id || action.backendCall || action.clientAction || lowerFirst(requestableFlowName(action.requestable)) || "");
	}

	function fullSyncOperation(type, mode) {
		if (type === "FullSyncGet") {
			return "get";
		}
		if (type === "FullSyncView") {
			return "view";
		}
		if (type !== "FullSyncSync") {
			return "";
		}
		return mode === "pull" ? "replicate_pull" : mode === "push" ? "replicate_push" : "sync";
	}

	function schemaPaths(schema) {
		var paths = [];
		var arrayPaths = [];
		var leafPaths = [];
		function add(list, value) {
			if (value && list.indexOf(value) === -1) {
				list.push(value);
			}
		}
		function walkSchema(value, path) {
			value = value || {};
			if (path) {
				add(paths, path);
			}
			if (value.type === "array" || value.items) {
				add(arrayPaths, path);
				walkSchema(value.items || {}, path ? path + "[0]" : "[0]");
				return;
			}
			var properties = value.properties || {};
			var keys = Object.keys(properties);
			if (keys.length) {
				keys.sort().forEach(function (key) {
					walkSchema(properties[key], path ? path + "." + key : key);
				});
				return;
			}
			if (path) {
				add(leafPaths, path);
			}
		}
		walkSchema(schema || {}, "");
		return { paths: paths, arrayPaths: arrayPaths, leafPaths: leafPaths };
	}

	function bindingPathSegments(path) {
		var segments = [];
		var matcher = /([^.[\]]+)|\[(\d+)\]/g;
		var match;
		while ((match = matcher.exec(String(path || ""))) !== null) {
			segments.push(match[1] !== undefined
				? { kind: "property", name: match[1] }
				: { kind: "index", index: Number(match[2]) });
		}
		return segments;
	}

	function bindingPathText(path) {
		var text = "";
		arrayValue(path).forEach(function (segment) {
			if (segment && segment.kind === "index") {
				text += "[" + Number(segment.index) + "]";
			} else if (segment && segment.kind === "property" && segment.name) {
				text += (text ? "." : "") + String(segment.name);
			}
		});
		return text;
	}

	function sourceBinding(source, path) {
		return {
			mode: "source",
			source: source,
			path: bindingPathSegments(path)
		};
	}

	function fullSyncSchema(operation) {
		if (operation === "view") {
			return {
				type: "object",
				properties: {
					total_rows: { type: "number" },
					offset: { type: "number" },
					rows: {
						type: "array",
						items: {
							type: "object",
							properties: {
								id: { type: "string" },
								key: {},
								value: { type: "object" },
								doc: { type: "object" }
							}
						}
					}
				}
			};
		}
		if (operation === "sync" || operation === "replicate_pull" || operation === "replicate_push") {
			return {
				type: "object",
				properties: {
					ok: { type: "boolean" },
					status: { type: "string" },
					progress: {
						type: "object",
						properties: {
							current: { type: "number" },
							total: { type: "number" },
							percent: { type: "number" },
							status: { type: "string" },
							phase: { type: "string" }
						}
					}
				}
			};
		}
		return { type: "object" };
	}

	function unwrapRequestableSchema(schema) {
		if (typeof schema === "string") {
			try {
				schema = JSON.parse(schema);
			} catch (e) {
				schema = {};
			}
		}
		var current = schema || {};
		["document", "couchdb_output"].forEach(function (name) {
			if (current.properties && current.properties[name]) {
				current = current.properties[name];
			}
		});
		return current;
	}

	function validBinding(value) {
		value = objectValue(value);
		if (!value) {
			return false;
		}
		if (value.mode === "literal") {
			return Object.prototype.hasOwnProperty.call(value, "value");
		}
		if (value.mode === "expression") {
			return typeof value.expression === "string";
		}
		var source = objectValue(value.source);
		if (value.mode !== "source" || !source) {
			return false;
		}
		var path = value.path;
		var validPath = path === undefined || (Object.prototype.toString.call(path) === "[object Array]" && path.every(function (segment) {
			return objectValue(segment) && ((segment.kind === "property" && typeof segment.name === "string")
				|| (segment.kind === "index" && typeof segment.index === "number"));
		}));
		return validPath && (((source.category === "requestable" || source.category === "action") && !!source.actionId)
			|| (source.category === "fullsync" && !!source.actionId && !!source.operation)
			|| (source.category === "iteration" && !!source.scopeId && (source.value === "item" || source.value === "index")));
	}

	function firstNodePath(tree, predicate) {
		var path = "";
		walk(tree, function (node) {
			if (!path && predicate(node)) {
				path = String(node.path || "");
			}
		});
		return path;
	}

	function requiresExplicitSource(type) {
		type = String(type || "").toLowerCase();
		return type === "image" || type === "text" || type === "button" || type === "table" || type === "json";
	}

	function isForEachElseDescendant(path, iteratorPath) {
		var relative = String(path || "").substring(String(iteratorPath || "").length);
		return relative.indexOf(".else_") === 0 || relative.indexOf(".else.") === 0;
	}

	function visibleDescendantCount(node) {
		var count = 0;
		arrayValue(node && node.children).forEach(function (child) {
			var kind = String(child && child.kind || "");
			if (kind === "frontendWidget" || kind === "frontendDirectiveBlock" || kind === "frontendDataBlock") {
				count++;
			}
			count += visibleDescendantCount(child);
		});
		return count;
	}

	function actionChain(path) {
		var text = String(path || "");
		var match = /\.actions(?:_[^.]+)?(?:\.|$)/.exec(text);
		return match ? text.substring(0, match.index) : null;
	}

	function paperboardSummary(tree) {
		var summary = {
			routeCount: 0,
			pageCount: 0,
			blocks: [],
			actions: [],
			dataSources: [],
			structureWarnings: []
		};
		walk(tree, function (node) {
			var kind = String(node.kind || "");
			var type = String(node.type || "");
			var definition = nodeDefinition(node);
			if (kind === "frontendRoutes" || kind === "frontendRouteRoot" || kind === "frontendRouteSegment") {
				summary.routeCount++;
			}
			if (kind === "frontendPage") {
				summary.pageCount++;
			}
			if (kind === "frontendWidget" || kind === "frontendDirectiveBlock" || kind === "frontendDataBlock") {
				addLimited(summary.blocks, {
					path: node.path || "",
					kind: kind,
					type: type,
					id: definition.id || node.id || "",
					label: visibleLabel(node, definition),
					source: definition.source || definition.value || definition.path || "",
					test: definition.test || definition.condition || "",
					context: definition.context || "",
					contentCount: visibleDescendantCount(node)
				}, 40);
			}
			if (kind === "frontendActionBlock" || definition.requestable || definition.backendCall) {
				addLimited(summary.actions, {
					path: node.path || "",
					id: definition.id || "",
					target: definition.target || "",
					operation: definition.operation || "",
					type: type,
					label: visibleLabel(node, definition),
					requestable: definition.requestable || "",
					fullSyncOperation: definition.fullSyncOperation || fullSyncOperation(type, definition.mode),
					schemaRequestable: definition.schemaRequestable || "",
					schemaInput: definition.schemaInput || null,
					docid: definition.docid || null,
					outputSchema: definition.outputSchema || null,
					clientAction: definition.clientAction || "",
					backendCall: definition.backendCall || "",
					sourceFile: definition.sourcePath || definition.sourceFile || "",
					outputSchemaMutationPath: definition.sourcePropertyMutationPaths && definition.sourcePropertyMutationPaths.outputSchema
						|| (definition.sourceMutationPath ? String(definition.sourceMutationPath) + ".props.outputSchema" : ""),
					schemaInputMutationPath: definition.sourcePropertyMutationPaths && definition.sourcePropertyMutationPaths.schemaInput
						|| (definition.sourceMutationPath ? String(definition.sourceMutationPath) + ".props.schemaInput" : "")
				}, 100);
			}
			if (definition.source || definition.path || definition.value || requiresExplicitSource(type) ||
				type === "ForEach" || type === "each") {
				addLimited(summary.dataSources, {
					path: node.path || "",
					id: definition.id || node.id || "",
					type: type,
					sourceFile: definition.sourcePath || definition.sourceFile || "",
					sourceMutationPath: definition.sourceMutationPath || "",
					sourcePropertyMutationPath: definition.sourcePropertyMutationPaths && definition.sourcePropertyMutationPaths.source || "",
					source: definition.source || "",
					value: definition.value || "",
					dataPath: definition.path || "",
					context: definition.context || ""
				}, 100);
			}
		});
		var asyncSeenByChain = {};
		arrayValue(summary.actions).forEach(function (action) {
			var path = String(action.path || "");
			var type = String(action.type || "").toLowerCase();
			var chain = actionChain(path);
			if (chain === null) {
				summary.structureWarnings.push({
					level: "error",
					code: "FRONTEND_ACTION_OUTSIDE_ACTIONS",
					path: path,
					message: String(action.type || "Action") + " is an action, not a visible block. Place it inside Button > Events > OnClick > Actions or OnMount > Actions."
				});
			}
			chain = chain === null ? path : chain;
			var operation = String(action.operation || "").toLowerCase();
			var reset = type === "setvalue" ||
				(type === "updatelist" && (operation === "clear" || operation === "set")) ||
				(type === "updatenumber" && operation === "set");
			if (asyncSeenByChain[chain] && reset) {
				summary.structureWarnings.push({
					level: "warning",
					code: "FRONTEND_LATE_STATE_INITIALIZATION",
					path: path,
					message: String(action.type || "Action") + " resets client state after asynchronous lifecycle work. Move state initialization before requestable or FullSync actions."
				});
			}
			if (type === "callsequence" || type.indexOf("fullsync") === 0) asyncSeenByChain[chain] = true;
		});
		return summary;
	}

	function enrichFrontendBindings(ctx, args, frontend) {
		var enrichStarted = Number(java.lang.System.currentTimeMillis());
		frontend.bindingSuggestions = [];
		frontend.bindingWarnings = [];
		var paperboard = frontend.paperboard || {};
		var pickerCache = {};
		var requestableSchemaCache = {};
		var timing = frontend.timing || {};
		timing.pickerCalls = 0;
		timing.pickerCacheHits = 0;
		timing.pickerMs = 0;
		timing.pickerRequests = [];
		timing.schemaCalls = 0;
		timing.schemaMs = 0;
		function cacheKey(parts) {
			return parts.map(function (part) {
				return typeof part === "string" ? part : JSON.stringify(part || {});
			}).join("|");
		}
		function pickerSource(path, sourceId, binding) {
			var key = cacheKey([path, sourceId]);
			if (Object.prototype.hasOwnProperty.call(pickerCache, key)) {
				timing.pickerCacheHits++;
				return pickerCache[key];
			}
			var started = Number(java.lang.System.currentTimeMillis());
			timing.pickerCalls++;
			if (timing.pickerRequests.length < 8) timing.pickerRequests.push({ path: path, sourceId: sourceId });
			try {
				var tree = ctx.authoringTreeSource({
					projectDir: args.projectDir,
					engineSource: args.engineSource,
					surface: "frontend",
					builder: "svelte",
					focusPath: path,
					detail: "inspect",
					property: "source",
					sourceId: sourceId,
					maxDepth: 0,
					includeFrontendCatalog: false,
					includeFlowCatalog: false
				});
				var selected = null;
				walk(tree, function (node) {
					if (selected || String(node.path || "") !== String(path || "")) {
						return;
					}
					var definition = nodeDefinition(node);
					if (binding) {
						if (!binding.sourceFile) {
							binding.sourceFile = definition.sourcePath || definition.sourceFile || "";
						}
						if (!binding.sourceMutationPath && definition.sourceMutationPath) {
							binding.sourceMutationPath = definition.sourceMutationPath;
						}
						if (!binding.sourcePropertyMutationPath && definition.sourceMutationPath) {
							binding.sourcePropertyMutationPath = String(definition.sourceMutationPath) + ".props.source";
						}
					}
					var sourceInfo = node.bindings && node.bindings.source;
					arrayValue(sourceInfo && sourceInfo.sources).some(function (source) {
						var sourceActionId = source && source.source && source.source.actionId ||
							source && source.binding && source.binding.source && source.binding.source.actionId || "";
						if (String(source.id || "") === String(sourceId || "") ||
							String(sourceActionId) === String(sourceId || "")) {
							selected = source;
							selected.sourceFile = definition.sourcePath || definition.sourceFile || "";
							return true;
						}
						return false;
					});
				});
				pickerCache[key] = selected;
				return selected;
			} catch (_ignored) {
				pickerCache[key] = null;
				return null;
			} finally {
				timing.pickerMs += Number(java.lang.System.currentTimeMillis()) - started;
			}
		}
		function knownRequestableSchema(requestable, input) {
			var key = cacheKey([requestable, input]);
			if (Object.prototype.hasOwnProperty.call(requestableSchemaCache, key)) {
				return requestableSchemaCache[key];
			}
			var started = Number(java.lang.System.currentTimeMillis());
			timing.schemaCalls++;
			try {
				var schemaResult = ctx.callBlock("requestable.schema", {
					requestable: requestable,
					project: args.project,
					projectDir: args.projectDir,
					input: input || {},
					learn: false
				}, { trace: false }) || {};
				var schema = schemaResult.ok === false ? null : unwrapRequestableSchema(schemaResult.schema || {});
				requestableSchemaCache[key] = schema && Object.keys(schema).length ? schema : null;
			} catch (_ignored) {
				requestableSchemaCache[key] = null;
			} finally {
				timing.schemaMs += Number(java.lang.System.currentTimeMillis()) - started;
			}
			return requestableSchemaCache[key];
		}
		function pickerMutation(path, sourceId, sourcePath, binding) {
			var source = pickerSource(path, sourceId, binding);
			if (binding && !binding.sourceFile && source && source.sourceFile) {
				binding.sourceFile = source.sourceFile;
			}
			var candidate = null;
			if (source && source.mutation && String(sourcePath || "") === "") {
				return source.mutation;
			}
			arrayValue(source && source.bindings).some(function (entry) {
				if (String(entry.path || "") === String(sourcePath || "") && entry.mutation) {
					candidate = entry;
					return true;
				}
				return false;
			});
			if (candidate && candidate.mutation) {
				return candidate.mutation;
			}
			if (source && source.mutation && source.binding && source.binding.source) {
				return {
					op: source.mutation.op,
					path: source.mutation.path,
					value: sourceBinding(source.binding.source, sourcePath)
				};
			}
			return null;
		}
		function preferredIterationCandidate(source, type, targetPath) {
			var candidates = arrayValue(source && source.bindings).filter(function (candidate) {
				return candidate && candidate.mutation && String(candidate.type || "") !== "object" && String(candidate.type || "") !== "array";
			});
			var target = String(targetPath || "").toLowerCase();
			for (var matched = 0; matched < candidates.length; matched++) {
				var matchedLeaf = String(candidates[matched].path || "").split(".").pop().toLowerCase();
				if (matchedLeaf && target.indexOf(matchedLeaf) !== -1) {
					return candidates[matched];
				}
			}
			var priorities = String(type || "").toLowerCase() === "image"
				? ["imageurl", "image", "src", "url"]
				: ["name", "title", "description", "label", "text"];
			for (var i = 0; i < priorities.length; i++) {
				for (var j = 0; j < candidates.length; j++) {
					var leaf = String(candidates[j].path || "").split(".").pop().toLowerCase();
					if (leaf === priorities[i]) {
						return candidates[j];
					}
				}
			}
			return candidates[0] || null;
		}
		function semanticIterationCandidate(source, type, targetPath) {
			var candidates = arrayValue(source && source.bindings).filter(function (candidate) {
				return candidate && candidate.mutation && String(candidate.type || "") !== "object" && String(candidate.type || "") !== "array";
			});
			var target = String(targetPath || "").toLowerCase();
			var aliases = String(type || "").toLowerCase() === "image"
				? ["imageurl", "image", "src", "url"] : [];
			for (var alias = 0; alias < aliases.length; alias++) {
				for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
					var candidateLeaf = String(candidates[candidateIndex].path || "").split(".").pop().toLowerCase();
					if (candidateLeaf === aliases[alias]) return candidates[candidateIndex];
				}
			}
			for (var i = 0; i < candidates.length; i++) {
				var leaf = String(candidates[i].path || "").split(".").pop().toLowerCase();
				if (leaf.length >= 3 && target.indexOf(leaf) !== -1) {
					return candidates[i];
				}
			}
			return null;
		}
		function hasSemanticIterationPath(iterator, type, targetPath) {
			var iteratorSource = iterator && iterator.source;
			if (!validBinding(iteratorSource) || iteratorSource.mode !== "source") return true;
			var actionId = iteratorSource.source && iteratorSource.source.actionId;
			var suggestion = null;
			frontend.bindingSuggestions.some(function (candidate) {
				if (String(candidate.actionId || "") === String(actionId || "")) {
					suggestion = candidate;
					return true;
				}
				return false;
			});
			if (!suggestion) return true;
			var arrayPath = bindingPathText(iteratorSource.path || []);
			var prefix = arrayPath ? arrayPath + "[0]." : "";
			var paths = arrayValue(suggestion.leafPaths).filter(function (path) {
				return !prefix || String(path).indexOf(prefix) === 0;
			}).map(function (path) {
				return prefix ? String(path).substring(prefix.length) : String(path);
			});
			if (!paths.length) return String(suggestion.operation || "") !== "state.list";
			var target = String(targetPath || "").toLowerCase();
			var aliases = String(type || "").toLowerCase() === "image"
				? ["imageurl", "image", "src", "url"] : [];
			return paths.some(function (path) {
				var leaf = String(path || "").split(".").pop().toLowerCase();
				return aliases.indexOf(leaf) !== -1 || (leaf.length >= 3 && target.indexOf(leaf) !== -1);
			});
		}
		function iteratorSuggestion() {
			var candidates = frontend.bindingSuggestions.filter(function (suggestion) {
				return !suggestion.error && arrayValue(suggestion.arrayPaths).length > 0;
			});
			return candidates.length === 1 ? candidates[0] : null;
		}
		function preferredIterationPath(suggestion, arrayPath, type, targetPath) {
			var prefix = String(arrayPath || "") + "[0].";
			var paths = arrayValue(suggestion && suggestion.leafPaths).filter(function (path) {
				return String(path).indexOf(prefix) === 0;
			}).map(function (path) {
				return String(path).substring(prefix.length);
			});
			var target = String(targetPath || "").toLowerCase();
			for (var matched = 0; matched < paths.length; matched++) {
				var matchedLeaf = paths[matched].split(".").pop().toLowerCase();
				if (matchedLeaf && target.indexOf(matchedLeaf) !== -1) return paths[matched];
			}
			var priorities = String(type || "").toLowerCase() === "image"
				? ["imageurl", "image", "src", "url"]
				: ["name", "title", "description", "label", "text"];
			for (var i = 0; i < priorities.length; i++) {
				for (var j = 0; j < paths.length; j++) {
					if (paths[j].split(".").pop().toLowerCase() === priorities[i]) return paths[j];
				}
			}
			return paths[0] || "";
		}
		function sourceMutation(binding, value) {
			var direct = String(binding.sourcePropertyMutationPath || "");
			if (!binding.sourceFile || (!direct && !binding.sourceMutationPath)) return null;
			return {
				op: direct ? "replace" : "merge",
				path: direct || binding.sourceMutationPath,
				value: direct ? value : { source: value }
			};
		}
		var plannedIterators = {};
		arrayValue(paperboard.actions).forEach(function (action) {
			var actionId = actionResultId(action);
			var operation = String(action.fullSyncOperation || "");
			var schemaRequestable = String(action.schemaRequestable || "");
			var requestable = String(action.requestable || "");
			if (!actionId || (!requestable && !operation)) {
				return;
			}
			try {
				var schema = action.outputSchema || null;
				var schemaSource = "generic";
				var schemaInput = objectValue(action.schemaInput);
				if (!schemaInput && operation === "get") {
					var literalDocid = objectValue(action.docid) && action.docid.mode === "literal"
						? action.docid.value : typeof action.docid === "string" ? action.docid : "";
					schemaInput = literalDocid ? { _use_docid: literalDocid } : {};
				}
				if (!schemaInput) {
					schemaInput = operation === "view" ? { _use_include_docs: true, _use_limit: 1 } : {};
				}
				var schemaInputRequired = operation === "get" && schemaRequestable && !action.outputSchema && Object.keys(schemaInput).length === 0;
				if (schema) {
					schema = unwrapRequestableSchema(schema);
					schemaSource = schemaRequestable ? "learned requestable" : "declared";
				}
				if (!schema && operation && schemaRequestable && !schemaInputRequired && action.outputSchemaMutationPath) {
					schema = knownRequestableSchema(schemaRequestable, schemaInput);
					if (schema) schemaSource = "requestable cache";
				}
				if (!schema && !operation && requestable) {
					var schemaResult = ctx.callBlock("requestable.schema", {
						requestable: requestable,
						project: args.project,
						projectDir: args.projectDir,
						learn: false
					}, { trace: false }) || {};
					if (schemaResult.ok === false) {
						throw new Error(schemaResult.error && schemaResult.error.message || "Schema unavailable for " + requestable);
					}
					schema = unwrapRequestableSchema(schemaResult.schema || {});
					schemaSource = "requestable";
				}
				var schemaResolved = !!schema;
				if (!schema && operation) {
					schema = fullSyncSchema(operation);
				}
				var summary = schemaPaths(schema || {});
				var source = operation
					? { category: "fullsync", actionId: actionId, operation: operation }
					: { category: "requestable", actionId: actionId };
				frontend.bindingSuggestions.push({
					actionId: actionId,
					executionId: String(action.id || actionId),
					requestable: requestable,
					operation: operation,
					schemaRequestable: schemaRequestable,
					schemaInput: schemaInput,
					schemaInputMutationPath: action.schemaInputMutationPath || "",
					schemaSource: schemaSource,
					schemaInputPending: schemaInputRequired ? {
						tool: "frontend-svelte-fullsync-schema",
						arguments: {
							project: args.project,
							sourceFile: action.sourceFile,
							path: action.outputSchemaMutationPath,
							actionId: String(action.id || actionId),
							requestable: schemaRequestable,
							learn: true
						},
						needsInput: {
							name: "sampleDocId",
							requestVariable: "_use_docid",
							description: "Set one representative safe document id, then execute this repair."
						},
						note: "Only sampleDocId is missing. It is used for schema learning and is not written into the client action."
					} : null,
					schemaPending: operation && schemaRequestable && !schemaResolved && !schemaInputRequired && action.sourceFile && (action.outputSchemaMutationPath || action.id) ? {
						tool: "frontend-svelte-fullsync-schema",
						arguments: {
							project: args.project,
							sourceFile: action.sourceFile,
							path: action.outputSchemaMutationPath,
							actionId: String(action.id || actionId),
							requestable: schemaRequestable,
							input: schemaInput,
							learn: true
						},
						note: "Execute this mutation unchanged after confirming that learning the read requestable is safe."
					} : null,
					schemaLocationMissing: operation && schemaRequestable && !schemaResolved && !schemaInputRequired && (!action.sourceFile || (!action.outputSchemaMutationPath && !action.id)),
					source: source,
					root: "backendResults." + actionId,
					sourcePaths: summary.paths.slice(0, 40),
					arrayPaths: summary.arrayPaths.slice(0, 12),
					leafPaths: summary.leafPaths.slice(0, 30),
					bindings: summary.paths.slice(0, 40).map(function (path) {
						return { path: path, binding: sourceBinding(source, path) };
					}),
					example: summary.arrayPaths.length
						? { forEachBinding: sourceBinding(source, summary.arrayPaths[0]), statusActionId: actionId }
						: { binding: sourceBinding(source, summary.leafPaths[0] || ""), statusActionId: actionId },
					note: "Pass one returned binding or mutation unchanged. String paths are migration input only."
				});
			} catch (e) {
				frontend.bindingSuggestions.push({
					actionId: actionId,
					requestable: requestable,
					operation: operation,
					schemaRequestable: schemaRequestable,
					error: String(e.message || e)
				});
			}
		});
		var localListTargets = {};
		arrayValue(paperboard.actions).forEach(function (action) {
			var target = String(action.target || "");
			if (!target || String(action.type || "").toLowerCase() !== "updatelist" || localListTargets[target]) return;
			localListTargets[target] = true;
			var source = { category: "action", actionId: target };
			frontend.bindingSuggestions.push({
				actionId: target,
				executionId: String(action.id || target),
				operation: "state.list",
				schemaSource: "client action state",
				source: source,
				root: "backendResults." + target,
				sourcePaths: [""],
				arrayPaths: [""],
				leafPaths: [],
				bindings: [{ path: "", binding: sourceBinding(source, "") }],
				example: { forEachBinding: sourceBinding(source, "") },
				note: "Client list state exposed by UpdateList target. Pass the returned root binding unchanged."
			});
		});
		var localNumberTargets = {};
		arrayValue(paperboard.actions).forEach(function (action) {
			var type = String(action.type || "").toLowerCase();
			if (type !== "updatenumber") return;
			var target = String(action.target || action.id || "");
			if (!target || localNumberTargets[target]) return;
			localNumberTargets[target] = true;
			var source = { category: "action", actionId: target };
			frontend.bindingSuggestions.push({
				actionId: target,
				executionId: String(action.id || target),
				operation: "state.number",
				schemaSource: "client numeric state",
				source: source,
				root: "backendResults." + target,
				sourcePaths: [""],
				arrayPaths: [],
				leafPaths: [""],
				bindings: [{ path: "", binding: sourceBinding(source, "") }],
				example: { binding: sourceBinding(source, "") },
				note: "Client numeric state exposed by UpdateNumber. Pass the returned root binding unchanged."
			});
		});
		frontend.bindingSuggestions.forEach(function (suggestion) {
			if (suggestion.schemaInputPending) {
				frontend.bindingWarnings.push({
					code: "FRONTEND_FULLSYNC_SCHEMA_INPUT_REQUIRED",
					actionId: suggestion.actionId,
					message: "FullSync Get " + suggestion.actionId + " needs safe sample variables before its schema requestable can be learned.",
					repair: suggestion.schemaInputPending
				});
			}
			if (!suggestion.schemaPending) {
				if (suggestion.schemaLocationMissing) {
					frontend.bindingWarnings.push({
						code: "FRONTEND_FULLSYNC_SCHEMA_LOCATION_MISSING",
						actionId: suggestion.actionId,
						executionId: suggestion.executionId,
						message: "FullSync action " + suggestion.executionId + " has no source identity for attaching outputSchema. Run frontend-svelte-code-check to restore source metadata."
					});
				}
				return;
			}
			frontend.bindingWarnings.push({
				code: "FRONTEND_FULLSYNC_SCHEMA_PENDING",
				actionId: suggestion.actionId,
				executionId: suggestion.executionId,
				message: "FullSync action " + suggestion.actionId + " still uses the generic envelope schema; execute the returned schema learning mutation before binding domain fields.",
				fix: suggestion.schemaPending
			});
		});
		arrayValue(paperboard.dataSources).forEach(function (binding) {
			var rawSource = binding.source || binding.value || binding.dataPath || "";
			var containingIteration = null;
			arrayValue(paperboard.blocks).forEach(function (block) {
				if ((block.type === "ForEach" || block.type === "each")
					&& String(binding.path || "").indexOf(String(block.path || "") + ".") === 0
					&& !isForEachElseDescendant(binding.path, block.path)
					&& (!containingIteration || String(block.path || "").length > String(containingIteration.path || "").length)) {
					containingIteration = block;
				}
			});
			if ((binding.type === "ForEach" || binding.type === "each") && rawSource && rawSource.mode === "literal" &&
				Object.prototype.toString.call(rawSource.value) === "[object Array]" && rawSource.value.length === 0) {
				var arraySuggestion = null;
				var semanticId = String(binding.id || "").toLowerCase().replace(/(items|list|rows)$/g, "");
				frontend.bindingSuggestions.some(function (suggestion) {
					var suggestionId = String(suggestion.actionId || "").toLowerCase();
					if (arrayValue(suggestion.arrayPaths).length > 0 && semanticId &&
						(semanticId === suggestionId || semanticId.indexOf(suggestionId) !== -1)) {
						arraySuggestion = suggestion;
						return true;
					}
					return false;
				});
				if (!arraySuggestion) {
					frontend.bindingSuggestions.some(function (suggestion) {
						if (suggestion.operation === "view" && arrayValue(suggestion.arrayPaths).length > 0) {
							arraySuggestion = suggestion;
							return true;
						}
						return false;
					});
				}
				var iteratorBinding = arraySuggestion
					? sourceBinding(arraySuggestion.source, arraySuggestion.arrayPaths[0])
					: null;
				var iteratorWarning = {
					code: "FRONTEND_ITERATOR_EMPTY_SOURCE",
					path: binding.path,
					message: iteratorBinding
						? "ForEach still uses an empty placeholder. Bind it to the matched " +
							(arraySuggestion.source && arraySuggestion.source.category === "action" ? "client list state." : "schema-backed FullSync view result.")
						: "ForEach still uses an empty placeholder and cannot render application data.",
					suggestedBinding: iteratorBinding
				};
				if (iteratorBinding) {
					var exactMutation = pickerMutation(binding.path, arraySuggestion.actionId, arraySuggestion.arrayPaths[0], binding) ||
						sourceMutation(binding, iteratorBinding);
					if (exactMutation) {
						iteratorWarning.fix = {
						tool: "frontend-svelte-mutate",
						arguments: {
							project: args.project,
							sourceFile: binding.sourceFile,
							mutation: exactMutation
						}
						};
					}
				}
				frontend.bindingWarnings.push(iteratorWarning);
				return;
			}
			if (objectValue(rawSource) && !validBinding(rawSource)) {
				frontend.bindingWarnings.push({
					code: "FRONTEND_BINDING_INVALID",
					path: binding.path,
					binding: rawSource,
					message: "Binding does not match the FlowValueBinding contract; select a picker candidate instead of constructing it manually."
				});
				return;
			}
			if (validBinding(rawSource)) {
				var structuredSource = rawSource.source || {};
				if (rawSource.mode === "literal" && containingIteration && requiresExplicitSource(binding.type)
					&& validBinding(containingIteration.source)
					&& hasSemanticIterationPath(containingIteration, binding.type, binding.id || binding.path)) {
					var semanticCandidate = semanticIterationCandidate(
						pickerSource(binding.path, containingIteration.id), binding.type, binding.id || binding.path);
					if (semanticCandidate) {
						frontend.bindingWarnings.push({
							code: "FRONTEND_ITERATION_LITERAL_PLACEHOLDER",
							path: binding.path,
							type: binding.type,
							iteratorPath: containingIteration.path,
							message: String(binding.type) + " inside a schema-backed iterator still uses a literal even though its id matches field " + String(semanticCandidate.path || "") + ". Apply the picker mutation or rename the block if the literal is intentional.",
							suggestedBinding: semanticCandidate.binding,
							fix: {
								tool: "frontend-svelte-mutate",
								arguments: {
									project: args.project,
									sourceFile: binding.sourceFile,
									mutation: semanticCandidate.mutation
								}
							}
						});
					}
				}
				if (rawSource.mode === "source" && structuredSource.category === "iteration" &&
					arrayValue(rawSource.path).length === 0 && (String(binding.type) === "Text" || String(binding.type) === "Image")) {
					var iterationSource = pickerSource(binding.path, structuredSource.scopeId);
					var iterationCandidate = preferredIterationCandidate(iterationSource, binding.type, binding.path);
					if (iterationCandidate) {
						frontend.bindingWarnings.push({
							code: "FRONTEND_ITERATION_OBJECT_SOURCE",
							path: binding.path,
							type: binding.type,
							message: String(binding.type) + " is bound to the complete iterator object. Select a schema-backed field so it renders a scalar value.",
							suggestedBinding: iterationCandidate.binding,
							fix: {
								tool: "frontend-svelte-mutate",
								arguments: {
									project: args.project,
									sourceFile: binding.sourceFile,
									mutation: iterationCandidate.mutation
								}
							}
						});
					}
				}
				if (rawSource.mode === "source" && (structuredSource.category === "requestable" || structuredSource.category === "action" || structuredSource.category === "fullsync")) {
					var knownSuggestion = null;
					frontend.bindingSuggestions.some(function (suggestion) {
						if (String(suggestion.actionId || "") === String(structuredSource.actionId || "")) {
							knownSuggestion = suggestion;
							return true;
						}
						return false;
					});
					if (!knownSuggestion) {
						var pickerKnown = pickerSource(binding.path, structuredSource.actionId);
						if (pickerKnown) {
							knownSuggestion = {
								actionId: structuredSource.actionId,
								sourcePaths: arrayValue(pickerKnown.bindings).map(function (candidate) {
									return String(candidate && candidate.path || "");
								}).filter(function (path) {
									return !!path;
								})
							};
						}
					}
					if (!knownSuggestion) {
						frontend.bindingWarnings.push({
							code: "FRONTEND_BINDING_UNKNOWN_ACTION",
							path: binding.path,
							binding: rawSource,
							message: "Binding references an unknown client action: " + String(structuredSource.actionId || "")
						});
					} else {
						var selectedPath = bindingPathText(rawSource.path || []);
						var knownPath = !selectedPath || arrayValue(knownSuggestion.sourcePaths).indexOf(selectedPath) !== -1;
						if (!knownPath) {
							frontend.bindingWarnings.push({
								code: "FRONTEND_BINDING_UNKNOWN_SCHEMA_PATH",
								path: binding.path,
								binding: rawSource,
								message: "Binding path is not present in the effective schema for action " + String(structuredSource.actionId || "") + ": " + selectedPath
							});
						}
					}
				}
				if ((binding.type === "ForEach" || binding.type === "each")) {
					var boundBlock = null;
					arrayValue(paperboard.blocks).some(function (block) {
						if (String(block.path || "") === String(binding.path || "")) {
							boundBlock = block;
							return true;
						}
						return false;
					});
					if (boundBlock && Number(boundBlock.contentCount || 0) === 0) {
						frontend.bindingWarnings.push({
							code: "FRONTEND_ITERATOR_EMPTY_BODY",
							path: binding.path,
							message: "Data-bound ForEach has no visible child and cannot render its rows.",
							inspect: {
								tool: "frontend-svelte-palette",
								arguments: { project: args.project, focusPath: binding.path, query: "Card Text Image Button" }
							}
						});
					}
				}
				return;
			}
			var source = String(rawSource || "");
			if (!source) {
				var boundIteration = containingIteration;
				if ((binding.type === "ForEach" || binding.type === "each")) {
					var suggestedIterator = iteratorSuggestion();
					var suggestedArrayPath = suggestedIterator && suggestedIterator.arrayPaths[0];
					var suggestedIteratorBinding = suggestedIterator
						? sourceBinding(suggestedIterator.source, suggestedArrayPath) : null;
					var suggestedIteratorMutation = suggestedIteratorBinding &&
						(pickerMutation(binding.path, suggestedIterator.actionId, suggestedArrayPath, binding) ||
							sourceMutation(binding, suggestedIteratorBinding));
					if (suggestedIteratorMutation) {
						plannedIterators[binding.path] = {
							suggestion: suggestedIterator,
							arrayPath: suggestedArrayPath,
							binding: suggestedIteratorBinding
						};
					}
					frontend.bindingWarnings.push({
						code: "FRONTEND_ITERATOR_MISSING_SOURCE",
						path: binding.path,
						type: binding.type,
						message: suggestedIteratorBinding
							? "ForEach has one unambiguous schema-backed array source. Apply the returned binding mutation."
							: "ForEach has no source. Select a schema-backed array result.",
						suggestedBinding: suggestedIteratorBinding,
						fix: suggestedIteratorMutation ? {
							tool: "frontend-svelte-mutate",
							arguments: { project: args.project, sourceFile: binding.sourceFile, mutation: suggestedIteratorMutation }
						} : null
					});
				} else if (boundIteration && requiresExplicitSource(binding.type)) {
					var missingWarning = {
						code: "FRONTEND_BINDING_MISSING",
						path: binding.path,
						type: binding.type,
						iteratorPath: boundIteration.path,
						iteratorBinding: boundIteration.source,
						message: String(binding.type || "Block") + " inside a data-bound ForEach requires an explicit structured source. Select a schema-backed iteration candidate, or use a literal binding for intentional static content.",
						inspect: {
							tool: "frontend-svelte-tree",
							arguments: {
								project: args.project,
								detail: "inspect",
								focusPath: binding.path,
								property: "source",
								sourceId: String(boundIteration.id || ""),
								maxDepth: 0
							}
						}
					};
					var directCandidate = validBinding(boundIteration.source)
						? preferredIterationCandidate(pickerSource(binding.path, boundIteration.id), binding.type, binding.path)
						: null;
					var planned = plannedIterators[boundIteration.path];
					var relativePath = !directCandidate && planned
						? preferredIterationPath(planned.suggestion, planned.arrayPath, binding.type, binding.path) : "";
					var suggested = directCandidate && directCandidate.binding || (relativePath
						? sourceBinding({ category: "iteration", scopeId: String(boundIteration.id || "forEach"), value: "item" }, relativePath)
						: null);
					var mutation = directCandidate && directCandidate.mutation || (suggested ? sourceMutation(binding, suggested) : null);
					if (!mutation && suggested && planned) {
						var actionPath = String(planned.arrayPath || "") + "[0]." + String(relativePath || "");
						mutation = pickerMutation(binding.path, planned.suggestion.actionId, actionPath, binding);
						if (mutation) {
							mutation.value = suggested;
						}
					}
					if (suggested && mutation) {
						missingWarning.suggestedBinding = suggested;
						missingWarning.fix = {
							tool: "frontend-svelte-mutate",
							arguments: { project: args.project, sourceFile: binding.sourceFile, mutation: mutation }
						};
						delete missingWarning.inspect;
					}
					frontend.bindingWarnings.push(missingWarning);
				}
				return;
			}
			var iteration = null;
			arrayValue(paperboard.blocks).forEach(function (block) {
				var context = String(block.context || "item");
				if ((block.type === "ForEach" || block.type === "each") && source.indexOf(context + ".") === 0
					&& String(binding.path || "").indexOf(String(block.path || "")) === 0
					&& (!iteration || String(block.path || "").length > String(iteration.path || "").length)) {
					iteration = block;
				}
			});
			var selectedSuggestion = null;
			var relative = source;
			frontend.bindingSuggestions.forEach(function (suggestion) {
				var actionId = String(suggestion.actionId || "");
				var prefixes = [actionId + ".", "actions." + actionId + ".", "backendResults." + actionId + "."];
				var prefix = "";
				for (var i = 0; actionId && i < prefixes.length; i++) {
					if (source.indexOf(prefixes[i]) === 0) {
						prefix = prefixes[i];
						break;
					}
				}
				if (!prefix) {
					return;
				}
				selectedSuggestion = suggestion;
				relative = source.substring(prefix.length).replace(/^result\./, "");
			});
			if (!selectedSuggestion && !iteration && frontend.bindingSuggestions.length === 1) {
				selectedSuggestion = frontend.bindingSuggestions[0];
			}
			var descriptor = iteration
				? sourceBinding({ category: "iteration", scopeId: String(iteration.id || "forEach"), value: "item" },
					source.substring(String(iteration.context || "item").length + 1))
				: selectedSuggestion
					? sourceBinding(selectedSuggestion.source || { category: "requestable", actionId: String(selectedSuggestion.actionId || "") }, relative)
					: null;
			var warning = {
					code: "FRONTEND_BINDING_LEGACY_STRING",
					path: binding.path,
					source: source,
					suggestedSource: relative,
					suggestedBinding: descriptor,
					message: descriptor
						? "Replace this legacy string path with the schema-backed binding descriptor."
						: "This bindable property still uses a legacy string path; select a picker candidate."
			};
			if (descriptor && binding.sourceFile && (binding.sourcePropertyMutationPath || binding.sourceMutationPath)) {
				var direct = String(binding.sourcePropertyMutationPath || "");
					warning.fix = {
						tool: "frontend-svelte-mutate",
						arguments: {
							project: args.project,
							sourceFile: binding.sourceFile,
							mutation: {
								op: direct ? "replace" : "merge",
								path: direct || binding.sourceMutationPath,
								value: direct ? descriptor : { source: descriptor }
							}
						}
					};
			}
			frontend.bindingWarnings.push(warning);
		});
		var warningKeys = {};
		frontend.bindingWarnings = frontend.bindingWarnings.filter(function (warning) {
			var fix = warning && warning.fix && warning.fix.arguments || {};
			var key = cacheKey([
				warning.code || "",
				warning.path || "",
				warning.code === "FRONTEND_FULLSYNC_SCHEMA_LOCATION_MISSING" ? warning.actionId || "" : warning.executionId || warning.actionId || "",
				fix.sourceFile || "",
				fix.path || "",
				fix.requestable || ""
			]);
			if (warningKeys[key]) return false;
			warningKeys[key] = true;
			return true;
		});
		var fixesByFile = {};
		arrayValue(frontend.bindingWarnings).forEach(function (warning) {
			var fix = warning.fix;
			if (!fix || fix.tool !== "frontend-svelte-mutate" || !fix.arguments || !fix.arguments.mutation || !fix.arguments.sourceFile) return;
			var file = String(fix.arguments.sourceFile);
			if (!fixesByFile[file]) fixesByFile[file] = [];
			fixesByFile[file].push(fix.arguments.mutation);
		});
		var bindingPlanCalls = Object.keys(fixesByFile).map(function (sourceFile) {
			return {
				tool: "frontend-svelte-mutate",
				arguments: {
					project: args.project,
					sourceFile: sourceFile,
					mutations: fixesByFile[sourceFile]
				},
				reason: "Apply all unambiguous schema-backed bindings for this Flow Svelte source in one ordered mutation batch."
			};
		});
		frontend.bindingPlan = {
			fixCount: bindingPlanCalls.reduce(function (count, call) { return count + call.arguments.mutations.length; }, 0),
			callCount: bindingPlanCalls.length,
			calls: bindingPlanCalls,
			note: "Execute each call unchanged, then rerun flow-app-progress. Individual warning fixes remain available for targeted Studio edits."
		};
		timing.bindingMs = Number(java.lang.System.currentTimeMillis()) - enrichStarted;
		frontend.timing = timing;
		return frontend;
	}

	function emptyFrontendSummary() {
		return {
			checked: true,
			readable: false,
			hasBuilder: false,
			hasRoutes: false,
			hasPage: false,
			hasStructure: false,
			routesPath: "",
			structurePath: "",
			sourceFile: "",
			actionIds: [],
			structureWarnings: [],
			bindingWarnings: [],
			paperboard: {
				routeCount: 0,
				pageCount: 0,
				blocks: [],
				actions: [],
				dataSources: []
			},
			error: ""
		};
	}

	function projectedFrontendSummary(ctx, args, includeMenu) {
		var summaryStarted = Number(java.lang.System.currentTimeMillis());
		var phaseTiming = { treeMs: 0, paperboardMs: 0, menuMs: 0 };
		var summary = emptyFrontendSummary();
		try {
			var treeStarted = Number(java.lang.System.currentTimeMillis());
			var tree = ctx.authoringTreeSource({
				projectDir: args.projectDir,
				engineSource: args.engineSource,
				surface: "frontend",
				builder: "svelte",
				detail: "compact",
				maxDepth: 24,
				includeDefinition: true,
				includeFrontendCatalog: false,
				includeFlowCatalog: false
			});
			phaseTiming.treeMs = Number(java.lang.System.currentTimeMillis()) - treeStarted;
			summary.readable = tree && tree.ok !== false;
			summary.structureWarnings = arrayValue(tree && tree.diagnostics);
			var paperboardTree = tree;
			var routesPath = firstNodePath(tree, function (node) {
				return String(node.kind || "") === "frontendRoutes" || String(node.type || "") === "routes";
			});
			summary.routesPath = routesPath;
			if (routesPath) {
				walk(tree, function (candidate) {
					if (paperboardTree === tree && String(candidate.path || "") === routesPath) {
						paperboardTree = candidate;
					}
				});
			}
			var paperboardStarted = Number(java.lang.System.currentTimeMillis());
			summary.paperboard = paperboardSummary(paperboardTree);
			walk(paperboardTree, function (node) {
				if (summary.sourceFile || String(node.kind || "") !== "frontendPage") {
					return;
				}
				var definition = nodeDefinition(node);
				summary.sourceFile = definition.sourcePath || definition.sourceRelativePath || definition.sourceFile || "";
			});
			if (summary.sourceFile) {
				arrayValue(summary.paperboard.actions).forEach(function (action) {
					if (!action.sourceFile) action.sourceFile = summary.sourceFile;
				});
				arrayValue(summary.paperboard.dataSources).forEach(function (source) {
					if (!source.sourceFile) source.sourceFile = summary.sourceFile;
				});
			}
			arrayValue(summary.paperboard.structureWarnings).forEach(function (diagnostic) {
				if (!summary.structureWarnings.some(function (known) {
					return known.code === diagnostic.code && known.path === diagnostic.path;
				})) summary.structureWarnings.push(diagnostic);
			});
			summary.structurePath = firstNodePath(paperboardTree, function (node) {
				return String(node.kind || "") === "frontendStructure" || String(node.type || "") === "structure";
			});
			walk(tree, function (node) {
				var kind = String(node.kind || "");
				var type = String(node.type || "");
				if (kind === "frontendBuilder" && type === "svelte") {
					summary.hasBuilder = true;
				}
				if (kind === "frontendRoutes" || type === "routes") {
					summary.hasRoutes = true;
				}
				if (kind === "frontendPage" || type === "page") {
					summary.hasPage = true;
				}
				if (kind === "frontendStructure" || type === "structure") {
					summary.hasStructure = true;
				}
			});
			phaseTiming.paperboardMs = Number(java.lang.System.currentTimeMillis()) - paperboardStarted;
			if (includeMenu) {
				var menuStarted = Number(java.lang.System.currentTimeMillis());
				var menu = ctx.callBlock("authoring.menu", {
					projectDir: args.projectDir,
					builder: "svelte",
					targetObject: {
						kind: "frontendBuilder",
						type: "svelte",
						path: "frontends.svelte",
						summary: "Svelte builder"
					}
				}, { trace: false });
				walk(menu, function (node) {
					var id = String(node.id || node.actionId || "");
					if (id && summary.actionIds.indexOf(id) === -1) {
						summary.actionIds.push(id);
					}
				});
				phaseTiming.menuMs = Number(java.lang.System.currentTimeMillis()) - menuStarted;
			}
		} catch (e) {
			summary.error = String(e.message || e);
		}
		summary.timing = Object.assign(phaseTiming, {
			summaryMs: Number(java.lang.System.currentTimeMillis()) - summaryStarted,
			fastPath: !includeMenu,
			sharedProjection: true
		});
		return summary;
	}

	function frontendPocSummary(ctx, args) {
		return projectedFrontendSummary(ctx, args, false);
	}

	function frontendSummary(ctx, args) {
		return projectedFrontendSummary(ctx, args, true);
	}

	function frontendResponse(frontend, full) {
		if (full) {
			return frontend;
		}
		var paperboard = frontend && frontend.paperboard || {};
		var bindingWarnings = arrayValue(frontend && frontend.bindingWarnings);
		var structureWarnings = arrayValue(frontend && frontend.structureWarnings);
		var plan = frontend && frontend.bindingPlan || {};
		return {
			checked: frontend && frontend.checked === true,
			readable: frontend && frontend.readable === true,
			hasBuilder: frontend && frontend.hasBuilder === true,
			hasRoutes: frontend && frontend.hasRoutes === true,
			hasPage: frontend && frontend.hasPage === true,
			hasStructure: frontend && frontend.hasStructure === true,
			routesPath: frontend && frontend.routesPath || "",
			structurePath: frontend && frontend.structurePath || "",
			paperboard: {
				routeCount: Number(paperboard.routeCount || 0),
				pageCount: Number(paperboard.pageCount || 0),
				blockCount: arrayValue(paperboard.blocks).length,
				actionCount: arrayValue(paperboard.actions).length,
				dataSourceCount: arrayValue(paperboard.dataSources).length
			},
			structureWarnings: structureWarnings,
			bindingWarnings: bindingWarnings,
			bindingSuggestionCount: arrayValue(frontend && frontend.bindingSuggestions).length,
			bindingPlan: {
				fixCount: Number(plan.fixCount || 0),
				callCount: Number(plan.callCount || 0),
				calls: arrayValue(plan.calls)
			},
			error: frontend && frontend.error || ""
		};
	}

	function addRecommendedCall(calls, tool, args, reason) {
		calls.push({
			tool: tool,
			arguments: args,
			reason: reason
		});
	}

	function addTask(tasks, id, label, done, next) {
		tasks.push({
			id: id,
			label: label,
			done: done === true,
			next: done === true ? "" : next
		});
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, prop(node, "request"));
			var out = props.out || "local.response";
			var response;
			try {
				var args = mcp.prepareToolArguments(ctx, request, { resolveProject: true });
				if (!args.projectDir) {
					throw new Error("flow-app-progress requires project:\"<target project>\" or projectDir for standalone tests with a filesystem path.");
				}
				var includeFrontend = boolValue(args.includeFrontend, boolValue(prop(node, "includeFrontend"), true));
				var mode = String(args.mode || prop(node, "mode") || "poc").toLowerCase();
				if (mode !== "poc" && mode !== "hardening") {
					throw new Error("flow-app-progress mode must be \"poc\" or \"hardening\".");
				}
				var hardening = mode === "hardening";
				var fullDetail = String(args.detail || prop(node, "detail") || "compact").toLowerCase() === "full";
				var wantedQName = String(args.qname || args.name || "").trim();
				var progressBudget = mcp.phaseBudget(args, [
					args.project || args.projectDir,
					wantedQName,
					includeFrontend ? "frontend" : "backend",
					mode
				].join("|"));
				if (progressBudget.phase > 0) {
					var resumedFrontend = includeFrontend
						? (hardening ? frontendSummary(ctx, args) : frontendPocSummary(ctx, args))
						: { checked: false };
					if (includeFrontend && progressBudget.phase === 1 && progressBudget.expired()) {
						response = mcp.toolResponse(request, progressBudget.partial({
							ok: true,
							project: args.project || "",
							qname: wantedQName,
							frontend: frontendResponse(resumedFrontend, fullDetail),
							next: "Continue with nextCursor for schema-backed frontend binding diagnostics."
						}, 2, "frontend-structure"), ctx);
						ctx.write(out, response);
						return response;
					}
					if (includeFrontend && hardening) {
						resumedFrontend = enrichFrontendBindings(ctx, args, resumedFrontend);
					}
					response = mcp.toolResponse(request, {
						ok: true,
						mode: mode,
						project: args.project || "",
						qname: wantedQName,
						complete: false,
						partial: false,
						progressPhase: "frontend",
						frontend: frontendResponse(resumedFrontend, fullDetail),
						nextActions: includeFrontend ? arrayValue(resumedFrontend.bindingWarnings).map(function (warning) {
							return warning.message || warning.code;
						}) : [],
						next: "This continuation covers the frontend phase only. Apply actionable fixes, then rerun flow-app-progress without cursor for a complete fresh assessment."
					}, ctx);
					ctx.write(out, response);
					return response;
				}
				var backendTiming = { flowListMs: 0, catalogMs: 0, debtMs: 0 };
				var flowListStarted = Number(java.lang.System.currentTimeMillis());
				var flowList = ctx.flowList({ projectDir: args.projectDir }) || {};
				backendTiming.flowListMs = Number(java.lang.System.currentTimeMillis()) - flowListStarted;
				var flows = arrayValue(flowList.flows || flowList.items || flowList);
				var compact = compactFlows(flows);
				var appFlows = compact.filter(function (flow) {
					return flow.sample !== true;
				});
				var hasWantedFlow = !wantedQName || compact.some(function (flow) {
					return flowMatchesQName(flow, wantedQName, args.project);
				});
				var catalog = { blocks: [] };
				if (hardening) {
					var catalogStarted = Number(java.lang.System.currentTimeMillis());
					catalog = ctx.blockList({
						projectDir: args.projectDir,
						includePrivate: true,
						includeInternal: true,
						detail: "compact",
						limit: 1000,
						doc: false,
						hints: false
					});
					backendTiming.catalogMs = Number(java.lang.System.currentTimeMillis()) - catalogStarted;
				}
				var mocks = [];
				(catalog.blocks || []).forEach(function (block) {
					if (isMock(block)) {
						mocks.push(compactMock(block));
					}
				});
				mocks.sort(function (a, b) {
					return String(a.block).localeCompare(String(b.block));
				});
				if (includeFrontend && progressBudget.expired()) {
					response = mcp.toolResponse(request, progressBudget.partial({
						ok: true,
						project: args.project || "",
						qname: wantedQName,
						backend: {
							flowCount: compact.length,
							appFlowCount: appFlows.length,
							flows: compact.slice(0, 20)
						},
						mocks: { count: mocks.length, items: mocks },
						next: "Continue with nextCursor for the frontend structure and binding phases."
					}, 1, "backend"), ctx);
					ctx.write(out, response);
					return response;
				}
				var frontend = includeFrontend
					? (hardening ? frontendSummary(ctx, args) : frontendPocSummary(ctx, args))
					: { checked: false };
				if (includeFrontend && hardening) {
					frontend = enrichFrontendBindings(ctx, args, frontend);
				}
				var auditQName = wantedQName || (appFlows.length === 1 ? appFlows[0].qname || appFlows[0].name : "");
				var debt = {
					checked: hardening,
					unusedProjectBlocks: [],
					unusedFrontendOutputs: []
				};
				if (hardening) {
					var debtStarted = Number(java.lang.System.currentTimeMillis());
					debt.unusedProjectBlocks = unusedProjectBlocks(ctx, args, compact);
					debt.unusedFrontendOutputs = unusedFrontendOutputs(ctx, mcp, args, frontend, auditQName);
					backendTiming.debtMs = Number(java.lang.System.currentTimeMillis()) - debtStarted;
				}
				var tasks = [];
				addTask(tasks, "flowEngine", "FlowEngine readable", true, "");
				addTask(tasks, "backendFlow", wantedQName ? "Requested backend Flow exists" : "At least one app backend Flow exists",
					wantedQName ? hasWantedFlow : appFlows.length > 0,
					wantedQName ? "Create or register " + wantedQName + " with code-set/code-promote." : "Create the main backend Flow with code-set.");
				addTask(tasks, "mockDebt", "No explicit project-local mocks remain", mocks.length === 0,
					"Implement or remove " + mocks.length + " mock block(s) before claiming completion.");
				if (includeFrontend) {
					addTask(tasks, "frontendBuilder", "Svelte frontend builder is readable", frontend.hasBuilder === true,
						"Bootstrap UI with flow-project-bootstrap({ project, ui:true }).");
					addTask(tasks, "frontendPaperboard", "Frontend route/page structure exists",
						frontend.hasRoutes === true && frontend.hasPage === true && frontend.hasStructure === true,
						"Create a first paperboard page from palette blocks, then generate.");
					addTask(tasks, "frontendVisibleBlocks", "Frontend paperboard has visible blocks",
						frontend.paperboard && frontend.paperboard.blocks && frontend.paperboard.blocks.length > 0,
						"Insert visible intent blocks such as PageShell, Card, Text, Button, Status or Table.");
					addTask(tasks, "frontendActionWiring", "Frontend action wiring exists",
						frontend.paperboard && frontend.paperboard.actions && frontend.paperboard.actions.length > 0,
						"Wire the primary button/event to a backend Flow or typed mock.");
					addTask(tasks, "frontendBindings", "Frontend bindings are structured and schema-backed",
						arrayValue(frontend.bindingWarnings).length === 0,
						arrayValue(frontend.bindingWarnings).length ? frontend.bindingWarnings[0].message +
							(frontend.bindingWarnings[0].suggestedSource ? " Suggested source: " + frontend.bindingWarnings[0].suggestedSource : "") : "");
					addTask(tasks, "frontendStructure", "Frontend actions and lifecycle state are structurally safe",
						arrayValue(frontend.structureWarnings).length === 0,
						arrayValue(frontend.structureWarnings).length ? frontend.structureWarnings[0].message : "");
					addTask(tasks, "frontendActions", "Frontend generate/build/dev actions are available",
						arrayValue(frontend.actionIds).length > 0,
						"Inspect frontend-svelte-actions and fix the builder setup if no action is available.");
				}
				var pocTaskIds = {
					flowEngine: true,
					backendFlow: true,
					frontendBuilder: true,
					frontendPaperboard: true,
					frontendVisibleBlocks: true,
					frontendActionWiring: true
				};
				var activeTasks = hardening ? tasks : tasks.filter(function (task) {
					return pocTaskIds[task.id] === true;
				});
				var deferredTasks = hardening ? [] : tasks.filter(function (task) {
					return pocTaskIds[task.id] !== true;
				}).map(function (task) {
					return {
						id: task.id,
						label: task.label
					};
				});
				var pocReady = tasks.filter(function (task) {
					return pocTaskIds[task.id] === true;
				}).every(function (task) {
					return task.done === true;
				});
				var completed = activeTasks.filter(function (task) {
					return task.done === true;
				}).length;
				var nextActions = activeTasks.filter(function (task) {
					return task.done !== true && task.next;
				}).map(function (task) {
					return task.next;
				});
				var recommendedCalls = [];
				if (includeFrontend && hardening) {
					arrayValue(frontend.bindingPlan && frontend.bindingPlan.calls).forEach(function (call) {
						addRecommendedCall(recommendedCalls, call.tool, call.arguments, call.reason);
					});
					arrayValue(frontend.bindingWarnings).forEach(function (warning) {
						if (warning.fix && warning.fix.tool && warning.fix.arguments) {
							if (warning.fix.tool === "frontend-svelte-mutate" && frontend.bindingPlan && frontend.bindingPlan.fixCount > 0) {
								return;
							}
							addRecommendedCall(recommendedCalls, warning.fix.tool, warning.fix.arguments,
								warning.message || "Resolve the frontend binding warning.");
						} else if (warning.inspect && warning.inspect.tool && warning.inspect.arguments) {
							addRecommendedCall(recommendedCalls, warning.inspect.tool, warning.inspect.arguments,
								warning.message || "Inspect the unresolved frontend binding.");
						}
					});
				}
				if (hardening && (fullDetail || nextActions.length)) {
					addRecommendedCall(recommendedCalls, "flow-block-mock-list", { project: args.project || "" },
						"Confirm no explicit project-local mock remains before claiming completion.");
				}
				if (hardening && (fullDetail || nextActions.length) && auditQName) {
					addRecommendedCall(recommendedCalls, "flow-output-schema", {
						project: args.project || "",
						qname: auditQName,
						detail: "full"
					}, "Review the backend result contract used by pickers and frontend bindings.");
					addRecommendedCall(recommendedCalls, "code-run", {
						project: args.project || "",
						qname: auditQName
					}, "Prove the backend runtime result without resending code.");
				}
				var isComplete = completed === activeTasks.length;
				response = mcp.toolResponse(request, {
					ok: true,
					mode: mode,
					complete: isComplete,
					pocReady: pocReady,
					hardeningComplete: hardening ? isComplete : null,
					partial: false,
					progressPhase: isComplete ? "complete" : "action-required",
					detail: fullDetail ? "full" : "compact",
					project: args.project || "",
					qname: wantedQName,
					progress: {
						completed: completed,
						total: activeTasks.length,
						percent: activeTasks.length ? Math.round((completed * 100) / activeTasks.length) : 100
					},
					tasks: activeTasks,
					deferredTasks: deferredTasks,
					backend: {
						flowCount: compact.length,
						appFlowCount: appFlows.length,
						flows: compact.slice(0, 20),
						debt: debt,
						timing: fullDetail ? backendTiming : undefined
					},
					mocks: {
						checked: hardening,
						count: hardening ? mocks.length : null,
						items: mocks
					},
					frontend: frontendResponse(frontend, fullDetail),
					recommendedCalls: recommendedCalls,
					nextActions: nextActions,
					next: nextActions.length
						? nextActions[0]
						: hardening
							? "Hardening checks are green. Continue with the required runtime proof."
							: "POC is ready. Build and show the first useful preview; run mode:\"hardening\" only on explicit request.",
					workflow: hardening ? {
						goal: "hardening",
						validationPasses: 1
					} : {
						goal: "first-useful-preview",
						timeBudgetMinutes: 15,
						maxRepairPasses: 2,
						acceptPartialResult: true,
						stopAfterPreview: true
					}
				}, ctx);
			} catch (e) {
				response = mcp.toolError(request, e, ctx);
			}
			ctx.write(out, response);
			return response;
		}
	};
}())
