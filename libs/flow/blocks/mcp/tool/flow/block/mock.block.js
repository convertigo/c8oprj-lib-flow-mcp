const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:puzzle-plus-outline",
  "tags": [
    "mcp",
    "flowscript",
    "block",
    "mock"
  ],
  "description": "Creates a typed project-local FlowScript mock after UNKNOWN_BLOCK, with a visible TODO.",
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
    "name": {
      "kind": "text",
      "type": "string",
      "description": "Project-local block name, for example weather.current."
    },
    "block": {
      "kind": "text",
      "type": "string",
      "description": "Alias for name."
    },
    "description": {
      "kind": "text",
      "type": "string",
      "description": "Short block description."
    },
    "properties": {
      "kind": "literal",
      "type": "object",
      "description": "Block input property descriptors keyed by property name."
    },
    "outputs": {
      "kind": "literal",
      "type": "object",
      "description": "Block output schema. Prefer {out:{...}}; a plain schema is wrapped as out."
    },
    "schema": {
      "kind": "literal",
      "type": "object",
      "description": "Alias for the returned value schema, wrapped as outputs.out."
    },
    "mockValue": {
      "kind": "literal",
      "type": "object",
      "description": "Optional literal value returned by the mock. If omitted, one is generated from outputs.out."
    },
    "target": {
      "kind": "text",
      "type": "string",
      "description": "Optional execution target: backend, frontend or both. Backend is the compatibility default."
    },
    "targets": {
      "kind": "literal",
      "type": "array",
      "description": "Explicit execution targets, for example [\"frontend\"] or [\"backend\",\"frontend\"]."
    },
    "overwrite": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Allow replacing an existing project-local block."
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
  "display": "tool flow-block-mock -> {{ input.out }}"
}

(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function nonEmpty(value) {
		return value !== undefined && value !== null && String(value).trim() !== "";
	}

	function bool(value) {
		return value === true || String(value) === "true";
	}

	function copyJson(value) {
		return value === undefined || value === null ? {} : JSON.parse(JSON.stringify(value));
	}

	function blockLocalName(name) {
		var parts = String(name || "").split(".");
		return parts[parts.length - 1] || "block";
	}

	function safeIdentifier(value) {
		var text = String(value || "mock").replace(/[^A-Za-z0-9_$]/g, "_");
		if (!text || !text.charAt(0).match(/[A-Za-z_$]/)) {
			text = "_" + text;
		}
		return text;
	}

	function normalizeProperties(args) {
		return copyJson(args.properties || args.props || args.inputs || {});
	}

	function looksLikeSchema(value) {
		return value && typeof value === "object" &&
			(value.type !== undefined || value.properties !== undefined || value.items !== undefined ||
				value.anyOf !== undefined || value.oneOf !== undefined || value.allOf !== undefined);
	}

	function normalizeOutputs(args) {
		var source = args.outputs !== undefined && args.outputs !== null ? args.outputs
			: args.output !== undefined && args.output !== null ? args.output
			: args.schema !== undefined && args.schema !== null ? args.schema
			: args.outputSchema;
		if (!source || typeof source !== "object") {
			return {
				outputs: {
					out: {
						type: "object",
						properties: {
							mocked: { type: "boolean" }
						}
					}
				},
				defaulted: true
			};
		}
		source = copyJson(source);
		if (source.out !== undefined) {
			return { outputs: source, defaulted: false };
		}
		if (looksLikeSchema(source)) {
			return { outputs: { out: source }, defaulted: false };
		}
		return {
			outputs: {
				out: {
					type: "object",
					properties: source
				}
			},
			defaulted: false
		};
	}

	function firstSchema(schema) {
		if (!schema || typeof schema !== "object") {
			return schema;
		}
		var choices = schema.anyOf || schema.oneOf || schema.allOf;
		if (choices && choices.length) {
			return choices[0];
		}
		return schema;
	}

	function sampleForSchema(schema, key) {
		schema = firstSchema(schema || {});
		if (schema && schema["default"] !== undefined) {
			return schema["default"];
		}
		if (schema && schema["const"] !== undefined) {
			return schema["const"];
		}
		if (schema && schema["enum"] && schema["enum"].length) {
			return schema["enum"][0];
		}
		var type = String(schema && schema.type || "").toLowerCase();
		if (!type && schema && schema.properties) {
			type = "object";
		}
		if (!type && schema && schema.items) {
			type = "array";
		}
		if (type === "array") {
			return [sampleForSchema(schema.items || {}, "item")];
		}
		if (type === "object") {
			var out = {};
			var properties = schema.properties || {};
			Object.keys(properties).forEach(function (name) {
				out[name] = sampleForSchema(properties[name], name);
			});
			if (Object.keys(out).length === 0) {
				out.mocked = true;
			}
			return out;
		}
		if (type === "integer") {
			return 0;
		}
		if (type === "number") {
			return 0;
		}
		if (type === "boolean") {
			return false;
		}
		if (type === "null") {
			return null;
		}
		return key ? String(key) : "";
	}

	function mockValue(args, outputs) {
		if (args.mockValue !== undefined) {
			return args.mockValue;
		}
		if (args.sample !== undefined) {
			return args.sample;
		}
		if (args.sampleOutput !== undefined) {
			return args.sampleOutput;
		}
		return sampleForSchema(outputs.out || outputs);
	}

	function warning(code, message, hint) {
		return {
			severity: "warning",
			code: code,
			message: message,
			hint: hint
		};
	}

	function mockCode(name, value) {
		var functionName = safeIdentifier(blockLocalName(name));
		var literal = JSON.stringify(value, null, 2).split("\n").map(function (line, index) {
			return index === 0 ? line : "  " + line;
		}).join("\n");
		return [
			"function " + functionName + "({ input, config, result }) {",
			"  // TODO: replace this explicit mock with the real FlowScript implementation.",
			"  return " + literal,
			"}",
			""
		].join("\n");
	}

	function requestedTargets(args) {
		var source = args.targets !== undefined && args.targets !== null ? args.targets : args.target;
		var targets = Object.prototype.toString.call(source) === "[object Array]" ? source.slice() : nonEmpty(source) ? [source] : ["backend"];
		var out = [];
		targets.forEach(function (target) {
			target = String(target || "").toLowerCase();
			if (target === "both" || target === "dual") {
				if (out.indexOf("backend") === -1) out.push("backend");
				if (out.indexOf("frontend") === -1) out.push("frontend");
			} else if ((target === "backend" || target === "frontend") && out.indexOf(target) === -1) {
				out.push(target);
			}
		});
		if (!out.length) throw new Error("flow-block-mock target must be backend, frontend or both.");
		return out;
	}

	function browserFileName(name) {
		return blockLocalName(name) + ".browser.js";
	}

	function browserMockCode(value) {
		return [
			"function (input) {",
			"  // TODO: replace this explicit frontend mock with the real browser implementation.",
			"  return " + JSON.stringify(value, null, 2).split("\n").join("\n  "),
			"}",
			""
		].join("\n");
	}

	function writeBrowserMock(projectDir, name, value, overwrite) {
		var File = Packages.java.io.File;
		var FileUtils = Packages.org.apache.commons.io.FileUtils;
		var parts = String(name || "").split(".");
		if (!parts.length || parts.some(function (part) { return !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(part); })) {
			throw new Error("Frontend mock block names must use dot-separated identifiers.");
		}
		var relative = "libs/flow/blocks/" + parts.join("/") + ".browser.js";
		var root = new File(String(projectDir || "")).getCanonicalFile();
		var file = new File(root, relative).getCanonicalFile();
		if (file.exists() && !overwrite) throw new Error("Frontend mock implementation already exists: " + relative);
		file.getParentFile().mkdirs();
		FileUtils.writeStringToFile(file, browserMockCode(value), "UTF-8");
		return relative;
	}

	function descriptor(name, args, properties, outputs, targets) {
		var tags = args.tags || [];
		if (Object.prototype.toString.call(tags) !== "[object Array]") {
			tags = [String(tags)];
		}
		if (tags.indexOf("mock") === -1) {
			tags.push("mock");
		}
		if (tags.indexOf("todo") === -1) {
			tags.push("todo");
		}
		var implementations = {};
		if (targets.indexOf("backend") !== -1) implementations.backend = { runtime: "flow" };
		if (targets.indexOf("frontend") !== -1) implementations.frontend = { runtime: "browser", file: browserFileName(name) };
		return {
			version: 1,
			icon: args.icon || "mdi:puzzle-plus-outline",
			description: args.description || "TODO implement " + name + ".",
			longDescription: args.longDescription || "Generated Flow mock. It keeps high-level FlowScript executable while the real block implementation is still missing.",
			properties: properties,
			outputs: outputs,
			targets: targets,
			effects: [],
			implementations: implementations,
			tags: tags,
			mock: true,
			todo: args.todo || "Implement this block with real FlowScript before considering the parent Flow complete.",
			"private": args["private"] !== undefined && args["private"] !== null && args["private"] !== "" ? bool(args["private"]) : false
		};
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
				if (!args.project && !args.projectDir) {
					throw new Error("flow-block-mock requires project:\"<target project>\" or projectDir for standalone tests.");
				}
				var name = String(args.name || args.block || args.blockName || "").trim();
				if (!name) {
					var missing = new Error("flow-block-mock requires name or block.");
					missing.code = "MISSING_BLOCK_NAME";
					missing.hint = "Use flow-block-mock with name:\"namespace.name\" and typed properties/outputs.";
					throw missing;
				}
				var properties = normalizeProperties(args);
				var normalizedOutputs = normalizeOutputs(args);
				var value = mockValue(args, normalizedOutputs.outputs);
				var targets = requestedTargets(args);
				var blockResult = ctx.callBlock("block.code.set", {
					name: name,
					projectDir: args.projectDir,
					code: mockCode(name, value),
					descriptor: descriptor(name, args, properties, normalizedOutputs.outputs, targets),
					overwrite: bool(args.overwrite)
				}, { trace: false });
				if (targets.indexOf("frontend") !== -1) {
					blockResult.browserFile = writeBrowserMock(args.projectDir, name, value, bool(args.overwrite));
				}
				blockResult.mock = true;
				blockResult.targets = targets;
				blockResult.next = targets.indexOf("frontend") !== -1
					? "Implement the browser function for " + name + ", then remove mock:true/TODO. Frontends using this block are not complete while this mock remains."
					: "Implement " + name + " with real FlowScript, then remove mock:true/TODO. Parent Flows using this block are not complete while this mock remains.";
				blockResult.warnings = (blockResult.warnings || []).concat([
					warning("FLOW_BLOCK_MOCK_CREATED",
						"Created explicit mock Flow block " + name + ".",
						"Use this only to keep high-level FlowScript executable while implementing the missing sub-block. Do not treat parent Flow behavior as complete while mock:true remains.")
				]);
				if (normalizedOutputs.defaulted) {
					blockResult.warnings.push(warning("FLOW_BLOCK_MOCK_OUTPUT_DEFAULTED",
						"flow-block-mock defaulted outputs.out to a generic mocked object.",
						"Pass outputs:{out:{...}} or schema:{...} so pickers and downstream Flows see the real contract."));
				}
				response = mcp.toolResponse(request, blockResult, ctx);
			} catch (e) {
				response = mcp.toolError(request, e, ctx);
			}
			ctx.write(out, response);
			return response;
		}
	};
}())
