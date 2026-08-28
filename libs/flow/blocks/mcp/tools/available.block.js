const _meta = {
  "version": 1,
  "description": "Returns the Flow MCP tool descriptors.",
  "icon": "mdi:format-list-checks",
  "properties": {
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.tools",
      "description": "Scope path receiving the tool descriptors."
    }
  },
  "outputs": {
    "out": {
      "type": "unknown"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "available tools -> {{ input.out }}",
  "hooks": {
    "file": "available.hooks.js"
  },
  "runtime": "rhino"
}

(function () {
	var TOOL_PREFIX = "mcp.tool.flow.";
	var CODE_TOOL_PREFIX = "mcp.tool.code.";
	var AUTHORING_TOOL_PREFIX = "mcp.tool.authoring.";
	var FRONTEND_TOOL_PREFIX = "mcp.tool.frontend.";
	var PUBLIC_TOOLS = {
		"authoring-mutate": true,
		"authoring-palette": true,
		"authoring-tree": true,
		"code-analyze": true,
		"code-check": true,
		"code-discard": true,
		"code-get": true,
		"code-patch": true,
		"code-promote": true,
		"code-rg": true,
		"code-run": true,
		"code-set": true,
		"code-status": true,
		"flow-block-get": true,
		"flow-block-mock": true,
		"flow-block-mock-list": true,
		"flow-app-progress": true,
		"flow-cache-clear": true,
		"flow-cache-info": true,
		"flow-catalog": true,
		"flow-list": true,
		"flow-node-output-schema": true,
		"flow-output-schema": true,
		"flow-fullsync-scaffold": true,
		"flow-project-bootstrap": true,
		"flow-project-reference": true,
		"flow-project-remove": true,
		"flow-requestable-list": true,
		"flow-requestable-schema": true,
		"flow-resource-delete": true,
		"flow-resource-get": true,
		"flow-resource-patch": true,
		"flow-resource-search": true,
		"flow-schema-reset": true,
		"flow-search": true,
		"flow-sync-inputs": true,
		"flow-test": true,
		"frontend-svelte-action": true,
		"frontend-svelte-asset-import": true,
		"frontend-svelte-actions": true,
		"frontend-svelte-fullsync-schema": true,
		"frontend-svelte-mutate": true,
		"frontend-svelte-tree": true
	};
	var OMIT_SCHEMA_PROPERTIES = {
		allowHugeResult: true,
		projectDir: true,
		doc: true,
		detail: true,
		hints: true,
		includeAnalysis: true,
		includeDefinition: true,
		includeFlow: true,
		includeFullResult: true,
		includeFullTrace: true,
		includeLibraries: true,
		includePrivate: true,
		includeSample: true,
		includeSource: true,
		includeTrace: true,
		includeTypes: true,
		maxArrayItems: true,
		maxDepth: true,
		maxFileBytes: true,
		maxResultChars: true,
		maxTraceChars: true,
		request: true,
		mode: true,
		draft: true
	};

	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function camelToKebab(value) {
		return String(value || "")
			.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
			.replace(/\./g, "-")
			.toLowerCase();
	}

	function toolName(blockName) {
		blockName = String(blockName || "");
		if (blockName.indexOf(CODE_TOOL_PREFIX) === 0) {
			return "code-" + camelToKebab(blockName.substring(CODE_TOOL_PREFIX.length));
		}
		if (blockName.indexOf(AUTHORING_TOOL_PREFIX) === 0) {
			return "authoring-" + camelToKebab(blockName.substring(AUTHORING_TOOL_PREFIX.length));
		}
		if (blockName.indexOf(FRONTEND_TOOL_PREFIX) === 0) {
			return "frontend-" + camelToKebab(blockName.substring(FRONTEND_TOOL_PREFIX.length));
		}
		if (blockName.indexOf(TOOL_PREFIX) === 0) {
			return "flow-" + camelToKebab(blockName.substring(TOOL_PREFIX.length));
		}
		return "";
	}

	function indexBlocks(catalog) {
		var byName = {};
		(catalog.blocks || []).forEach(function (block) {
			if (block.block) {
				byName[block.block] = block;
			}
			if (block.id) {
				byName[block.id] = block;
			}
			if (block.blockId) {
				byName[block.blockId] = block;
			}
			if (block.name) {
				byName[block.name] = block;
			}
		});
		return byName;
	}

	function specificToolSchema(block) {
		var properties = block && (block.props || block.properties) || {};
		var keys = Object.keys(properties).filter(function (key) {
			return key !== "out" && !OMIT_SCHEMA_PROPERTIES[key];
		});
		return keys.length > 0 && !(keys.length === 1 && keys[0] === "request");
	}

	function targetFromWrapperName(blockName, byName) {
		var blockNameText = String(blockName || "");
		if (blockNameText.indexOf(CODE_TOOL_PREFIX) === 0) {
			var codeSuffix = blockNameText.substring(CODE_TOOL_PREFIX.length);
			var codeTarget = "flow.code." + codeSuffix;
			return byName[codeTarget] ? codeTarget : "";
		}
		if (blockNameText.indexOf(AUTHORING_TOOL_PREFIX) === 0) {
			var authoringSuffix = blockNameText.substring(AUTHORING_TOOL_PREFIX.length);
			return "authoring." + authoringSuffix;
		}
		if (blockNameText.indexOf(FRONTEND_TOOL_PREFIX) === 0) {
			var frontendSuffix = blockNameText.substring(FRONTEND_TOOL_PREFIX.length);
			if (frontendSuffix === "svelte.tree") {
				return "authoring.tree";
			}
			if (frontendSuffix === "svelte.palette") {
				return "authoring.palette";
			}
			if (frontendSuffix === "svelte.mutate") {
				return "authoring.mutate";
			}
			if (frontendSuffix === "svelte.actions") {
				return "authoring.menu";
			}
			if (frontendSuffix === "svelte.action") {
				return "authoring.action";
			}
			if (frontendSuffix === "svelte.fullsync.schema") {
				return "frontend.fullsync.schema.attach";
			}
			if (frontendSuffix === "svelte.asset.import") {
				return "frontend.asset.import";
			}
			return "";
		}
		var suffix = blockNameText.substring(TOOL_PREFIX.length);
		if (!suffix) {
			return "";
		}
		if (suffix === "catalog") {
			return "block.list";
		}
		if (suffix === "block.test") {
			return "flow.run";
		}
		if (suffix === "fullsync.scaffold") {
			return "project.fullsync.scaffold";
		}
		if (suffix === "library.search") {
			return "project.library.search";
		}
		var target = "";
		if (["cache.clear", "cache.info"].indexOf(suffix) !== -1) {
			target = suffix;
		} else if (["analyze", "apply", "context", "get", "list", "outputSchema", "run", "schema.reset", "test", "tree"].indexOf(suffix) !== -1) {
			target = "flow." + suffix;
		} else if (suffix.indexOf("code.") === 0 || suffix.indexOf("source.") === 0) {
			target = "flow." + suffix;
		} else if (suffix.indexOf("block.") === 0 || suffix.indexOf("resource.") === 0 ||
				suffix.indexOf("requestable.") === 0 || suffix.indexOf("type.") === 0 ||
				suffix.indexOf("project.") === 0) {
			target = suffix;
		}
		var candidates = target ? [target] : [];
		for (var i = 0; i < candidates.length; i++) {
			if (byName[candidates[i]]) {
				return candidates[i];
			}
		}
		return "";
	}

	function jsonSchemaType(prop) {
		var type = String(prop && prop.type || "").trim();
		var kind = String(prop && prop.kind || "").trim();
		if (["string", "number", "integer", "boolean", "array", "object", "null"].indexOf(type) !== -1) {
			return type;
		}
		if (["expression", "template", "literal"].indexOf(kind) !== -1) {
			return ["string", "number", "integer", "boolean", "array", "object", "null", "unknown"].indexOf(type) !== -1
				? type
				: "object";
		}
		return "string";
	}

	function schemaProperty(prop) {
		var type = jsonSchemaType(prop);
		var out = {
			type: type
		};
		if (type === "unknown") {
			delete out.type;
		}
		["description", "default", "enum", "items", "properties", "required", "additionalProperties", "oneOf", "anyOf"].forEach(function (key) {
			if (prop && prop[key] !== undefined && prop[key] !== null && prop[key] !== "") {
				out[key] = prop[key];
			}
		});
		return out;
	}

	function omitSchemaPropertyForTool(toolName, name) {
		if (name === "code" && /^(?:flow-)?code-(check|run|analyze)$/.test(String(toolName || ""))) {
			return true;
		}
		if (name === "dry" && /^(?:flow-(?:block-)?)?code-(set|patch)$/.test(String(toolName || ""))) {
			return true;
		}
		if ((name === "saveProject" || name === "refresh") && /^(?:flow-)?code-(set|patch)$/.test(String(toolName || ""))) {
			return true;
		}
		if ((name === "saveProject" || name === "refresh" || name === "clearDraft") && /^(?:flow-)?code-promote$/.test(String(toolName || ""))) {
			return true;
		}
		return name === "out" || OMIT_SCHEMA_PROPERTIES[name] === true;
	}

	function inputSchema(block, toolName) {
		var schema = {
			type: "object",
			properties: {},
			additionalProperties: true
		};
		var properties = block && (block.props || block.properties) || {};
		Object.keys(properties).forEach(function (name) {
			if (omitSchemaPropertyForTool(toolName, name)) {
				return;
			}
			schema.properties[name] = schemaProperty(properties[name]);
		});
		if (!schema.properties.project) {
			schema.properties.project = {
				type: "string",
				description: "Target Convertigo project name, not a filesystem path."
			};
		}
		if (toolName === "frontend-svelte-action" || toolName === "frontend-svelte-actions") {
			delete schema.properties.browserDebugPort;
		}
		if (toolName === "authoring-palette") {
			schema.properties.parentPath = {
				type: "string",
				description: "Qualified parentPath returned by authoring-tree. It identifies both the target project and insertion parent."
			};
			delete schema.properties.project;
			delete schema.properties.focusPath;
			schema.required = ["parentPath"];
		}
		if (toolName === "flow-app-progress") {
			schema.properties.qname = {
				type: "string",
				description: "Backend Flow qname for backend/full-stack progress. Omit for a frontend-only application; no synthetic backend Flow is then required."
			};
			schema.properties.mode = {
				type: "string",
				enum: ["poc", "hardening"],
				description: "POC checks only readiness for a first useful preview. Hardening runs the complete schema, debt, mock and structure audit."
			};
			schema.properties.detail = {
				type: "string",
				enum: ["compact", "full"],
				description: "Compact by default. Use full only to inspect complete paperboard and binding inventories."
			};
		}
		var supportsBlockTarget = /^code-(get|set|patch|check|rg)$/.test(String(toolName || ""));
		if (/^code-/.test(String(toolName || ""))) {
			schema.properties.qname = schema.properties.qname || {
				type: "string",
				description: "Executable Flow DBO qname, for example Project.FlowName. Do not use for blocks or flow:// resources."
			};
			if (supportsBlockTarget) {
				schema.properties.block = {
					type: "string",
					description: "Project-local block name, for example sample.sha256. Browser implementations use target:\"frontend\"."
				};
				schema.properties.kind = {
					type: "string",
					enum: ["flow", "block", "source"],
					description: "Optional target kind. Usually inferred from qname, block or sourceFile; use source for the configured Svelte model or project-wide source rg."
				};
				schema.properties.sourceFile = {
					type: "string",
					description: "Canonical project-relative *.flow.svelte or *.flow.css source. Its presence selects source code automatically."
				};
				schema.properties.target = {
					type: "string",
					enum: ["backend", "frontend"],
					description: "Backward-compatible selector. With block it selects that implementation; frontend without block selects the configured Svelte source."
				};
				if (toolName === "code-set" || toolName === "code-patch") {
					schema.properties.finalize = {
						type: "boolean",
						description: "For a frontend-only block, remove mock metadata after writing the complete implementation."
					};
					schema.properties.reveal = {
						type: "boolean",
						description: "For canonical frontend source writes, refresh and reveal the affected source in the Studio project tree."
					};
				}
			}
			if (toolName === "code-get") {
					schema.properties.pattern = {
						type: "string",
						description: "Optional text/regex search pattern. When present, code-get returns small extracts like code-rg instead of full code."
					};
					schema.properties.query = {
						type: "string",
						description: "Alias for pattern."
					};
					schema.properties.q = {
						type: "string",
						description: "Short alias for pattern."
					};
					schema.properties.regex = {
						type: "boolean",
						description: "Treat pattern as a regular expression."
					};
					schema.properties.caseSensitive = {
						type: "boolean",
						description: "Use case-sensitive matching."
					};
					schema.properties.context = {
						type: "integer",
						description: "Context lines around each match."
					};
					schema.properties.limit = {
						type: "integer",
						description: "Maximum number of extracts."
					};
				}
			}
		if (/^(?:flow-)?code-(set|patch|check|run|analyze|promote)$/.test(String(toolName || ""))) {
			schema.properties.maxDiagnostics = {
				type: "integer",
				description: "Maximum diagnostics to return. Default 8, max 25."
			};
		}
		if (toolName === "code-patch" && schema.properties.codepatch) {
			schema.properties.codepatch.description = "Git-style unified diff with numbered hunk headers such as @@ -1,1 +1,1 @@; do not use *** Begin Patch wrappers or bare @@ headers.";
		}
		if (toolName === "flow-resource-patch") {
			schema.properties.scope = {
				type: "string",
				enum: ["project", "engine-internal"],
				default: "project",
				description: "Project patches use path+patch. engine-internal performs a bounded, staged and revision-checked lib_flow_engine synchronization."
			};
			schema.properties.revision = {
				type: "string",
				description: "Target Git commit id required by engine-internal synchronization."
			};
			schema.properties.files = {
				type: "array",
				maxItems: 16,
				description: "engine-internal only: complete files with path, content, current baseHash and target sha256.",
				items: {
					type: "object",
					required: ["path", "content", "baseHash", "sha256"],
					properties: {
						path: { type: "string" },
						content: { type: "string" },
						baseHash: { type: "string" },
						sha256: { type: "string" }
					}
				}
			};
		}
		return schema;
	}

	function descriptorFor(wrapper, byName, contractFor) {
		var blockId = wrapper.blockId || wrapper.name || wrapper.block || "";
		var name = toolName(blockId);
		if (!name || PUBLIC_TOOLS[name] !== true) {
			return null;
		}
		var target = targetFromWrapperName(blockId, byName);
		var capability = target ? contractFor(target) : null;
		var source = specificToolSchema(wrapper) ? wrapper : capability || wrapper;
		var description = String(name.indexOf("code-") === 0
			? wrapper.description || source.description || "Flow MCP tool."
			: name === "flow-block-test"
			? wrapper.description || source.description || "Flow MCP tool."
			: source.description || wrapper.description || "Flow MCP tool.");
		if (name === "code-set") {
			description = "Writes/checks FlowScript, a canonical source selected by sourceFile, or a target-specific project block implementation.";
		} else if (name === "code-patch") {
			description = "Patches FlowScript, a revision-checked canonical source, or a project block implementation.";
		} else if (name === "code-check") {
			description = "Checks FlowScript, a canonical source selected by sourceFile, or a project block implementation.";
		} else if (name === "code-promote") {
			description = "Executable Flow only: saves a checked working copy. Do not call for project-local blocks; code-set/code-patch already save blocks.";
			} else if (name === "code-get") {
				description = "Reads code addressed by qname, block or sourceFile; with pattern/query/q returns small extracts like code-rg. Do not use for flow:// resources.";
			} else if (name === "code-rg") {
				description = "Searches FlowScript, block code or canonical frontend sources. Use kind:\"source\" without sourceFile for project-wide Flow Svelte/CSS rg.";
			}
		if (name === "flow-catalog") {
			description = "Focused palette search. Requires project. Use only after code diagnostics; keep query narrow.";
		} else if (name === "authoring-tree") {
			description = "Generic authoring tree for frontend/Flow surfaces. Requires project; catalogs are omitted by default because authoring-palette resolves blocks contextually.";
		} else if (name === "authoring-palette") {
			description = "Contextual palette for one qualified parentPath. Searches the project, references and workspace; execute items[].apply unchanged.";
		} else if (name === "authoring-mutate") {
			description = "Applies a generic authoring mutation through the engine/frontbuilder contract. Requires project.";
		} else if (name === "frontend-svelte-tree") {
			description = "Svelte frontend authoring tree. Use compact detail for structure. For one picker use detail:'inspect', an exact focusPath, maxDepth:0, property:'source' (or another exact bindable property) and sourceId when known; untargeted inspect only summarizes candidate counts.";
		} else if (name === "frontend-svelte-palette") {
			description = "Svelte frontend palette for a tree focusPath. Execute items[].apply unchanged when present; it contains the exact source file and structured mutation.";
		} else if (name === "frontend-svelte-mutate") {
			description = "Applies Svelte frontend tree mutations. Bindable properties accept intuitive @action.path/@item.path references or the structured mutation returned by the picker; bare string paths are rejected.";
		} else if (name === "frontend-svelte-fullsync-schema") {
			description = "Learns a safe read requestable schema and attaches it to one FullSync action using the exact path from flow-app-progress.";
		} else if (name === "frontend-svelte-actions") {
			description = "Lists available Svelte frontend actions such as generate, build and dev server commands for the target project.";
		} else if (name === "frontend-svelte-action") {
			description = "Runs one Svelte frontend action. Shortcuts include generate, build, openBuilt, dev.start, dev.stop, dev.open and dev.sync. Use dev.start with wait:false immediately after UI bootstrap or the first frontend read: it generates the starter app, overlaps npm setup with authoring, then starts Vite and opens the Studio viewer automatically. One final dev.sync regenerates the completed source. Before Playwright, call dev.open and require browserControlReady:true. Build is a separate production or deployment check.";
		} else if (name === "flow-list") {
			description = "Lists executable Flows for one project. Requires project; do not call for fresh authoring.";
		} else if (name === "flow-search") {
			description = "Focused search over one project. Requires project; max 10 results. Do not use as a broad block inventory.";
		} else if (name === "flow-block-get") {
			description = "Reads one block signature by name (the block alias is also accepted). Compact by default; use code-get block:\"name\" for source.";
		} else if (name === "flow-block-mock") {
			description = "Creates a typed project-local mock after UNKNOWN_BLOCK; keeps parent Flow executable while real block is built.";
		} else if (name === "flow-block-mock-list") {
			description = "Lists explicit mock blocks still present in a project. Use before claiming a Flow is complete.";
		} else if (name === "flow-app-progress") {
			description = "Reports progress toward a fast POC or explicit hardening. Omit qname for frontend-only work; provide the backend Flow qname for backend/full-stack work. Use mode:'poc' for the first useful preview and mode:'hardening' only on request.";
		} else if (name === "flow-output-schema") {
			description = "Reads/adopts/removes a Flow result schema contract, or resets learned result schemas. Use before wiring downstream pickers.";
		} else if (name === "flow-node-output-schema") {
			description = "Reads, adopts or removes the output schema for one Flow node. Use for HTTP/exec/parse learning diagnostics.";
		} else if (name === "flow-project-bootstrap") {
			description = "Imports or customizes a project for Flow authoring from the sequence template, then adds FlowEngine via DBO APIs.";
		} else if (name === "flow-library-search") {
			description = "Finds workspace Flow libraries and matching backend blocks or Svelte components without loading every provider.";
		} else if (name === "flow-project-reference") {
			description = "Resolves a selected workspace provider and adds its project reference through DBO APIs so shared Flow and Svelte blocks become available.";
		} else if (name === "flow-project-remove") {
			description = "Safely unloads a Studio project or deletes its workspace content. Starts with dryRun:true and blocks dirty, linked, Git-backed or referenced projects by default.";
		} else if (name === "flow-fullsync-scaffold") {
			description = "Creates FullSync connector, design documents and standard transactions through DBO APIs. Start with dryRun:true; apply reports saved DBOs separately from live CouchDB readiness and returns a repair call on failure. PostBulkDocuments accepts complete document arrays through _use_json_base.";
		} else if (name === "flow-resource-search") {
			description = "Searches project-local Flow files. Requires project; not for executable Flow code. Prefer code-get/code-rg for FlowScript.";
		} else if (name === "flow-resource-delete") {
			description = "Deletes one project-local Flow resource. Requires project, path and optionally baseHash.";
		} else if (name === "flow-resource-get") {
			description = "Reads one project-local Flow resource preview. Requires project; use resources/read for flow:// guides.";
		} else if (name === "flow-resource-patch") {
			description = "Patches one project resource, or synchronizes bounded lib_flow_engine internals with staging, hash checks and rollback.";
		} else if (name === "flow-cache-clear") {
			description = "Debug only: clears runtime caches when automatic invalidation is suspected stale. Do not use during normal authoring.";
		} else if (name === "flow-cache-info") {
			description = "Compact runtime cache diagnostics. Avoid during normal authoring.";
		} else if (name === "flow-sync-inputs") {
			description = "Synchronizes FlowScript _flow.inputs to Flow request variables and clears stale Flow dirty flags.";
		} else if (name === "flow-requestable-list") {
			description = "Lists requestables for one project. Requires project; use only when legacy requestables are needed.";
		} else if (name === "flow-test") {
			description = "Saved-flow validation only. For FlowScript drafts use code-run after code-set/code-patch.";
		}
		return {
			name: name,
			description: description.length > 120 ? description.substring(0, 117) + "..." : description,
			inputSchema: inputSchema(source, name)
		};
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var names;
			var byName;
			var contractFor;
			if (typeof ctx.blockNames === "function" && typeof ctx.blockContract === "function") {
				names = ctx.blockNames();
				byName = {};
				var contracts = {};
				names.forEach(function (name) {
					byName[name] = true;
				});
				contractFor = function (name) {
					if (!byName[name]) {
						return null;
					}
					if (!Object.prototype.hasOwnProperty.call(contracts, name)) {
						contracts[name] = ctx.blockContract(name);
					}
					return contracts[name];
				};
			} else {
				var catalog = ctx.blockList({ includePrivate: true, detail: "compact", limit: 500, doc: false, hints: false });
				byName = indexBlocks(catalog);
				names = (catalog.blocks || []).map(function (block) {
					return block.block || block.blockId || block.name;
				});
				contractFor = function (name) { return byName[name] || null; };
			}
			var tools = [];
			names.forEach(function (name) {
				var publicName = toolName(name);
				if (!publicName || PUBLIC_TOOLS[publicName] !== true) {
					return;
				}
				var block = contractFor(name);
				var descriptor = block ? descriptorFor(block, byName, contractFor) : null;
				if (descriptor) {
					tools.push(descriptor);
				}
			});
			tools.sort(function (a, b) {
				return a.name.localeCompare(b.name);
			});
			ctx.write(props.out || "local.tools", tools);
			return tools;
		}
	};
}())
