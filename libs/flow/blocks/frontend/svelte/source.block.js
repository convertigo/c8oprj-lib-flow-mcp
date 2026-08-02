const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:file-code-outline",
  "description": "Reads, validates and writes one Flow Svelte model or application stylesheet.",
  "properties": {
    "operation": { "kind": "text", "type": "string", "description": "get, check, set or patch." },
    "sourceFile": { "kind": "text", "type": "string", "description": "Project-relative *.flow.svelte or app.flow.css source path." },
    "code": { "kind": "text", "type": "string", "description": "Complete Flow Svelte or application CSS source for check or set." },
    "revision": { "kind": "text", "type": "string", "description": "Current revision required when replacing an existing source; omit only to create a missing source." },
    "codepatch": { "kind": "text", "type": "string", "description": "Git-style unified diff with numbered hunk headers such as @@ -1,1 +1,1 @@; do not use *** Begin Patch wrappers or bare @@ headers." },
    "projectDir": { "kind": "text", "type": "string", "description": "Resolved target project directory." },
    "out": { "kind": "path", "mode": "write", "default": "local.frontendSource" }
  },
  "outputs": { "out": { "type": "object" } },
  "runtime": "rhino"
}

(function () {
	var File = Packages.java.io.File;
	var FileUtils = Packages.org.apache.commons.io.FileUtils;
	var Files = Packages.java.nio.file.Files;
	var StandardCopyOption = Packages.java.nio.file.StandardCopyOption;
	var AtomicMoveNotSupportedException = Packages.java.nio.file.AtomicMoveNotSupportedException;
	var ReentrantLock = Packages.java.util.concurrent.locks.ReentrantLock;
	var sourceWriteLock = new ReentrantLock();

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
		var normalizedFilePath = filePath.replace(/\\/g, "/");
		var supported = normalizedFilePath.endsWith(".flow.svelte") || normalizedFilePath.endsWith("/app.flow.css");
		if (filePath.indexOf(rootPath + String(File.separator)) !== 0 || !supported) {
			throw new Error("Frontend sourceFile must stay inside the target project and end with .flow.svelte or /app.flow.css.");
		}
		var relative = filePath.substring(rootPath.length + 1).replace(/\\/g, "/");
		if (relative.indexOf("libs/flow/frontbuilder/") !== 0) {
			throw new Error("Flow Svelte sourceFile must be under libs/flow/frontbuilder/.");
		}
		return { root: root, file: file, relative: relative, absolute: filePath };
	}

	function isStylesheet(path) {
		return path && String(path.relative || "").endsWith("/app.flow.css");
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
		var variableSourcePattern = /<Variable\b[^>]*\bsource\s*=/g;
		while ((match = variableSourcePattern.exec(source)) !== null) {
			diagnostics.push({
				severity: "error",
				code: "FRONTEND_PROPERTY_UNKNOWN",
				message: "Unknown property 'source' on <Variable>. Use value for literal or schema-backed action parameters.",
				line: lineNumber(source, match.index),
				property: "source",
				acceptedProperties: ["name", "value"],
				hint: "Replace source with value and keep the same intuitive @reference."
			});
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

	function projectedPropertyDiagnostics(tree, source, contract) {
		var diagnostics = [];
		var propertiesByTag = {};
		(contract && contract.items || []).forEach(function (item) {
			var tag = String(item.tag || item.insert && item.insert.tag || "");
			if (tag && !propertiesByTag[tag]) propertiesByTag[tag] = item.properties || {};
		});
		function regexpEscape(value) {
			return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		function openingTagAttributes(start) {
			var quote = "";
			var escaped = false;
			var braceDepth = 0;
			for (var index = start; index < source.length; index++) {
				var character = source.charAt(index);
				if (quote) {
					if (escaped) escaped = false;
					else if (character === "\\") escaped = true;
					else if (character === quote) quote = "";
					continue;
				}
				if (character === '"' || character === "'") quote = character;
				else if (character === "{") braceDepth++;
				else if (character === "}" && braceDepth > 0) braceDepth--;
				else if (character === ">" && braceDepth === 0) return source.substring(start, index);
			}
			return "";
		}
		function authoredAttributeNames(value) {
			var visible = "";
			var quote = "";
			var escaped = false;
			var braceDepth = 0;
			for (var index = 0; index < value.length; index++) {
				var character = value.charAt(index);
				if (quote) {
					visible += " ";
					if (escaped) escaped = false;
					else if (character === "\\") escaped = true;
					else if (character === quote) quote = "";
					continue;
				}
				if (character === '"' || character === "'") {
					quote = character;
					visible += " ";
					continue;
				}
				if (character === "{") braceDepth++;
				if (braceDepth > 0) {
					visible += " ";
					if (character === "}") braceDepth--;
					continue;
				}
				visible += character;
			}
			var out = {};
			var matcher = /(?:^|\s)([A-Za-z_$][A-Za-z0-9_$:-]*)\s*(?:=|(?=\s|\/|$))/g;
			var match;
			while ((match = matcher.exec(visible)) !== null) out[match[1]] = true;
			return out;
		}
		function authoredProperties(node, projected) {
			var tag = String(projected.tag || node.type || "");
			if (!tag) return {};
			var id = String(projected.id || node.nodeId || "");
			var matcher = new RegExp("<" + regexpEscape(tag) + "\\b", "g");
			var match;
			var fallback = "";
			while ((match = matcher.exec(source)) !== null) {
				var attributes = openingTagAttributes(matcher.lastIndex);
				if (!id || (new RegExp("\\bid\\s*=\\s*([\\\"'])" + regexpEscape(id) + "\\1")).test(attributes)) {
					fallback = attributes;
					break;
				}
			}
			return authoredAttributeNames(fallback);
		}
		function visit(node) {
			if (!node || typeof node !== "object") return;
			var projected = node.definition && typeof node.definition === "object" ? node.definition : node;
			if (typeof node.definition === "string") {
				try {
					projected = JSON.parse(node.definition);
				} catch (e) {
					projected = node;
				}
			}
			var props = authoredProperties(node, projected);
			var canonicalDefinitions = propertiesByTag[String(projected.tag || node.type || "")];
			var definitions = canonicalDefinitions || (
				node.propertyDefinitions && typeof node.propertyDefinitions === "object"
				? node.propertyDefinitions
				: projected.propertyDefinitions && typeof projected.propertyDefinitions === "object"
					? projected.propertyDefinitions : {});
			var hasCatalog = !!canonicalDefinitions || Object.keys(definitions).some(function (name) {
				return definitions[name] && definitions[name].catalogProperty === true;
			});
			var accepted = ["id"].concat(Object.keys(definitions).filter(function (name) {
				var definition = definitions[name] || {};
				return name !== "id" && (canonicalDefinitions || name === "kind" || definition.catalogProperty === true);
			}));
			if (hasCatalog && accepted.length > 0) {
				Object.keys(props).forEach(function (name) {
					if (accepted.indexOf(name) !== -1) return;
					diagnostics.push({
						severity: "error",
						code: "FRONTEND_PROPERTY_UNKNOWN",
						message: "Unknown property '" + name + "' on <" + String(projected.type || projected.tag || node.type || "Flow block") + ">.",
						path: String(node.path || projected.sourceMutationPath || ""),
						property: name,
						acceptedProperties: accepted,
						hint: "Use one of the catalog properties: " + accepted.join(", ") + "."
					});
				});
			}
			(node.children || []).forEach(visit);
		}
		visit(tree);
		return diagnostics;
	}

	function validate(ctx, props, path, source) {
		if (isStylesheet(path)) {
			var cssDiagnostics = [];
			var stripped = String(source || "")
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
			var depth = 0;
			for (var cssIndex = 0; cssIndex < stripped.length; cssIndex++) {
				if (stripped.charAt(cssIndex) === "{") depth++;
				if (stripped.charAt(cssIndex) === "}") depth--;
				if (depth < 0) break;
			}
			if (depth !== 0) {
				cssDiagnostics.push({
					severity: "error",
					code: "FRONTEND_CSS_UNBALANCED_BLOCK",
					message: "Application CSS has unbalanced block braces.",
					hint: "Correct app.flow.css, then call frontend-svelte-code-check again."
				});
			}
			return {
				ok: cssDiagnostics.length === 0,
				sourceFile: path.relative,
				diagnostics: cssDiagnostics,
				errorCount: cssDiagnostics.length,
				warningCount: 0
			};
		}
		var diagnostics = sourceDiagnostics(source);
		if (!diagnostics.some(function (item) { return item.severity === "error"; })) {
			try {
				var drafts = {};
				drafts[path.absolute] = source;
				var tree = ctx.authoringTreeSource({
					projectDir: String(props.projectDir),
					surface: "frontend",
					builder: "svelte",
					frontendSourceDrafts: drafts,
					detail: "inspect",
					maxDepth: 64,
					includeDefinition: true,
					includeBindings: false
				});
				var treeError = projectedError(tree);
				if (!tree || tree.ok !== true || treeError) {
					diagnostics.push({
						severity: "error",
						code: tree && tree.error && tree.error.code || "FRONTEND_SOURCE_INVALID",
						message: tree && tree.error && tree.error.message || treeError &&
							(treeError.label || treeError.summary || treeError.message) || "Flow Svelte source could not be projected."
					});
				} else {
					(tree.diagnostics || []).forEach(function (item) {
						var diagnostic = {};
						Object.keys(item || {}).forEach(function (key) { diagnostic[key] = item[key]; });
						diagnostic.severity = String(diagnostic.severity || diagnostic.level || "error");
						delete diagnostic.level;
						diagnostics.push(diagnostic);
					});
					var contract = ctx.authoringContractSource({
						projectDir: String(props.projectDir),
						surface: "frontend",
						builder: "svelte"
					});
					diagnostics = diagnostics.concat(projectedPropertyDiagnostics(tree, source, contract));
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
			var error = new Error(String(first.message || "Invalid frontend source."));
			error.code = String(first.code || "FRONTEND_SOURCE_INVALID");
			error.hint = String(first.hint || "Call frontend-svelte-code-check for structured diagnostics.");
			throw error;
		}
	}

	var PREFERRED_STARTER_TAGS = [
		"PageShell", "Header", "Toolbar", "RowLayout", "ColumnLayout", "GridLayout", "Card",
		"List", "ListItem", "Text", "Image", "Icon", "Button", "LinkButton", "Status",
		"Progress", "Spinner", "Breadcrumb", "Segment", "Table", "JSON", "Input", "Select",
		"Checkbox", "RadioGroup", "Toggle", "Range", "ForEach", "If",
		"State", "Derived", "DerivedBy",
		"OnMount", "OnDestroy", "Effect", "PreEffect", "Interval", "Timeout",
		"SetValue", "UpdateList", "UpdateNumber", "Navigate", "GoBack", "Variable"
	];

	function standardStarterItems(items) {
		var byTag = {};
		(items || []).forEach(function (item) {
			var id = String(item.id || "");
			var tag = String(item.tag || item.insert && item.insert.tag || "");
			var standard = id.indexOf("svelte.") === 0 || id.indexOf("frontbuilder.svelte.") === 0;
			if (standard && tag && !byTag[tag]) {
				byTag[tag] = item;
			}
		});
		var orderedTags = PREFERRED_STARTER_TAGS.filter(function (tag) { return !!byTag[tag]; });
		Object.keys(byTag).filter(function (tag) {
			return PREFERRED_STARTER_TAGS.indexOf(tag) === -1;
		}).sort().forEach(function (tag) {
			orderedTags.push(tag);
		});
		return orderedTags.map(function (tag) { return byTag[tag]; });
	}

	function routeSources(props) {
		var root = new File(String(props.projectDir || "")).getCanonicalFile();
		var model = String(props.sourceFile || "").replace(/\\/g, "/");
		var marker = "/src/routes/";
		var markerIndex = model.indexOf(marker);
		var routesRelative = markerIndex >= 0 ? model.substring(0, markerIndex + marker.length - 1) : "";
		var routes = routesRelative ? new File(root, routesRelative) : null;
		var pages = [];
		function visit(directory) {
			var files = directory && directory.listFiles();
			if (!files) return;
			Array.prototype.slice.call(files).sort(function (left, right) {
				return String(left.getName()).localeCompare(String(right.getName()));
			}).forEach(function (file) {
				if (file.isDirectory()) {
					visit(file);
					return;
				}
				if (String(file.getName()) !== "+page.flow.svelte") return;
				var relative = String(file.getCanonicalPath()).substring(String(root.getCanonicalPath()).length + 1).replace(/\\/g, "/");
				var routeDir = String(file.getParentFile().getCanonicalPath()).substring(String(routes.getCanonicalPath()).length).replace(/\\/g, "/");
				var routeParts = routeDir.split("/").filter(function (part) { return part && !/^\(.+\)$/.test(part); });
				var path = routeParts.length ? "/" + routeParts.join("/") : "/";
				var parameters = [];
				routeParts.forEach(function (part) {
					var match = part.match(/^\[\[?(\.\.\.)?([^=\]]+)(?:=([^\]]+))?\]?\]$/);
					if (!match) return;
					parameters.push({
						name: match[2],
						required: part.indexOf("[[") !== 0,
						rest: !!match[1],
						matcher: match[3] || "",
						source: "@route.params." + match[2]
					});
				});
				var content = FileUtils.readFileToString(file, "UTF-8");
				var idMatch = content.match(/\bpage\s*:\s*\{[\s\S]*?\bid\s*:\s*["']([^"']+)["']/);
				pages.push({
					id: idMatch ? String(idMatch[1]) : path === "/" ? "home" : path.replace(/^\/+/, "").replace(/[^A-Za-z0-9]+(.)/g, function (_, next) { return String(next).toUpperCase(); }),
					path: path,
					parameters: parameters,
					sourceFile: relative
				});
			});
		}
		if (routes && routes.isDirectory()) visit(routes);
		return pages;
	}

	function relatedSources(props) {
		var model = String(props.sourceFile || "").replace(/\\/g, "/");
		var marker = "/src/routes/";
		var markerIndex = model.indexOf(marker);
		var sourceRoot = markerIndex >= 0 ? model.substring(0, markerIndex + "/src".length) : "";
		return {
			applicationStyles: sourceRoot ? sourceRoot + "/app.flow.css" : ""
		};
	}

	function compactProperties(properties) {
		var out = {};
		Object.keys(properties || {}).forEach(function (name) {
			var definition = properties[name] || {};
			var value = String(definition.type || "unknown") + ":" +
				(definition.intents || ["literal"]).join("|");
			if (definition["enum"] && definition["enum"].length) {
				value += "[" + definition["enum"].join(",") + "]";
			}
			if (definition.required === true) value += "!";
			out[name] = value;
		});
		return out;
	}

	function sourceSlots(slots) {
		return Object.keys(slots || {}).map(function (name) {
			if (name === "default" || name === "children") return "Children";
			return name.charAt(0).toUpperCase() + name.substring(1);
		});
	}

	function starterContract(ctx, props) {
		try {
			var contract = ctx.authoringContractSource({
				projectDir: String(props.projectDir),
				surface: "frontend",
				builder: "svelte"
			});
			var blocks = [];
			standardStarterItems(contract.items).forEach(function (item) {
				var tag = String(item.tag || item.insert && item.insert.tag || "");
				blocks.push({
					tag: tag,
					properties: compactProperties(item.properties),
					slots: sourceSlots(item.slots)
				});
			});
			var portableBlocks = [];
			var seenPortable = {};
			(contract.items || []).forEach(function (item) {
				var id = String(item.id || "");
				var tag = String(item.tag || item.insert && item.insert.tag || "");
				if (id.indexOf("flow.block.") !== 0 || !tag || seenPortable[id]) return;
				seenPortable[id] = true;
				portableBlocks.push({
					id: id.substring("flow.block.".length),
					tag: tag,
					description: String(item.description || "")
				});
			});
			portableBlocks.sort(function (left, right) {
				return left.id.localeCompare(right.id);
			});
			return {
				version: 2,
				root: {
					tag: "FlowComponent",
					properties: {
						id: "string:literal!",
						label: "string:literal"
					},
					slots: ["Variables", "Events", "Structure"],
					example: '<FlowComponent id="home" label="Home"><Variables><State id="ready" type="boolean" value={false} /></Variables><Events>...</Events><Structure>...</Structure></FlowComponent>'
				},
				valueSyntax: {
					literal: 'property="literal"',
					expression: "property={browserExpression}",
					source: 'property="@producer.path"',
					local: 'property="@local.name"'
				},
				pages: routeSources(props),
				sources: relatedSources(props),
				navigation: {
					open: '<Navigate id="openProduct" page="product"><Params><Variable name="id" value="@item.id" /></Params></Navigate>',
					readParameter: "@route.params.id",
					query: '<Query><Variable name="tab" value="details" /></Query>',
					back: '<GoBack id="back" fallback="/" />'
				},
				blocks: blocks,
				portableBlocks: portableBlocks,
				actionPattern: "FlowComponent > Events > OnMount|OnDestroy|Effect|PreEffect|Interval|Timeout > Actions > SetValue|UpdateList|UpdateNumber|FlowBlock",
				rules: [
					"FlowComponent is a non-visual source root; put class and layout properties on its visible children.",
					"Declare mutable page-local state with State, and computed state with Derived or DerivedBy, under the root Variables slot; bind them with @local.id.",
					"Variable is for action, route Params and Query arguments; do not use it as page-local state.",
					"Put lifecycle blocks in the root Events slot, never in visual Structure. Interval and Timeout register on mount and clean themselves up on teardown.",
					"Use SetValue, UpdateList or UpdateNumber for explicit state changes. Free browser expressions are not portable action values; use a source, literal, Derived value or typed frontend Flow block.",
					"Use only listed properties on these standard blocks.",
					"Property contracts use type:intent|intent; bindable properties accept @local.name, @action.path, @item.path and @event.path.",
					"Navigate targets a Page id; fill its required Params with Variable bindings. The target Page reads them as @route.params.name.",
					"Slots are exact Flow Svelte wrapper tags; wrap children in the listed tag.",
					"Prefer a typed portableBlocks action over an equivalent browser expression; inspect the exact palette item once when its properties are needed.",
					"Interval schedules refreshes but does not measure elapsed time; derive clocks and stopwatches from wall-clock timestamps.",
					"Use one complete code-check after the first source pass; inspect palette only for a missing block or property.",
					"After build, execute the returned bounded acceptance.calls plan unchanged and in order."
				]
			};
		} catch (e) {
			return null;
		}
	}

	function read(ctx, props, path, includeContract) {
		if (!path.file.isFile()) {
			if (isStylesheet(path)) {
				return {
					ok: true,
					exists: false,
					sourceFile: path.relative,
					code: "",
					revision: null,
					contentLength: 0,
					next: "Create this canonical application stylesheet with frontend-svelte-code-check, then frontend-svelte-code-set without a revision."
				};
			}
			throw new Error("Unknown Flow Svelte source: " + path.relative);
		}
		var resource = ctx.resourceGet({
			projectDir: props.projectDir,
			path: path.relative,
			allowLarge: true,
			maxBytes: 5000000
		});
		var result = {
			ok: true,
			exists: true,
			sourceFile: path.relative,
			code: resource.content,
			revision: resource.hash,
			contentLength: resource.contentLength
		};
		if (includeContract === true && !isStylesheet(path)) {
			var contract = starterContract(ctx, props);
			if (contract) result.authoringContract = contract;
		}
		return result;
	}

	function sourceWriteError(code, message, hint) {
		var error = new Error(message);
		error.code = code;
		error.hint = hint;
		return error;
	}

	function assertSetRevision(ctx, props, path) {
		var exists = path.file.isFile();
		var supplied = props.revision !== undefined && props.revision !== null && String(props.revision) !== "";
		if (exists && !supplied) {
			throw sourceWriteError(
				"FRONTEND_SOURCE_REVISION_REQUIRED",
				"Flow Svelte source already exists; frontend-svelte-code-set requires its current revision.",
				"Call frontend-svelte-code-get, then retry with the returned revision."
			);
		}
		if (!exists && supplied) {
			throw sourceWriteError(
				"FRONTEND_SOURCE_STALE_REVISION",
				"Flow Svelte source no longer exists; the supplied revision is stale.",
				"Call frontend-svelte-code-get to refresh the source state, or omit revision only when creating a missing source."
			);
		}
		if (exists) {
			var current = String(read(ctx, props, path, false).revision);
			if (current !== String(props.revision)) {
				throw sourceWriteError(
					"FRONTEND_SOURCE_STALE_REVISION",
					"Flow Svelte source changed since it was read; the supplied revision is stale.",
					"Call frontend-svelte-code-get again and reapply the intended change to the current source."
				);
			}
		}
	}

	function atomicWrite(path, source) {
		var parent = path.file.getParentFile();
		if (parent != null && !parent.isDirectory() && !parent.mkdirs() && !parent.isDirectory()) {
			throw new Error("Unable to create Flow Svelte source directory: " + parent);
		}
		var parentPath = parent.toPath();
		var temporary = Files.createTempFile(parentPath, "." + path.file.getName() + ".", ".tmp");
		var moved = false;
		try {
			FileUtils.writeStringToFile(temporary.toFile(), source, "UTF-8");
			if (path.file.isFile()) {
				try {
					Files.setPosixFilePermissions(temporary, Files.getPosixFilePermissions(path.file.toPath()));
				} catch (ignored) {
					// Non-POSIX filesystems keep their native defaults.
				}
			} else {
				temporary.toFile().setReadable(true, false);
				temporary.toFile().setWritable(true, true);
			}
			try {
				Files.move(temporary, path.file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
			} catch (error) {
				if (!(error instanceof AtomicMoveNotSupportedException)) throw error;
				Files.move(temporary, path.file.toPath(), StandardCopyOption.REPLACE_EXISTING);
			}
			moved = true;
		} finally {
			if (!moved) {
				try {
					Files.deleteIfExists(temporary);
				} catch (ignored) {
					// Preserve the original write failure.
				}
			}
		}
	}

	function notifySourceMutation(ctx, props, path) {
		if (ctx && typeof ctx.notifySourceMutation === "function") {
			ctx.notifySourceMutation({
				projectDir: String(props.projectDir || ""),
				path: String(path.relative || "")
			});
		}
	}

	function write(ctx, props, path, source) {
		var validation = validate(ctx, props, path, source);
		requireValid(validation);
		atomicWrite(path, source);
		notifySourceMutation(ctx, props, path);
		var saved = read(ctx, props, path, false);
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
				result = read(ctx, props, path, true);
			} else if (operation === "check") {
				var source = props.code !== undefined && props.code !== null
					? String(props.code)
					: String(read(ctx, props, path, false).code);
				result = validate(ctx, props, path, source);
				result.revision = path.file.isFile() ? read(ctx, props, path, false).revision : null;
			} else if (operation === "set") {
				if (props.code === undefined || props.code === null) {
					throw new Error("frontend-svelte-code-set requires code.");
				}
				sourceWriteLock.lock();
				try {
					assertSetRevision(ctx, props, path);
					result = write(ctx, props, path, String(props.code));
				} finally {
					sourceWriteLock.unlock();
				}
			} else if (operation === "patch") {
				var patch = String(props.codepatch || props.patch || "");
				if (!patch) throw new Error("frontend-svelte-code-patch requires codepatch.");
				if (!props.revision) throw new Error("frontend-svelte-code-patch requires the revision returned by frontend-svelte-code-get.");
				sourceWriteLock.lock();
				try {
					assertSetRevision(ctx, props, path);
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
					atomicWrite(path, String(preview.content));
					notifySourceMutation(ctx, props, path);
					result = read(ctx, props, path, false);
					result.hunks = preview.hunks;
					result.oldRevision = String(props.revision);
					result.diagnostics = validation.diagnostics;
					result.errorCount = validation.errorCount;
					result.warningCount = validation.warningCount;
					result.written = true;
				} finally {
					sourceWriteLock.unlock();
				}
			} else {
				throw new Error("Unsupported Flow Svelte source operation: " + operation);
			}
			ctx.write(props.out || "local.frontendSource", result);
			return result;
		}
	};
}())
