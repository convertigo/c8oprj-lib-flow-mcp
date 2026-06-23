const _meta = {
  "version": 1,
  "description": "Reads, adopts or removes an executable Flow output schema contract.",
  "icon": "mdi:code-json",
  "uses": [
    "mcp"
  ],
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object."
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
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "tool flow-output-schema -> {{ input.out }}"
}

// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html
(function () {
	function clone(value) {
		return value === undefined || value === null ? {} : JSON.parse(JSON.stringify(value));
	}

	function actionFor(args) {
		var action = String(args.action || "read").toLowerCase();
		if (args.adopt === true) {
			action = "adopt";
		}
		if (args.remove === true || args.delete === true) {
			action = "remove";
		}
		return action;
	}

	function compactSchemaForContract(schema, keepRoot) {
		schema = clone(schema);
		if (!keepRoot && schema && schema.type === "object" && schema.properties) {
			return schema.properties;
		}
		return schema;
	}

	function compactMutationResult(value, action, schemaSource, full) {
		if (full || !value || typeof value !== "object") {
			value.action = action;
			value.schemaSource = schemaSource || "";
			return value;
		}
		var out = {
			ok: value.ok !== false,
			action: action,
			schemaSource: schemaSource || ""
		};
		if (value.name) {
			out.name = value.name;
		}
		if (value.status) {
			out.status = value.status;
		}
		if (value.message) {
			out.message = value.message;
		}
		if (value.source !== undefined && value.source !== null) {
			out.sourceChars = String(value.source).length;
		}
		if (value.written) {
			out.written = {
				ok: value.written.ok !== false,
				name: value.written.name || "",
				file: value.written.file || ""
			};
		}
		if (value.registration) {
			out.registration = value.registration;
		}
		return out;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				var action = actionFor(args);
				if (action === "read" || action === "") {
					return ctx.outputSchemaSource(mcp.withNamedFlowSource(ctx, args));
				}
				if (action !== "adopt" && action !== "remove") {
					throw new Error("flow-output-schema action must be read, adopt or remove.");
				}
				var full = String(args.detail || args.mode || "").toLowerCase() === "full";
				var mutationArgs = clone(args);
				if (action === "remove") {
					mutationArgs.mutations = [
						{ op: "merge", path: "/flow", value: {} },
						{ op: "delete", path: "/flow/outputs" }
					];
					return compactMutationResult(mcp.applyNamedFlowMutation(ctx, mutationArgs), action, "", full);
				}
				var schemaSource = String(args.source || args.schemaSource || "effective");
				var schema = args.schema;
				if (schema === undefined || schema === null) {
					var schemaResult = ctx.outputSchemaSource(mcp.withNamedFlowSource(ctx, clone(args)));
					schema = schemaResult.schema || {};
					schemaSource = schemaResult.source || schemaSource;
				}
				mutationArgs.mutation = {
					op: "replace",
					path: "/flow/outputs",
					value: compactSchemaForContract(schema, args.keepRootSchema === true)
				};
				return compactMutationResult(mcp.applyNamedFlowMutation(ctx, mutationArgs), action, schemaSource, full);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
