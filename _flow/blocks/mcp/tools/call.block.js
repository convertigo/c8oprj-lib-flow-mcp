const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "uses": [
    "mcp",
  ],
  "private": true,
  "icon": "mdi:tools",
  "tags": [
    "mcp",
  ],
  "description": "Dispatches one MCP tools/call request by visible tool family.",
  "summary": [
    "tools/call -> {{out}}",
    "tools/call",
  ],
  "display": "tools.call -> ${input.out}",
  "hooks": {
    "file": "call.hooks.js",
  },
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response.",
    },
  },
  "runtime": "rhino",
  "outputs": {
    "out": {
      "type": "unknown",
    },
  },
}

(function () {
	var TOOL_PREFIX = "mcp.tool.flow.";
	var CODE_TOOL_PREFIX = "mcp.tool.code.";
	var AUTHORING_TOOL_PREFIX = "mcp.tool.authoring.";
	var FRONTEND_TOOL_PREFIX = "mcp.tool.frontend.";
	var TAG_TOOL_PREFIX = "mcp.tool.tags.";

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
		if (blockName.indexOf(TAG_TOOL_PREFIX) === 0) {
			return "tags-" + camelToKebab(blockName.substring(TAG_TOOL_PREFIX.length));
		}
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
			var flowName = "flow-" + camelToKebab(blockName.substring(TOOL_PREFIX.length));
			return /^flow-(?:block-)?code-/.test(flowName) ? "" : flowName;
		}
		return "";
	}

	function firstSentence(text) {
		text = String(text || "");
		var end = text.search(/\.(\s|$)/);
		return end > 0 && end < 200 ? text.substring(0, end + 1) : text.length > 200 ? text.substring(0, 199) + "…" : text;
	}

	// tools-more without arguments: {} lists the tools outside the default list, {name} returns one complete descriptor,
	// a list of names several. With arguments, mcp.parseRequest has already turned the call into the tools/call of that tool.
	var TOOLS_MORE_FORMS = "tools-more({}) lists the tools; tools-more({name:\"flow-cache-info\"}) returns its input schema; " +
		"tools-more({name:\"flow-cache-info\", arguments:{}}) runs it.";

	// The closest tool names: shared words first, then the edit distance.
	function closestTools(name, candidates) {
		function distance(a, b) {
			var row = [];
			for (var j = 0; j <= b.length; j++) row[j] = j;
			for (var i = 1; i <= a.length; i++) {
				var previous = row[0];
				row[0] = i;
				for (var k = 1; k <= b.length; k++) {
					var kept = row[k];
					row[k] = Math.min(row[k] + 1, row[k - 1] + 1, previous + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1));
					previous = kept;
				}
			}
			return row[b.length];
		}
		var words = name.split("-");
		return candidates.map(function (candidate) {
			var shared = candidate.split("-").filter(function (word) { return words.indexOf(word) !== -1; }).length;
			return { name: candidate, shared: shared, distance: distance(name, candidate) };
		}).filter(function (entry) {
			return entry.shared > 0 || entry.distance <= 3;
		}).sort(function (a, b) {
			return a.distance <= 3 !== b.distance <= 3 ? (a.distance <= 3 ? -1 : 1) : b.shared - a.shared || a.distance - b.distance;
		}).slice(0, 5).map(function (entry) { return entry.name; });
	}

	// An unknown name: the closest tools and the exact form, or why a relayed tool is not offered here.
	function unknownTool(ctx, mcp, name, more) {
		if (mcp.legacyRelayName(name)) {
			var relayed = mcp.legacyRelayTool(name) && mcp.legacyRelayTools(ctx).some(function (tool) { return tool.name === name; });
			if (relayed) {
				return { listed: true };
			}
			return { error: { code: "UNKNOWN_TOOL",
				message: name + " is not offered to this client: it is a tool of the Convertigo MCP relay, which is off or does not offer it on this server.",
				hint: name === "browser-verify" || name === "subagent-run"
					? "Prove the page with the browser tools of your host (Playwright) on the openUrl of dev.open or dev.sync: execute the acceptance.calls plan of openBuilt, one screenshot for a visual check."
					: "Use the tools of your list; tools-more({}) lists the others.",
				details: { relayed: true } } };
		}
		var closest = closestTools(name, more.map(function (tool) { return tool.name; }).concat(mcp.coreToolNames()));
		return { error: { code: "UNKNOWN_TOOL", message: "Unknown Flow MCP tool: " + name + ".",
			hint: (closest.length ? "Closest: tools-more({name:\"" + closest[0] + "\"})" + (closest.length > 1 ? ", or " + closest.slice(1).join(", ") : "") + ". " : "") +
				TOOLS_MORE_FORMS,
			details: { closest: closest } } };
	}

	function toolsMore(ctx, request) {
		var args = request.params && request.params.arguments || {};
		var mcp = ctx.lib("mcp");
		var more = ctx.callBlock("mcp.tools.available", { profile: "more", out: "local.moreTools" }, { trace: false }) || [];
		var asked = Array.isArray(args.name) ? args.name : args.name === undefined || args.name === null ? [] : [args.name];
		var names = asked.map(mcp.toolsMoreName).filter(function (name) { return name; });
		var inner = args.arguments;
		if (inner !== undefined && inner !== null) {
			var empty = typeof inner === "object" && !Array.isArray(inner) && !Object.keys(inner).length;
			if (!names.length && !empty) {
				throw { code: "INVALID_ARGUMENT", message: "tools-more needs the name of the tool next to its arguments.", hint: TOOLS_MORE_FORMS };
			}
			if (names.length > 1) {
				throw { code: "INVALID_ARGUMENT", message: "tools-more runs one tool at a time: give one name with its arguments.", hint: TOOLS_MORE_FORMS };
			}
			if (names.length) {
				throw { code: "INVALID_ARGUMENT", message: "tools-more arguments must be a JSON object of the arguments of " + names[0] + ".",
					hint: "tools-more({name:\"" + names[0] + "\", arguments:{...}})" };
			}
		}
		if (!names.length) {
			return { ok: true, tools: more.map(function (tool) { return { name: tool.name, description: firstSentence(tool.description) }; }),
				next: "tools-more({name}) for the input schema of one, tools-more({name, arguments}) to run it." };
		}
		var tools = [], listed = [], unknown = [], refusal = null;
		names.forEach(function (name) {
			var found = more.filter(function (tool) { return tool.name === name; })[0];
			if (found) {
				tools.push(found);
				return;
			}
			var other = mcp.coreTool(name) ? { listed: true } : unknownTool(ctx, mcp, name, more);
			if (other.listed) {
				listed.push(name);
			} else {
				refusal = refusal || other.error;
				unknown.push({ name: name, message: other.error.message, hint: other.error.hint });
			}
		});
		if (names.length === 1) {
			if (refusal) throw refusal;
			return listed.length
				? { ok: true, name: names[0], listed: true, next: "Call " + names[0] + " directly: it is in the tools list." }
				: { ok: true, tool: tools[0], next: "tools-more({name:\"" + names[0] + "\", arguments:{...}}) runs it." };
		}
		if (!tools.length && !listed.length) throw refusal;
		return { ok: true, tools: tools, listed: listed, unknown: unknown,
			next: "Call the listed tools directly; tools-more({name, arguments}) runs one of the others." };
	}

	function toolMap(ctx) {
		var map = {};
		var blockIds = typeof ctx.blockNames === "function"
			? ctx.blockNames()
			: (ctx.blockList({ includePrivate: true, detail: "summary" }).blocks || []).map(function (block) {
				return block.block || block.blockId || block.name;
			});
		blockIds.forEach(function (blockId) {
			var name = toolName(blockId);
			if (name) {
				map[name] = blockId;
			}
		});
		return map;
	}

	// An MCP client without resources/read (Vibe 3 lists MCP tools only) asks flow-resource-get for a guide or skill
	// URI. Without a project, or when the project does not answer it (no such resource, a project not created yet),
	// the Flow MCP resource answers; finalizeResponse selects readable text or the compatible structured result. The
	// guides that tell how to start are readable before any project exists.
	var MCP_RESOURCE_URI = /^flow:\/\/(?:(?:guides?|lib|skills)\/|ace(?:\/|$))/i;
	function withExperience(ctx, mcp, request, response) {
		if (!response || !response.result || typeof mcp._experienceHost !== "function") return response;
		try {
			var decorated = ctx.callBlock("mcp.experience", { request: request, response: response, operation: "push", out: "local.experienceResponse" }, { trace: false });
			return decorated && decorated.result && !decorated.error ? decorated : response;
		} catch (ignored) {
			return response;
		}
	}
	function filled(value) {
		return value !== undefined && value !== null && String(value).trim() !== "";
	}
	function mcpResourceUri(request) {
		var args = request.params && request.params.arguments || {};
		var uri = String(args.uri || "").trim();
		return !filled(args.path) && MCP_RESOURCE_URI.test(uri) ? uri : "";
	}
	function projectlessMcpResource(request) {
		var args = request.params && request.params.arguments || {};
		return mcpResourceUri(request) !== "" && !filled(args.project) && !filled(args.projectDir);
	}
	function failed(response) {
		var result = response && response.result;
		return !!(response && response.error || result && (result.isError === true || result.structuredContent && result.structuredContent.error));
	}
	function unknownResourceHint(mcp, ctx, request) {
		return mcp.guideHint(mcp.guideAliasFor(ctx, mcpResourceUri(request)).suggestions || []) + " A project resource needs project and path.";
	}
	function unknownResource(response) {
		var error = response && response.result && response.result.structuredContent && response.result.structuredContent.error;
		return !!(error && error.code === "UNKNOWN_RESOURCE");
	}
	// The block of a published tool, the only block this relay calls by a computed name: resolved here from the tool
	// map by the tool name, so that every caller of this reviewed site calls a published tool block and nothing else.
	function callTool(ctx, name, request, out) {
		var block = toolMap(ctx)[name];
		if (!block) throw { code: "FLOW_MCP_TOOL_ERROR", message: "Unknown Flow MCP tool: " + name };
		return ctx.callBlock(block, { request: request, out: out }, { trace: false });
	}
	// A project file asked as flow://_flow/<path> (the address of a guide, the path of a project file): the file at that
	// path of the same project, with a note that gives the address to use. Only when the project refused the URI.
	function projectPathThroughTool(ctx, mcp, request, response, block) {
		var args = request.params && request.params.arguments || {};
		var match = /^flow:\/\/(_flow\/[^?#]+)$/.exec(String(args.uri || "").trim());
		if (!block || !match || filled(args.path) || !(filled(args.project) || filled(args.projectDir)) || !unknownResource(response)) {
			return null;
		}
		var inner = {};
		Object.keys(args).forEach(function (key) { if (key !== "uri" && key !== "format") inner[key] = args[key]; });
		inner.path = match[1];
		var read = callTool(ctx, "flow-resource-get", { jsonrpc: "2.0", id: request.id === undefined ? null : request.id, method: "tools/call",
			params: { name: "flow-resource-get", arguments: inner }, __flowMcpTraceDeferred: true }, "local.mcpProjectPathRead");
		var structured = read && read.result && read.result.structuredContent;
		if (!structured || failed(read)) {
			return null;
		}
		structured.note = String(args.uri).trim() + " is read as path " + match[1] + " of this project: a project file is read by path; use path next time.";
		return mcp.finalizeResponse(ctx, request, read);
	}
	function mcpResourceThroughTool(ctx, mcp, request, response) {
		var uri = mcpResourceUri(request), args = request.params && request.params.arguments || {}, fromPath = "";
		// A guide asked by its path in a project that does not hold it (_flow/resources/guide/<name>.md): that guide,
		// only when it exists, and only when the project refused the path.
		if (!uri && filled(args.path) && (filled(args.project) || filled(args.projectDir)) && unknownResource(response)) {
			var guide = mcp.guidePathUri(args.path);
			uri = guide ? mcp.knownGuide(ctx, guide) : "";
			fromPath = uri ? String(args.path).trim() : "";
		}
		if (!uri || response && !failed(response)) {
			return null;
		}
		function readResource(target) {
			return ctx.callBlock("mcp.resources.read", {
				request: { jsonrpc: "2.0", id: request.id === undefined ? null : request.id, method: "resources/read", params: {
					uri: target, project: request.params.arguments && request.params.arguments.project,
					projectDir: request.params.arguments && request.params.arguments.projectDir
				}, __flowMcpTraceDeferred: true },
				out: "local.mcpResourceRead"
			}, { trace: false });
		}
		function contentsOf(read) {
			var found = read && read.result && read.result.contents;
			return found && found.length ? found : null;
		}
		function readContents(target) {
			return contentsOf(readResource(target));
		}
		var exact = readResource(uri), contents = contentsOf(exact), note = fromPath && contents
			? fromPath + " is not a file of this project; it is read as the guide " + uri + ": read guides by uri, without project, next time." : null;
		// Only a URI that resources/read does not know is read under its alias; another failure is the answer.
		if (!contents && exact && exact.error && !/^Unknown Flow MCP resource:/.test(String(exact.error.message || ""))) {
			return exact;
		}
		if (!contents) {
			// flow://guide/sql names the guide of a library (flow://lib/lib_flow_sql/sql) when only one matches.
			var alias = mcp.guideAliasFor(ctx, uri);
			contents = alias.uri && alias.uri !== uri ? readContents(alias.uri) : null;
			if (!contents) {
				return null;
			}
			note = uri + " is read as " + alias.uri + "; use that URI next time.";
			uri = alias.uri;
		}
		var texts = [];
		for (var i = 0; i < contents.length; i++) {
			texts.push(String(contents[i] && contents[i].text || ""));
		}
		var text = texts.join("\n");
		return mcp.finalizeResponse(ctx, request, mcp.jsonRpcResult(request.id, {
			content: [{ type: "text", text: "Resource text is in text (structuredContent.text in the MCP envelope). Read this response, not the URI again. For plain Markdown, request format: text." }],
			structuredContent: {
				ok: true,
				uri: uri,
				mimeType: String(contents[0].mimeType || "text/markdown"),
				source: "resources/read",
				note: note || undefined,
				text: text
			}
		}));
	}
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, prop(node, "request"));
			var name = String(request.params && request.params.name || "");
			var out = props.out || "local.response";
			var response;
			try {
				// An expired leased MCP token was let through to read why it is refused (jwt.guardRequest): no tool runs.
				if (request.__flowMcpTokenExpired) {
					response = mcp.toolError(request, request.__flowMcpTokenExpired, ctx);
					ctx.write(out, response);
					return response;
				}
				// A constructor sub-agent of a parallel build writes only the side of the project it owns.
				var scopeRefusal = mcp.subagentScopeRefusal(ctx, request);
				if (scopeRefusal) {
					response = mcp.toolError(request, scopeRefusal, ctx);
					ctx.write(out, response);
					return response;
				}
				if (name === "tools-more") {
					response = mcp.toolResponse(request, toolsMore(ctx, request), ctx);
					response = withExperience(ctx, mcp, request, response);
					ctx.write(out, response);
					return response;
				}
				var block = toolMap(ctx)[name];
				// flow-resource-get may answer after inner reads (the project, then the guide): only its last answer is traced.
				if (name === "flow-resource-get") request.__flowMcpTraceDeferred = true;
				var format = request.params && request.params.arguments && request.params.arguments.format;
				if (name === "flow-resource-get" && format !== undefined && format !== "text" && format !== "structured") {
					throw { code: "INVALID_ARGUMENT", message: "flow-resource-get format must be text or structured." };
				}
				if (!block && typeof ctx.blockNames === "function" && ctx.blockNames().indexOf("mcp.tools.server") !== -1) {
					var serverResponse = ctx.callBlock("mcp.tools.server", { mode: "call", request: request }, { trace: false });
					if (serverResponse) {
						ctx.write(out, serverResponse);
						return serverResponse;
					}
				}
				// Relayed answers belong to the legacy MCP: do not rewrap or normalize them.
				if (!block && mcp.legacyRelayTool(name)) {
					var relayed;
					try {
						relayed = mcp.legacyRelayCall(ctx, request);
					} finally {
						mcp.stableToolCalled(name);
					}
					relayed = withExperience(ctx, mcp, request, relayed);
					ctx.write(out, relayed);
					return relayed;
				}
				if (block && name === "flow-resource-get" && projectlessMcpResource(request)) {
					// A guide, skill or library guide needs no project: only a project resource does.
					response = mcpResourceThroughTool(ctx, mcp, request, null) || mcp.toolError(request, {
						code: "UNKNOWN_RESOURCE",
						message: "Unknown Flow MCP resource: " + mcpResourceUri(request) + ".",
						hint: unknownResourceHint(mcp, ctx, request),
						details: { didYouMean: mcp.guideAliasFor(ctx, mcpResourceUri(request)).suggestions || [] }
					}, ctx);
				} else {
					response = block
						? callTool(ctx, name, request, out)
						: mcp.toolError(request, { code: "FLOW_MCP_TOOL_ERROR", message: "Unknown Flow MCP tool: " + name }, ctx);
					if (name === "flow-resource-get") {
						response = mcpResourceThroughTool(ctx, mcp, request, response) || projectPathThroughTool(ctx, mcp, request, response, block) || response;
					}
				}
				// Older Flow wrappers can still return a JSON-RPC error. At the tools/call boundary it is a tool error.
				if (response && response.error) {
					var error = response.error;
					var data = error.data || {};
					response = mcp.toolError(request, { code: data.code, message: error.message, hint: data.hint, details: data.details }, ctx);
				}
			} catch (error) {
				response = mcp.toolError(request, error, ctx);
			}
			// A tool that may have written (even when it failed) drops the kept project answers.
			mcp.stableToolCalled(name);
			if (name === "flow-resource-get") {
				delete request.__flowMcpTraceDeferred;
				response = mcp.finalizeResponse(ctx, request, response);
			}
			response = withExperience(ctx, mcp, request, response);
			ctx.write(out, response);
			return response;
		}
	};
}())
