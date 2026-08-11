const _meta = {
  "version": 1,
  "description": "Runs the flow-resource-patch MCP tool.",
  "icon": "mdi:file-edit-outline",
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
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "tool flow-resource-patch -> {{ input.out }}",
  "runtime": "rhino"
}

(function () {
	var ENGINE_PROJECT = "lib_flow_engine";
	var ENGINE_RESOURCE_PATTERN = /^libs\/flow\/(?:Engine\.js|modules\/[A-Za-z0-9_.-]+\.js)$/;
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
			if (!target.startsWith(root) || !Files.isRegularFile(target)) {
				throw new Error("Engine resource does not exist inside the loaded project: " + path);
			}
			var currentContent = String(Files.readString(target, StandardCharsets.UTF_8));
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
				originalContent: currentContent,
				permissions: posixPermissions(Files, target),
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
					return left.path === "libs/flow/Engine.js" ? 1 : right.path === "libs/flow/Engine.js" ? -1 : left.path.localeCompare(right.path);
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

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, prop(node, "request"));
			var scope = String(mcp.toolArguments(request).scope || "");
			var response = mcp.runToolBlock(ctx, request, {
				resolveProject: scope !== "engine-internal"
			}, function (args) {
				return scope === "engine-internal" ? synchronize(args) : ctx.resourcePatch(args);
			});
			var out = prop(node, "out") || "local.response";
			ctx.write(out, response);
			return response;
		}
	};
}())
