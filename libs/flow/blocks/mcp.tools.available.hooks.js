(function () {
	var TOOL_PREFIX = "mcp.tool.flow.";

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
			byName[block.name] = block;
		});
		return byName;
	}

	function targetFromImplementation(ctx, blockName) {
		try {
			var source = String((ctx.blockGet(blockName, {}) || {}).implementationSource || "");
			var match = source.match(/\btarget:\s*["']?([A-Za-z0-9_.-]+)/);
			return match ? match[1] : "";
		} catch (e) {
			return "";
		}
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
		var out = {
			type: jsonSchemaType(prop)
		};
		["description", "default", "enum", "items"].forEach(function (key) {
			if (prop && prop[key] !== undefined && prop[key] !== null && prop[key] !== "") {
				out[key] = prop[key];
			}
		});
		return out;
	}

	function inputSchema(block) {
		var schema = {
			type: "object",
			properties: {}
		};
		Object.keys(block && block.props || {}).forEach(function (name) {
			if (name === "out") {
				return;
			}
			schema.properties[name] = schemaProperty(block.props[name]);
		});
		if (!schema.properties.project) {
			schema.properties.project = {
				type: "string",
				description: "Target Convertigo project name."
			};
		}
		if (!schema.properties.projectDir) {
			schema.properties.projectDir = {
				type: "string",
				description: "Target project directory for standalone tests."
			};
		}
		return schema;
	}

	function descriptorFor(ctx, wrapper, byName) {
		var name = toolName(wrapper.name);
		if (!name) {
			return null;
		}
		var target = targetFromImplementation(ctx, wrapper.name);
		var capability = target ? byName[target] : null;
		var source = capability || wrapper;
		return {
			name: name,
			description: source.description || wrapper.description || "Flow MCP tool.",
			inputSchema: inputSchema(source)
		};
	}

	return {
		displayName: function (node) {
			return "available tools -> " + (prop(node, "out") || "local.tools");
		},

		analyze: function (ctx, node) {
			var out = ctx.props(node).out;
			if (out) {
				ctx.addPath(out);
			}
		}
	};
}())
