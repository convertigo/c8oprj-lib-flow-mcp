const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:play-box-outline",
  "uses": [
    "mcp"
  ],
  "description": "Runs one MCP tool by calling a Flow block capability and wrapping the JSON-RPC response.",
  "hooks": {
    "file": "run.hooks.js"
  },
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "target": {
      "kind": "text",
      "type": "string",
      "description": "Flow block capability called with prepared MCP arguments."
    },
    "args": {
      "kind": "template",
      "type": "object",
      "description": "Optional argument overrides merged after MCP arguments."
    },
    "workspaceSearch": {
      "kind": "literal",
      "type": "boolean",
      "description": "Allow workspace search without resolving a project."
    },
    "resolveProject": {
      "kind": "literal",
      "type": "boolean",
      "description": "Resolve project/projectDir before calling the target block. Default true."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "description": "Scope path receiving the MCP response."
    }
  },
  "runtime": "rhino"
}

(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function boolProp(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		if (typeof value === "boolean") {
			return value;
		}
		return String(value) === "true";
	}

	function targetName(ctx, value) {
		if (value === undefined || value === null) {
			return "";
		}
		value = String(value);
		return value.indexOf("{{") === -1 ? value : ctx.render(value);
	}

	function merge(target, source) {
		target = target || {};
		source = source || {};
		Object.keys(source).forEach(function (key) {
			target[key] = source[key];
		});
		return target;
	}

	function extraArgs(ctx, value) {
		if (value === undefined || value === null || value === "") {
			return {};
		}
		if (typeof value === "string") {
			return ctx.expr(value) || {};
		}
		return ctx.template(value) || {};
	}

	function syncFrontendDevAfterMutation(ctx, args, result) {
		if (!result || result.ok !== true || result.written !== true || result.changed === false ||
				String(args.surface || "") !== "frontend" || String(args.builder || "") !== "svelte") {
			return result;
		}
		try {
			var sourcePath = String(result.writtenFile || result.sourceFile || "");
			var sync = ctx.callBlock("authoring.action", {
				actionId: "dev.sync",
				builder: "svelte",
				projectDir: args.projectDir,
				browserDebugPort: args.browserDebugPort,
				action: {
					id: "frontbuilder.svelte.dev.sync",
					payload: { sourcePath: sourcePath }
				}
			}, { trace: false });
			result.devSync = {
				ok: sync && sync.ok !== false,
				generated: sync && sync.generated === true,
				pending: sync && sync.pending === true,
				message: String(sync && sync.message || "")
			};
		} catch (error) {
			result.devSync = {
				ok: false,
				generated: false,
				pending: false,
				message: "Frontend source was saved, but dev synchronization failed: " + String(error)
			};
			result.warnings = (result.warnings || []).concat([{
				code: "FRONTEND_DEV_SYNC_FAILED",
				message: result.devSync.message
			}]);
		}
		return result;
	}

	function externalPaletteItems(ctx, mcp, args, result) {
		if (!result || result.ok !== true || Number(result.eligibleCount || 0) > 0 || !args.project || !String(args.query || "").trim()) {
			return result;
		}
		var libraries;
		try {
			libraries = ctx.callBlock("project.library.search", {
				project: args.project,
				query: args.query,
				target: String(args.surface || "frontend") === "frontend" ? "frontend" : "backend",
				limit: 5
			}, { trace: false });
		} catch (error) {
			result.workspaceSearch = {
				status: "unavailable",
				message: String(error)
			};
			return result;
		}
		var expectedKind = String(args.surface || "frontend") === "frontend"
			? "frontendComponent"
			: "backendBlock";
		var additions = [];
		(libraries.libraries || []).forEach(function (library) {
			if (library.referenced === true) {
				return;
			}
			(library.matches || []).forEach(function (match) {
				if (match.kind !== expectedKind) {
					return;
				}
				additions.push({
					id: match.id,
					label: match.name || match.id,
					category: (match.category || "Workspace library") + " - " + library.project,
					description: match.description || "Reusable component from workspace project " + library.project + ".",
					provider: library.project,
					external: true,
					apply: {
						tool: "authoring-mutate",
						arguments: {
							parentPath: mcp.qualifyAuthoringPath(args, args.focusPath),
							surface: args.surface || "frontend",
							builder: args.builder || "svelte",
							position: args.position || "inside",
							mutation: {
								op: "insertProvider",
								provider: library.project,
								descriptorId: match.id
							}
						}
					}
				});
			});
		});
		if (additions.length) {
			result.items = (result.items || []).concat(additions);
			result.eligibleCount = Number(result.eligibleCount || 0) + additions.length;
			result.workspaceCandidateCount = additions.length;
		}
		return result;
	}

	function insertProvider(ctx, mcp, args) {
		var mutation = args.mutation || {};
		var provider = String(mutation.provider || "");
		var descriptorId = String(mutation.descriptorId || "");
		if (!provider || !descriptorId || !args.project) {
			throw new Error("insertProvider requires a qualified parentPath, provider and descriptorId.");
		}
		var reference = null;
		try {
			reference = ctx.callBlock("project.reference", {
				project: args.project,
				reference: provider,
				dryRun: false
			}, { trace: false });
			// A project reference changes the eligible provider set. Refresh this
			// runtime before resolving the descriptor in the same atomic call.
			ctx.cacheClear();
			var paletteArgs = {
				project: args.project,
				projectDir: args.projectDir,
				surface: args.surface || "frontend",
				builder: args.builder || "svelte",
				focusPath: args.focusPath,
				position: args.position || "inside",
				query: descriptorId
			};
			var palette = ctx.callBlock("authoring.palette", paletteArgs, { trace: false });
			if (String(paletteArgs.surface) === "frontend" && String(paletteArgs.builder) === "svelte") {
				palette = mcp._enrichSveltePaletteMutations(paletteArgs, palette);
			}
			var selected = null;
			(palette.items || []).some(function (item) {
				if (String(item.id || "") === descriptorId) {
					selected = item;
					return true;
				}
				return false;
			});
			if ((!selected || !selected.apply || !selected.apply.arguments) && String(args.surface || "") === "backend") {
				var libraryResult = ctx.callBlock("project.library.search", {
					project: args.project,
					query: descriptorId,
					target: "backend",
					limit: 5
				}, { trace: false });
				var backendMatch = null;
				(libraryResult.libraries || []).some(function (library) {
					if (String(library.project || "") !== provider || library.referenced !== true) {
						return false;
					}
					return (library.matches || []).some(function (match) {
						if (match.kind === "backendBlock" && String(match.id || "") === descriptorId) {
							backendMatch = match;
							return true;
						}
						return false;
					});
				});
				if (backendMatch) {
					return {
						ok: true,
						target: "provider",
						surface: "backend",
						parentPath: mcp.qualifyAuthoringPath(args, args.focusPath),
						catalogUpdated: true,
						descriptor: backendMatch,
						providerReference: reference,
						next: "The backend block is now available to FlowScript diagnostics and the project catalog."
					};
				}
			}
			if (!selected || !selected.apply || !selected.apply.arguments) {
				throw new Error("Referenced provider " + provider + " but descriptor " + descriptorId + " is not compatible with the selected parent.");
			}
			var selectedArgs = merge({}, selected.apply.arguments);
			selectedArgs.project = args.project;
			selectedArgs.projectDir = args.projectDir;
			selectedArgs.surface = args.surface || selectedArgs.surface || "frontend";
			selectedArgs.builder = args.builder || selectedArgs.builder || "svelte";
			var mutationResult = ctx.authoringMutateSource(selectedArgs);
			mutationResult.providerReference = reference;
			return mutationResult;
		} catch (e) {
			if (reference && reference.created === true) {
				try {
					ctx.callBlock("project.reference.rollback", {
						project: args.project,
						reference: provider
					}, { trace: false });
					ctx.cacheClear();
				} catch (rollbackError) {
					throw new Error(String(e) + " Reference rollback also failed: " + String(rollbackError));
				}
			}
			throw e;
		}
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var target = targetName(ctx, props.target);
			var response;
			try {
				var args = mcp.prepareToolArguments(ctx, request, {
					workspaceSearch: boolProp(props.workspaceSearch, false),
					resolveProject: boolProp(props.resolveProject, true)
				});
				merge(args, extraArgs(ctx, props.args));
				var result;
				if (target === "authoring.mutate") {
					if (args.mutation && String(args.mutation.op || "") === "insertProvider") {
						result = insertProvider(ctx, mcp, args);
					} else if (mcp.isFrontendSourceCreation(args)) {
						result = mcp.createFrontendSource(args);
						ctx.cacheClear();
					} else {
						result = ctx.authoringMutateSource(args);
					}
				} else {
					result = ctx.callBlock(target, args, { trace: false });
				}
				if (target === "authoring.palette") {
					result = externalPaletteItems(ctx, mcp, args, result);
				}
				if (target === "authoring.palette" || target === "authoring.tree") {
					result = mcp.qualifyAuthoringResult(args, result);
				}
				result = mcp.persistSourceMutationResult(request, args, result);
				if (target === "authoring.mutate") {
					result = syncFrontendDevAfterMutation(ctx, args, result);
				}
				response = mcp.toolResponse(request, result, ctx);
			} catch (e) {
				response = mcp.toolError(request, e, ctx);
			}
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
