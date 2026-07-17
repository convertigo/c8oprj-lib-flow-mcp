const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:file-code-outline",
  "description": "Reads, validates and writes one intuitive Flow Svelte source.",
  "properties": {
    "operation": { "kind": "text", "type": "string", "description": "get, check, set or patch." },
    "sourceFile": { "kind": "text", "type": "string", "description": "Project-relative *.flow.svelte source path." },
    "code": { "kind": "text", "type": "string", "description": "Complete Flow Svelte source for check or set." },
    "revision": { "kind": "text", "type": "string", "description": "Revision returned by get/set/check." },
    "codepatch": { "kind": "text", "type": "string", "description": "Unified diff for patch." },
    "projectDir": { "kind": "text", "type": "string", "description": "Resolved target project directory." },
    "out": { "kind": "path", "mode": "write", "default": "local.frontendSource" }
  },
  "outputs": { "out": { "type": "object" } },
  "runtime": "rhino"
}

(function () {
	var File = Packages.java.io.File;
	var FileUtils = Packages.org.apache.commons.io.FileUtils;

	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function sourcePath(props) {
		var root = new File(String(props.projectDir || "")).getCanonicalFile();
		if (!root.isDirectory()) {
			throw new Error("Flow Svelte source tools require a valid projectDir.");
		}
		var requested = String(props.sourceFile || "").replace(/\\/g, "/");
		if (!requested) {
			throw new Error("A Flow Svelte sourceFile is required.");
		}
		var file = new File(requested);
		if (!file.isAbsolute()) {
			file = new File(root, requested);
		}
		file = file.getCanonicalFile();
		var rootPath = String(root.getCanonicalPath());
		var filePath = String(file.getCanonicalPath());
		if (filePath.indexOf(rootPath + String(File.separator)) !== 0 || !filePath.endsWith(".flow.svelte")) {
			throw new Error("Flow Svelte sourceFile must stay inside the target project and end with .flow.svelte.");
		}
		var relative = filePath.substring(rootPath.length + 1).replace(/\\/g, "/");
		if (relative.indexOf("libs/flow/frontbuilder/") !== 0) {
			throw new Error("Flow Svelte sourceFile must be under libs/flow/frontbuilder/.");
		}
		return { root: root, file: file, relative: relative, absolute: filePath };
	}

	function lineNumber(source, offset) {
		return String(source).substring(0, offset).split("\n").length;
	}

	function sourceDiagnostics(source) {
		var diagnostics = [];
		var seen = {};
		var match;
		var idPattern = /<([A-Z][A-Za-z0-9_.]*)\b[^>]*\bid="([^"]+)"/g;
		while ((match = idPattern.exec(source)) !== null) {
			var id = String(match[2]);
			var occurrence = { tag: String(match[1]), line: lineNumber(source, match.index) };
			if (seen[id]) {
				diagnostics.push({
					severity: "error",
					code: "FRONTEND_DUPLICATE_ID",
					message: "Duplicate Flow Svelte id '" + id + "' on <" + occurrence.tag + ">.",
					line: occurrence.line,
					firstLine: seen[id].line,
					hint: "Give every low-code node a stable unique id; update scopeId/actionId references with the renamed owner."
				});
			} else {
				seen[id] = occurrence;
			}
		}
		if (!/<FlowComponent\b/.test(source)) {
			diagnostics.push({
				severity: "error",
				code: "FRONTEND_FLOW_COMPONENT_REQUIRED",
				message: "Flow Svelte source must contain one FlowComponent root.",
				hint: "Keep metadata in <script module> and the editable tree under <FlowComponent>."
			});
		}
		return diagnostics;
	}

	function projectedError(node) {
		if (!node || typeof node !== "object") return null;
		if (String(node.kind || "") === "error" || String(node.type || "") === "error") {
			return node;
		}
		var children = node.children || [];
		for (var i = 0; i < children.length; i++) {
			var found = projectedError(children[i]);
			if (found) return found;
		}
		return null;
	}

	function validate(ctx, props, path, source) {
		var diagnostics = sourceDiagnostics(source);
		if (!diagnostics.some(function (item) { return item.severity === "error"; })) {
			try {
				var drafts = {};
				drafts[path.absolute] = source;
				var tree = ctx.authoringTreeSource({
					projectDir: String(props.projectDir),
					surface: "frontend",
					builder: "svelte",
					drafts: drafts,
					detail: "compact",
					maxDepth: 3
				});
				var treeError = projectedError(tree);
				if (!tree || tree.ok !== true || treeError) {
					diagnostics.push({
						severity: "error",
						code: tree && tree.error && tree.error.code || "FRONTEND_SOURCE_INVALID",
						message: tree && tree.error && tree.error.message || treeError &&
							(treeError.label || treeError.summary || treeError.message) || "Flow Svelte source could not be projected."
					});
				}
			} catch (error) {
				diagnostics.push({
					severity: "error",
					code: "FRONTEND_SOURCE_PARSE_FAILED",
					message: String(error && error.message || error),
					hint: "Correct the reported Svelte/Flow source, then call frontend-svelte-code-check again."
				});
			}
		}
		return {
			ok: !diagnostics.some(function (item) { return item.severity === "error"; }),
			sourceFile: path.relative,
			diagnostics: diagnostics,
			errorCount: diagnostics.filter(function (item) { return item.severity === "error"; }).length,
			warningCount: diagnostics.filter(function (item) { return item.severity === "warning"; }).length
		};
	}

	function requireValid(validation) {
		if (validation.ok !== true) {
			var first = validation.diagnostics[0] || {};
			var error = new Error(String(first.message || "Invalid Flow Svelte source."));
			error.code = String(first.code || "FRONTEND_SOURCE_INVALID");
			error.hint = String(first.hint || "Call frontend-svelte-code-check for structured diagnostics.");
			throw error;
		}
	}

	function read(ctx, props, path) {
		if (!path.file.isFile()) {
			throw new Error("Unknown Flow Svelte source: " + path.relative);
		}
		var resource = ctx.resourceGet({
			projectDir: props.projectDir,
			path: path.relative,
			allowLarge: true,
			maxBytes: 5000000
		});
		return {
			ok: true,
			sourceFile: path.relative,
			code: resource.content,
			revision: resource.hash,
			contentLength: resource.contentLength
		};
	}

	function write(ctx, props, path, source) {
		var validation = validate(ctx, props, path, source);
		requireValid(validation);
		var parent = path.file.getParentFile();
		if (parent != null) parent.mkdirs();
		FileUtils.writeStringToFile(path.file, source, "UTF-8");
		var saved = read(ctx, props, path);
		saved.diagnostics = validation.diagnostics;
		saved.errorCount = validation.errorCount;
		saved.warningCount = validation.warningCount;
		saved.written = true;
		return saved;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var operation = String(prop(node, "operation") || "get").toLowerCase();
			var path = sourcePath(props);
			var result;
			if (operation === "get") {
				result = read(ctx, props, path);
			} else if (operation === "check") {
				var source = props.code !== undefined && props.code !== null
					? String(props.code)
					: String(read(ctx, props, path).code);
				result = validate(ctx, props, path, source);
				result.revision = path.file.isFile() ? read(ctx, props, path).revision : null;
			} else if (operation === "set") {
				if (props.code === undefined || props.code === null) {
					throw new Error("frontend-svelte-code-set requires code.");
				}
				if (props.revision && path.file.isFile() && String(read(ctx, props, path).revision) !== String(props.revision)) {
					throw new Error("Flow Svelte source changed since it was read; call frontend-svelte-code-get again.");
				}
				result = write(ctx, props, path, String(props.code));
			} else if (operation === "patch") {
				var patch = String(props.codepatch || props.patch || "");
				if (!patch) throw new Error("frontend-svelte-code-patch requires codepatch.");
				if (!props.revision) throw new Error("frontend-svelte-code-patch requires the revision returned by frontend-svelte-code-get.");
				var preview = ctx.resourcePatch({
					projectDir: props.projectDir,
					path: path.relative,
					baseHash: props.revision,
					patch: patch,
					dryRun: true,
					validate: false,
					includeContent: true
				});
				var validation = validate(ctx, props, path, String(preview.content));
				requireValid(validation);
				var patched = ctx.resourcePatch({
					projectDir: props.projectDir,
					path: path.relative,
					baseHash: props.revision,
					patch: patch,
					validate: false
				});
				result = read(ctx, props, path);
				result.hunks = patched.hunks;
				result.oldRevision = patched.oldHash;
				result.diagnostics = validation.diagnostics;
				result.errorCount = validation.errorCount;
				result.warningCount = validation.warningCount;
				result.written = true;
			} else {
				throw new Error("Unsupported Flow Svelte source operation: " + operation);
			}
			ctx.write(props.out || "local.frontendSource", result);
			return result;
		}
	};
}())
