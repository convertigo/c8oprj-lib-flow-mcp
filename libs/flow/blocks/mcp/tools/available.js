(function () {
	var TOOL_PREFIX = "mcp.tool.flow.";
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
		includeSource: true,
		includeTrace: true,
		includeTypes: true,
		maxArrayItems: true,
		maxDepth: true,
		maxFileBytes: true,
		maxResultChars: true,
		maxTraceChars: true,
		mode: true
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
		if (String(blockName || "").indexOf(TOOL_PREFIX) !== 0) {
			return "";
		}
		return "flow-" + camelToKebab(String(blockName).substring(TOOL_PREFIX.length));
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
		var suffix = String(blockName || "").substring(TOOL_PREFIX.length);
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
		if (["analyze", "apply", "context", "get", "list", "outputSchema", "run", "schema.reset", "test", "tree"].indexOf(suffix) !== -1) {
			target = "flow." + suffix;
		} else if (suffix.indexOf("block.") === 0 || suffix.indexOf("resource.") === 0 || suffix.indexOf("type.") === 0) {
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
			return type || "object";
		}
		return type || "string";
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

	function inputSchema(block) {
		var schema = {
			type: "object",
			properties: {},
			additionalProperties: true
		};
		var properties = block && (block.props || block.properties) || {};
		Object.keys(properties).forEach(function (name) {
			if (name === "out" || OMIT_SCHEMA_PROPERTIES[name] === true) {
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
		return schema;
	}

	function descriptorFor(ctx, wrapper, byName) {
		var blockId = wrapper.blockId || wrapper.name || wrapper.block || "";
		var name = toolName(blockId);
		if (!name) {
			return null;
		}
		var target = targetFromWrapperName(blockId, byName);
		var capability = target ? byName[target] : null;
		var source = specificToolSchema(wrapper) ? wrapper : capability || wrapper;
		var description = String(source.description || wrapper.description || "Flow MCP tool.");
		return {
			name: name,
			description: description.length > 120 ? description.substring(0, 117) + "..." : description,
			inputSchema: inputSchema(source)
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
