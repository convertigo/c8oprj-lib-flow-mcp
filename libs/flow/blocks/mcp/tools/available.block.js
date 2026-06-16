const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:format-list-checks",
  "tags": [
    "mcp"
  ],
  "description": "Returns the Flow MCP tool descriptors.",
  "display": "available tools -> {{ input.out }}",
  "hooks": {
    "file": "available.hooks.js"
  },
  "properties": {
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.tools",
      "description": "Scope path receiving the tool descriptors."
    }
  },
  "runtime": "rhino"
}

(function () {
	var TOOL_PREFIX = "mcp.tool.flow.";
	var CODE_TOOL_PREFIX = "mcp.tool.code.";
	var PUBLIC_TOOLS = {
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
		"flow-cache-clear": true,
		"flow-cache-info": true,
		"flow-catalog": true,
		"flow-list": true,
		"flow-requestable-list": true,
		"flow-requestable-schema": true,
		"flow-resource-get": true,
		"flow-resource-patch": true,
		"flow-resource-search": true,
		"flow-schema-reset": true,
		"flow-search": true,
		"flow-test": true
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
		var target = "";
		if (["cache.clear", "cache.info"].indexOf(suffix) !== -1) {
			target = suffix;
		} else if (["analyze", "apply", "context", "get", "list", "outputSchema", "run", "schema.reset", "test", "tree"].indexOf(suffix) !== -1) {
			target = "flow." + suffix;
		} else if (suffix.indexOf("code.") === 0 || suffix.indexOf("source.") === 0) {
			target = "flow." + suffix;
		} else if (suffix.indexOf("block.") === 0 || suffix.indexOf("resource.") === 0 ||
				suffix.indexOf("requestable.") === 0 || suffix.indexOf("type.") === 0) {
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
		["enum", "items"].forEach(function (key) {
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
				description: "Target project."
			};
		}
		var supportsBlockTarget = /^code-(get|set|patch|rg)$/.test(String(toolName || ""));
			if (/^code-/.test(String(toolName || ""))) {
				schema.properties.qname = schema.properties.qname || {
					type: "string",
					description: "Executable Flow DBO qname, for example Project.FlowName. Do not use for blocks or flow:// resources."
				};
			if (supportsBlockTarget) {
				schema.properties.block = {
					type: "string",
					description: "Project-local FlowScript block name, for example sample.sha256. Supported only by code-get, code-set, code-patch and code-rg."
				};
				schema.properties.kind = {
					type: "string",
					enum: ["flow", "block"],
					description: "Optional explicit target kind. Usually inferred from block or qname."
					};
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
		return schema;
	}

	function descriptorFor(ctx, wrapper, byName) {
		var blockId = wrapper.blockId || wrapper.name || wrapper.block || "";
		var name = toolName(blockId);
		if (!name || PUBLIC_TOOLS[name] !== true) {
			return null;
		}
		var target = targetFromWrapperName(blockId, byName);
		var capability = target ? byName[target] : null;
		var source = specificToolSchema(wrapper) ? wrapper : capability || wrapper;
		var description = String(name.indexOf("code-") === 0
			? wrapper.description || source.description || "Flow MCP tool."
			: name === "flow-block-test"
			? wrapper.description || source.description || "Flow MCP tool."
			: source.description || wrapper.description || "Flow MCP tool.");
		if (name === "code-set") {
			description = "Writes/checks FlowScript. For executable Flows it updates a working copy; for project-local blocks it saves the .block.js directly.";
		} else if (name === "code-patch") {
			description = "Patches FlowScript. For executable Flows patch the working copy; for project-local blocks patch the saved .block.js directly.";
		} else if (name === "code-promote") {
			description = "Executable Flow only: saves a checked working copy. Do not call for project-local blocks; code-set/code-patch already save blocks.";
			} else if (name === "code-get") {
				description = "Reads FlowScript for qname:\"Project.Flow\" or block:\"namespace.name\"; with pattern/query/q returns small extracts like code-rg. Do not use for flow:// resources.";
			}
		if (name === "flow-catalog") {
			description = "Focused palette search. Requires project. Use only after code diagnostics; keep query narrow.";
		} else if (name === "flow-list") {
			description = "Lists executable Flows for one project. Requires project; do not call for fresh authoring.";
		} else if (name === "flow-block-get") {
			description = "Reads one block signature. Compact by default; use code-get block:\"name\" for source.";
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
			var catalog = ctx.blockList({ includePrivate: true, detail: "compact", limit: 500, doc: false, hints: false });
			var byName = indexBlocks(catalog);
			var tools = [];
			(catalog.blocks || []).forEach(function (block) {
				var descriptor = descriptorFor(ctx, block, byName);
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
