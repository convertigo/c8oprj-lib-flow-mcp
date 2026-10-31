const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Runs the flow-resource-patch MCP tool.",
  "icon": "mdi:file-edit-outline",
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
  "outputs": {
    "out": {
      "type": "object",
    },
  },
  "private": true,
  "uses": [
    "mcp",
    "patch",
  ],
  "tags": [
    "mcp",
  ],
  "display": "tool flow-resource-patch -> ${input.out}",
  "runtime": "rhino",
}

(function () {
	var ENGINE_PROJECT = "lib_flow_engine";
	var ENGINE_RESOURCE_PATTERN = /^_flow\/(?:Engine\.js|modules\/[A-Za-z0-9_.-]+\.js)$/;
	var MAX_FILES = 16;
	var MAX_FILE_BYTES = 1024 * 1024;
	var MAX_TOTAL_BYTES = 4 * 1024 * 1024;

	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function boolValue(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		return value === true || String(value).toLowerCase() === "true";
	}

	function hex(value, name) {
		var text = String(value || "").trim().toLowerCase();
		if (!/^[a-f0-9]{64}$/.test(text)) {
			throw new Error(name + " must be a SHA-256 hex digest.");
		}
		return text;
	}

	function revision(value) {
		var text = String(value || "").trim().toLowerCase();
		if (!/^[a-f0-9]{7,40}$/.test(text)) {
			throw new Error("revision must be a 7 to 40 character Git commit id.");
		}
		return text;
	}

	function sha256(value) {
		var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
		var MessageDigest = Packages.java.security.MessageDigest;
		var JavaString = Packages.java.lang.String;
		var bytes = MessageDigest.getInstance("SHA-256").digest(
			new JavaString(String(value || "")).getBytes(StandardCharsets.UTF_8));
		var out = "";
		for (var index = 0; index < bytes.length; index++) {
			out += ("0" + ((bytes[index] & 255).toString(16))).slice(-2);
		}
		return out;
	}

	function engineProjectRoot(project) {
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		if (String(project || "") !== ENGINE_PROJECT) {
			throw new Error("engine-internal synchronization is restricted to " + ENGINE_PROJECT + ".");
		}
		var loaded = Engine.theApp.databaseObjectsManager.getLoadedProjectByName(ENGINE_PROJECT);
		if (loaded == null) {
			loaded = Engine.theApp.databaseObjectsManager.getOriginalProjectByName(ENGINE_PROJECT, false);
		}
		if (loaded == null) {
			throw new Error("Convertigo project is not loaded: " + ENGINE_PROJECT);
		}
		return Packages.java.nio.file.Paths.get(String(Engine.projectDir(ENGINE_PROJECT))).toAbsolutePath().normalize();
	}

	function compileJavaScript(source, path) {
		var RhinoContext = Packages.org.mozilla.javascript.Context;
		var current = RhinoContext.getCurrentContext();
		if (current == null) {
			throw new Error("A Rhino context is required to validate " + path + ".");
		}
		current.compileString(String(source), "flow-engine-sync:" + path, 1, null);
	}

	function posixPermissions(Files, path) {
		try {
			return Files.getPosixFilePermissions(path);
		} catch (_unsupported) {
			return null;
		}
	}

	function applyPermissions(Files, path, permissions) {
		if (permissions != null) {
			try {
				Files.setPosixFilePermissions(path, permissions);
			} catch (_unsupported) {
			}
		}
	}

	function moveReplacing(Files, source, target) {
		var StandardCopyOption = Packages.java.nio.file.StandardCopyOption;
		try {
			Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
		} catch (_atomicUnavailable) {
			Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
		}
	}

	function normalizeFiles(args, root) {
		var Files = Packages.java.nio.file.Files;
		var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
		var JavaString = Packages.java.lang.String;
		var requested = args.files;
		if (Object.prototype.toString.call(requested) !== "[object Array]" || requested.length < 1) {
			throw new Error("engine-internal synchronization requires a non-empty files array.");
		}
		if (requested.length > MAX_FILES) {
			throw new Error("engine-internal synchronization accepts at most " + MAX_FILES + " files.");
		}
		var seen = {};
		var totalBytes = 0;
		return requested.map(function (entry) {
			entry = entry || {};
			var path = String(entry.path || "").replace(/\\/g, "/").replace(/^\.\//, "");
			if (!ENGINE_RESOURCE_PATTERN.test(path) || seen[path]) {
				throw new Error("Unsupported or duplicate engine-internal resource path: " + path);
			}
			seen[path] = true;
			var content = String(entry.content === undefined || entry.content === null ? "" : entry.content);
			var contentBytes = new JavaString(content).getBytes(StandardCharsets.UTF_8).length;
			if (!content || contentBytes > MAX_FILE_BYTES) {
				throw new Error("Engine resource must contain 1 to " + MAX_FILE_BYTES + " UTF-8 bytes: " + path);
			}
			totalBytes += contentBytes;
			if (totalBytes > MAX_TOTAL_BYTES) {
				throw new Error("Engine resource payload exceeds " + MAX_TOTAL_BYTES + " UTF-8 bytes.");
			}
			var target = root.resolve(path).normalize();
			var existed=Files.exists(target);
			if (!target.startsWith(root) || Files.isSymbolicLink(target) ||
					!Files.isDirectory(target.getParent()) || !target.getParent().toRealPath().startsWith(root.toRealPath()) ||
					(existed ? !Files.isRegularFile(target) : path === "_flow/Engine.js")) {
				throw new Error("Engine resource does not exist inside the loaded project: " + path);
			}
			var currentContent = existed ? String(Files.readString(target, StandardCharsets.UTF_8)) : "";
			var currentHash = sha256(currentContent);
			var expectedBaseHash = hex(entry.baseHash, path + ".baseHash");
			if (currentHash !== expectedBaseHash) {
				throw new Error("Engine resource changed since it was read: " + path + ".");
			}
			var targetHash = hex(entry.sha256, path + ".sha256");
			var contentHash = sha256(content);
			if (targetHash !== contentHash) {
				throw new Error("Engine resource content hash mismatch: " + path + ".");
			}
			compileJavaScript(content, path);
			return {
				path: path,
				target: target,
				content: content,
				oldHash: currentHash,
				newHash: contentHash,
				changed: currentHash !== contentHash,
				existed: existed,
				originalContent: currentContent,
				permissions: posixPermissions(Files, existed ? target : root.resolve("_flow/Engine.js")),
				staged: null
			};
		});
	}

	function lockPath(root) {
		var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
		var Files = Packages.java.nio.file.Files;
		var Paths = Packages.java.nio.file.Paths;
		var workspace = String(Engine.USER_WORKSPACE_PATH || root.getParent());
		var directory = Paths.get(workspace, ".flow-maintenance-locks");
		Files.createDirectories(directory);
		return directory.resolve("lib_flow_engine.lock");
	}

	function withProjectLock(root, callback) {
		var FileChannel = Packages.java.nio.channels.FileChannel;
		var StandardOpenOption = Packages.java.nio.file.StandardOpenOption;
		var channel = FileChannel.open(lockPath(root), StandardOpenOption.CREATE, StandardOpenOption.WRITE);
		var lock = null;
		try {
			lock = channel.tryLock();
			if (lock == null) {
				throw new Error("Another lib_flow_engine synchronization is already in progress.");
			}
			return callback();
		} finally {
			if (lock != null) {
				lock.release();
			}
			channel.close();
		}
	}

	function synchronize(args) {
		var Files = Packages.java.nio.file.Files;
		var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
		var StandardOpenOption = Packages.java.nio.file.StandardOpenOption;
		var UUID = Packages.java.util.UUID;
		var project = String(args.project || "").trim();
		var dryRun = boolValue(args.dryRun, true);
		var targetRevision = revision(args.revision);
		var root = engineProjectRoot(project);
		return withProjectLock(root, function () {
			var files = normalizeFiles(args, root);
			var response = {
				ok: true,
				project: project,
				scope: "engine-internal",
				revision: targetRevision,
				dryRun: dryRun,
				changed: files.some(function (entry) { return entry.changed; }),
				applied: false,
				files: files.map(function (entry) {
					return { path: entry.path, oldHash: entry.oldHash, newHash: entry.newHash, changed: entry.changed };
				})
			};
			if (dryRun || !response.changed) {
				response.next = dryRun && response.changed
					? "Review all hashes, then repeat unchanged with dryRun:false."
					: "All requested engine resources already match the target revision.";
				return response;
			}
			var staged = [];
			var replaced = [];
			try {
				files.forEach(function (entry) {
					if (!entry.changed) {
						return;
					}
					entry.staged = entry.target.resolveSibling("." + entry.target.getFileName() + ".flow-sync-" + UUID.randomUUID() + ".tmp");
					Files.writeString(entry.staged, entry.content, StandardCharsets.UTF_8,
						StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
					applyPermissions(Files, entry.staged, entry.permissions);
					if (sha256(String(Files.readString(entry.staged, StandardCharsets.UTF_8))) !== entry.newHash) {
						throw new Error("Staged engine resource hash mismatch: " + entry.path);
					}
					staged.push(entry);
				});
				staged.sort(function (left, right) {
					return left.path === "_flow/Engine.js" ? 1 : right.path === "_flow/Engine.js" ? -1 : left.path.localeCompare(right.path);
				}).forEach(function (entry) {
					moveReplacing(Files, entry.staged, entry.target);
					entry.staged = null;
					replaced.push(entry);
				});
				Packages.com.twinsoft.convertigo.engine.flow.FlowEngineBridge.clearCaches();
				response.applied = true;
				response.next = "Flow Engine caches were cleared; the next request will load revision " + targetRevision + ".";
				return response;
			} catch (failure) {
				for (var index = replaced.length - 1; index >= 0; index--) {
					var entry = replaced[index];
					try {
						if (!entry.existed) { Files.deleteIfExists(entry.target); continue; }
						Files.writeString(entry.target, entry.originalContent, StandardCharsets.UTF_8,
							StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
						applyPermissions(Files, entry.target, entry.permissions);
					} catch (_rollbackFailure) {
					}
				}
				throw failure;
			} finally {
				files.forEach(function (entry) {
					if (entry.staged != null) {
						try {
							Files.deleteIfExists(entry.staged);
						} catch (_cleanupFailure) {
						}
					}
				});
			}
		});
	}

	function filled(value) {
		return value !== undefined && value !== null && String(value) !== "";
	}

	function failure(code, message, hint, details) {
		var error = new Error(message);
		error.code = code;
		error.hint = hint || "";
		if (details !== undefined) {
			error.details = details;
		}
		return error;
	}

	var PATCH_KEYS = ["patch", "unifiedDiff", "diff", "content", "edits"];

	function withoutPatch(args) {
		var out = {};
		Object.keys(args).forEach(function (key) {
			if (PATCH_KEYS.indexOf(key) === -1) {
				out[key] = args[key];
			}
		});
		return out;
	}

	// The text the engine patches: the working copy view of the request, whole.
	function currentResource(ctx, patchLib, args) {
		var read = withoutPatch(args);
		read.allowLarge = true;
		read.maxBytes = 5000000;
		try {
			var resource = ctx.resourceGet(read);
			return { exists: true, content: String(resource.content), hash: String(resource.hash) };
		} catch (e) {
			if (String(e && e.code || "") === "UNKNOWN_RESOURCE") {
				return { exists: false, content: "", hash: patchLib.EMPTY_SHA256 };
			}
			throw e;
		}
	}

	// fromFile: a file of the Convertigo workspace copied into the resource by lib_flow_engine, byte for byte (no
	// normalization of its lines), from a path confined to the workspace; an existing resource needs its baseHash.
	function importWorkspaceFile(ctx, args, path, withText) {
		if (withText) {
			throw failure("INVALID_ARGUMENTS", "Pass fromFile alone: it replaces patch and content.");
		}
		var result = ctx.resourcePatch(args);
		result.mode = "fromFile";
		result.hash = result.newHash;
		result.next = result.dryRun === true
			? "Dry run: nothing written. Send the same call without dryRun to import it."
			: "Imported as it is, byte for byte. Pass hash as baseHash to the next flow-resource-patch of this resource.";
		return result;
	}

	// edits: exact replacements [{ oldText, newText }], the form code-patch takes; each oldText must occur once in the text.
	function applyEdits(patchLib, text, edits) {
		var content = patchLib.normalize(text);
		edits.forEach(function (edit, index) {
			var oldText = edit && edit.oldText !== undefined && edit.oldText !== null ? patchLib.normalize(String(edit.oldText)) : "";
			var newText = edit && edit.newText !== undefined && edit.newText !== null ? patchLib.normalize(String(edit.newText)) : "";
			if (!oldText) {
				throw failure("INVALID_PATCH", "edits[" + index + "] needs oldText, the exact text to replace.",
					"Send edits: [{ oldText, newText }] with oldText copied from flow-resource-get.");
			}
			var at = content.indexOf(oldText);
			if (at === -1 || content.indexOf(oldText, at + 1) !== -1) {
				throw failure(at === -1 ? "PATCH_CONTEXT_NOT_FOUND" : "PATCH_CONTEXT_AMBIGUOUS",
					"edits[" + index + "].oldText " + (at === -1 ? "is not in " : "occurs more than once in ") + "the resource.",
					"Copy oldText exactly from flow-resource-get, with enough surrounding lines to occur once.", { edit: index });
			}
			content = content.substring(0, at) + newText + content.substring(at + oldText.length);
		});
		return content;
	}

	// A project resource: a unified patch applied here hunk by hunk (headers, offsets and unique context accepted), or
	// content, the whole new text. lib_flow_engine then writes that text as one replacement hunk checked against the
	// hash read here, with its own path rules, validation and working copy guard.
	function patchProjectResource(ctx, args) {
		if (filled(args.baseContent)) {
			return ctx.resourcePatch(args);
		}
		var patchLib = ctx.lib("patch");
		var path = String(args.path || "").trim();
		var text = filled(args.patch) ? args.patch : filled(args.unifiedDiff) ? args.unifiedDiff : filled(args.diff) ? args.diff : null;
		var hasEdits = Array.isArray(args.edits) && args.edits.length > 0;
		var hasContent = args.content !== undefined && args.content !== null;
		if (!path) {
			throw failure("RESOURCE_PATH_REQUIRED", "flow-resource-patch needs path, the project-relative path of the resource.",
				"Read it first with flow-resource-get({ project, path }) and patch from its hash.");
		}
		if ((hasContent ? 1 : 0) + (text !== null ? 1 : 0) + (hasEdits ? 1 : 0) > 1) {
			throw failure("INVALID_ARGUMENTS", "Pass one of edits ([{ oldText, newText }]), patch (a unified diff) or content (the whole new text).");
		}
		if (!hasContent && !hasEdits && text === null && !filled(args.fromFile)) {
			throw failure("INVALID_PATCH", "flow-resource-patch needs edits ([{ oldText, newText }], as code-patch), patch (a unified diff) or content (the whole new text, with baseHash).",
				"Read the resource with flow-resource-get, then send exact replacements as edits, a unified diff of it, or its whole new text as content with the hash as baseHash.");
		}
		if (filled(args.fromFile)) {
			return importWorkspaceFile(ctx, args, path, text !== null || hasContent || hasEdits);
		}
		var current = currentResource(ctx, patchLib, args);
		if (filled(args.baseHash) && String(args.baseHash) !== current.hash) {
			throw failure("RESOURCE_BASE_HASH_MISMATCH", "Flow resource changed since it was read: " + path + ".",
				"Read it again with flow-resource-get and patch from its new hash.", { path: path, baseHash: String(args.baseHash), hash: current.hash });
		}
		if (hasContent && current.exists && !filled(args.baseHash)) {
			throw failure("RESOURCE_BASE_HASH_REQUIRED", "content replaces the whole text of " + path + ": pass baseHash, the hash flow-resource-get returned.",
				"Read it with flow-resource-get({ project, path }), then send content with baseHash set to its hash.", { path: path, hash: current.hash });
		}
		if (hasEdits && !current.exists) {
			throw failure("UNKNOWN_RESOURCE", path + " does not exist: edits replace text in an existing resource.",
				"Send the text of the new resource as content.", { path: path });
		}
		var applied = hasContent || hasEdits ? null : patchLib.applyUnifiedPatch(current.content, text);
		var content = hasContent ? patchLib.normalize(args.content) : hasEdits ? applyEdits(patchLib, current.content, args.edits) : applied.content;
		var mode = hasContent ? "content" : hasEdits ? "edits" : "patch";
		if (!current.exists && content === "") {
			throw failure("RESOURCE_CONTENT_EMPTY", path + " does not exist and the new text is empty: nothing to create.",
				"Send the text of the new resource as content, or a patch adding its lines.");
		}
		if (current.exists && content === patchLib.normalize(current.content)) {
			return {
				ok: true,
				path: path,
				mode: mode,
				dryRun: args.dryRun === true || String(args.dryRun) === "true",
				created: false,
				changed: false,
				hunks: applied ? applied.hunks.length : 0,
				appliedHunks: applied ? applied.hunks : undefined,
				oldHash: current.hash,
				newHash: current.hash,
				hash: current.hash,
				next: "Nothing to write: the resource already has this text. Its hash stays the baseHash of the next patch."
			};
		}
		var replacement = patchLib.replacementPatch(current.content, content);
		var engineArgs = withoutPatch(args);
		engineArgs.path = path;
		engineArgs.patch = replacement.patch;
		engineArgs.baseHash = current.hash;
		var result = ctx.resourcePatch(engineArgs);
		result.mode = mode;
		result.hunks = applied ? applied.hunks.length : 1;
		if (applied) {
			result.appliedHunks = applied.hunks;
		}
		result.hash = result.newHash;
		var warnings = applied ? applied.notes.slice(0) : [];
		if (replacement.finalNewlineKept) {
			warnings.push("The resource had no final new line and keeps none (lib_flow_engine cannot add it).");
		}
		if (warnings.length) {
			result.warnings = warnings;
		}
		result.next = result.dryRun === true
			? "Dry run: nothing written. Send the same call without dryRun to write it."
			: "Written as sent, line for line. Pass hash as baseHash to the next flow-resource-patch of this resource.";
		return result;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, prop(node, "request"));
			var scope = String(mcp.toolArguments(request).scope || "");
			var response = mcp.runToolBlock(ctx, request, {
				resolveProject: scope !== "engine-internal"
			}, function (args) {
				return scope === "engine-internal" ? synchronize(args) : patchProjectResource(ctx, args);
			});
			var out = prop(node, "out") || "local.response";
			ctx.write(out, response);
			return response;
		}
	};
}())
