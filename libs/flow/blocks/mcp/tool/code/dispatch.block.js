const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:call-split",
  "tags": [
    "mcp",
    "flowscript",
    "code"
  ],
  "description": "Routes one unified code-* MCP request to Flow, block or canonical source tools.",
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
  "outputs": { "out": { "type": "unknown" } },
  "runtime": "rhino"
}

(function () {
	var BLOCK_OPERATIONS = {
		get: true,
		set: true,
		patch: true,
		check: true,
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
		if (nonEmpty(args.block) || nonEmpty(args.blockName)) {
			return "block";
		}
		var kind = String(args.kind || args.type || args.target || "").toLowerCase();
		if (nonEmpty(args.sourceFile) || nonEmpty(args.sourcePath) ||
				kind === "source" || kind === "sourcefile" || kind === "svelte" ||
				kind === "frontend" || kind === "browser") {
			return "source";
		}
		if (kind === "block" || kind === "flow") {
			return kind;
		}
		return "flow";
	}

	function normalizeBlockArgs(args) {
		args = copyJson(args);
		var implementationTarget = String(args.implementationTarget || args.runtimeTarget ||
			(args.target === "frontend" || args.target === "backend" || args.target === "browser" ? args.target : ""));
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
		if (implementationTarget) args.target = implementationTarget;
		return args;
	}

	function normalizeSourceArgs(args) {
		args = copyJson(args);
		if (!nonEmpty(args.sourceFile) && nonEmpty(args.sourcePath)) {
			args.sourceFile = String(args.sourcePath);
		}
		delete args.qname;
		delete args.name;
		delete args.flow;
		delete args.block;
		delete args.blockName;
		delete args.kind;
		delete args.type;
		delete args.target;
		delete args.sourcePath;
		delete args.implementationTarget;
		delete args.runtimeTarget;
		delete args.finalize;
		args.unifiedSourceCode = true;
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

		function hasSearchPattern(args) {
			return nonEmpty(args.pattern) || nonEmpty(args.query) || nonEmpty(args.q);
		}

		function routed(ctx, node, request, operation, out) {
			var mcp = ctx.lib("mcp");
			var args = requestArgs(request);
			var effectiveOperation = operation === "get" && hasSearchPattern(args) ? "rg" : operation;
			var qname = String(args.qname || "");
			if (qname.indexOf(".blocks.") !== -1 || qname.indexOf("blocks.") === 0) {
				return mcp.toolError(request, {
					code: "INVALID_CODE_QNAME",
				message: "qname is reserved for real Convertigo DBO qnames, not project block names.",
				hint: "Use block:\"namespace.name\" for project-local FlowScript blocks, or qname:\"Project.Flow\" for executable Flow DBOs."
			}, ctx);
		}
			var rawTarget = String(args.qname || args.name || args.flow || "");
			if (rawTarget.indexOf("flow://") === 0) {
				return mcp.toolError(request, {
					code: "RESOURCE_URI_USED_AS_CODE_TARGET",
					message: "code-" + effectiveOperation + " reads or edits FlowScript code, not MCP resources.",
					hint: "Use MCP resources/read for " + rawTarget + ". Use code-get only with qname:\"Project.Flow\" or block:\"namespace.name\"."
				}, ctx);
			}
		if (/^sample\./.test(qname) && !nonEmpty(args.project) && !nonEmpty(args.block)) {
			return mcp.toolError(request, {
				code: "SAMPLE_BLOCK_TARGET_AMBIGUOUS",
				message: qname + " looks like a sample block name, not an executable Flow qname.",
				hint: "Use code-get with project:\"lib_flow_mcp\", block:\"" + qname + "\" for sample blocks. Use qname only for executable Flow DBOs."
			}, ctx);
		}
		var kind = normalizeKind(args);
			if ((kind === "block" || kind === "source") && !nonEmpty(args.project) && !nonEmpty(args.projectDir)) {
				return mcp.toolError(request, {
					code: kind === "block" ? "PROJECT_REQUIRED_FOR_BLOCK_CODE" : "PROJECT_REQUIRED_FOR_SOURCE_CODE",
					message: "Project-local " + kind + " code requires an explicit project.",
					hint: kind === "block"
						? "Call code-" + effectiveOperation + " with project:\"<target project>\", block:\"namespace.name\"."
						: "Call code-" + effectiveOperation + " with project:\"<target project>\" and sourceFile, or kind:\"source\" for project-wide rg."
				}, ctx);
			}
			if (kind === "block" && operation === "promote") {
				var blockArgs = normalizeBlockArgs(args);
				var blockName = String(blockArgs.name || "");
			return mcp.toolResponse(request, {
				ok: true,
				name: blockName,
				block: blockName,
				blockAlreadySaved: true,
				promoted: false,
					next: "Project-local blocks have no draft/promote step: code-set/code-patch write the canonical .block.js directly. Run an executable Flow that uses the block."
				}, ctx);
			}
			if ((kind === "block" || kind === "source") && BLOCK_OPERATIONS[effectiveOperation] !== true) {
				return mcp.toolError(request, {
					code: kind === "block" ? "UNSUPPORTED_BLOCK_CODE_OPERATION" : "UNSUPPORTED_SOURCE_CODE_OPERATION",
					message: "code-" + effectiveOperation + " is only available for executable Flows.",
					hint: kind === "block"
						? "Use code-get, code-set, code-patch, code-check or code-rg with block:\"namespace.name\". Browser implementations use target:\"frontend\"."
						: "Use code-get, code-set, code-patch, code-check or code-rg with sourceFile or kind:\"source\"."
				}, ctx);
			}
			var internalName = kind === "block"
				? "flow-block-code-" + effectiveOperation
				: kind === "source"
					? "frontend-svelte-code-" + effectiveOperation
					: "flow-code-" + effectiveOperation;
			var internalBlock = kind === "block"
				? "mcp.tool.flow.block.code." + effectiveOperation
				: kind === "source"
					? "mcp.tool.frontend.svelte.code." + effectiveOperation
					: "mcp.tool.flow.code." + effectiveOperation;
			var internalArgs = kind === "block"
				? normalizeBlockArgs(args)
				: kind === "source"
					? normalizeSourceArgs(args)
					: normalizeFlowArgs(args);
			if (effectiveOperation === "rg" && !nonEmpty(internalArgs.pattern) && nonEmpty(internalArgs.query)) {
				internalArgs.pattern = internalArgs.query;
			}
			if (effectiveOperation === "rg" && !nonEmpty(internalArgs.pattern) && nonEmpty(internalArgs.q)) {
				internalArgs.pattern = internalArgs.q;
			}
			delete internalArgs.query;
			delete internalArgs.q;
			var internalRequest = setRequestArgs(request, internalName, internalArgs);
			return ctx.callBlock(internalBlock, {
				request: internalRequest,
				reveal: internalArgs.reveal,
				out: out
			}, { trace: false });
		}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, prop(node, "request"));
			var operation = String(prop(node, "operation") || "").trim();
			var out = props.out || "local.response";
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
