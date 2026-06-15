const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:call-split",
  "tags": [
    "mcp",
    "flowscript",
    "code"
  ],
  "description": "Routes one unified code-* MCP request to Flow or block code tools.",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "operation": {
      "kind": "text",
      "type": "string",
      "description": "Code operation: get, set, patch, rg, check, run, promote, status, discard or analyze."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response."
    }
  },
  "runtime": "rhino"
}

(function () {
	var BLOCK_OPERATIONS = {
		get: true,
		set: true,
		patch: true,
		rg: true
	};

	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function copyJson(value) {
		return value === undefined || value === null ? {} : JSON.parse(JSON.stringify(value));
	}

	function requestArgs(request) {
		return request && request.params && request.params.arguments || {};
	}

	function nonEmpty(value) {
		return value !== undefined && value !== null && String(value).trim() !== "";
	}

	function setRequestArgs(request, name, args) {
		request = copyJson(request);
		request.params = request.params || {};
		request.params.name = name;
		request.params.arguments = args || {};
		return request;
	}

	function normalizeKind(args) {
		var kind = String(args.kind || args.type || args.target || "").toLowerCase();
		if (kind === "block" || kind === "flow") {
			return kind;
		}
		if (nonEmpty(args.block) || nonEmpty(args.blockName)) {
			return "block";
		}
		return "flow";
	}

	function normalizeBlockArgs(args) {
		args = copyJson(args);
		if (!nonEmpty(args.name) && nonEmpty(args.block)) {
			args.name = String(args.block);
		}
		if (!nonEmpty(args.name) && nonEmpty(args.blockName)) {
			args.name = String(args.blockName);
		}
		delete args.qname;
		delete args.kind;
		delete args.type;
		delete args.target;
		delete args.block;
		delete args.blockName;
		return args;
	}

	function normalizeFlowArgs(args) {
		args = copyJson(args);
		var qname = String(args.qname || "");
		if (qname.indexOf(".") > 0 && !nonEmpty(args.project)) {
			args.project = qname.substring(0, qname.indexOf("."));
		}
		if (String(args.qname || "").indexOf(".") === 0 && nonEmpty(args.project)) {
			args.name = String(args.qname).substring(1);
			delete args.qname;
		}
		delete args.kind;
		delete args.type;
		delete args.target;
		return args;
	}

	function routed(ctx, node, request, operation, out) {
		var mcp = ctx.lib("mcp");
		var args = requestArgs(request);
		var qname = String(args.qname || "");
		if (qname.indexOf(".blocks.") !== -1 || qname.indexOf("blocks.") === 0) {
			return mcp.toolError(request, {
				code: "INVALID_CODE_QNAME",
				message: "qname is reserved for real Convertigo DBO qnames, not project block names.",
				hint: "Use block:\"namespace.name\" for project-local FlowScript blocks, or qname:\"Project.Flow\" for executable Flow DBOs."
			}, ctx);
		}
		var kind = normalizeKind(args);
		if (kind === "block" && BLOCK_OPERATIONS[operation] !== true) {
			return mcp.toolError(request, {
				code: "UNSUPPORTED_BLOCK_CODE_OPERATION",
				message: "code-" + operation + " is only available for executable Flows.",
					hint: "Use code-get, code-set, code-patch or code-rg with block:\"namespace.name\" for project-local FlowScript blocks."
			}, ctx);
		}
		var internalName = kind === "block" ? "flow-block-code-" + operation : "flow-code-" + operation;
		var internalBlock = kind === "block"
			? "mcp.tool.flow.block.code." + operation
			: "mcp.tool.flow.code." + operation;
		var internalArgs = kind === "block" ? normalizeBlockArgs(args) : normalizeFlowArgs(args);
		var internalRequest = setRequestArgs(request, internalName, internalArgs);
		return ctx.callBlock(internalBlock, {
			request: internalRequest,
			out: out
		}, { trace: false });
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(prop(node, "request") || "input.request") || {};
			var operation = String(prop(node, "operation") || "").trim();
			var out = props.out || "local.response";
			var mcp = ctx.lib("mcp");
			var response;
			if (!operation) {
				response = mcp.toolError(request, {
					code: "MISSING_CODE_OPERATION",
					message: "Internal code dispatcher was called without operation.",
					hint: "Use a public code-* tool instead of mcp.tool.code.dispatch."
				}, ctx);
			} else {
				response = routed(ctx, node, request, operation, out);
			}
			ctx.write(out, response);
			return response;
		}
	};
}())
