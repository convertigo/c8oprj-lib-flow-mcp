const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "uses": ["project-starter"],
  "description": "Bootstraps a Convertigo project for Flow authoring: a new project holds only its project bean, its FlowEngine and its references (no connector, no sequence), then FlowEngine metadata is added through DBO APIs. Any persisted business data with roles uses lib_flow_entity by default; sign-in, CSV and jobs are independent additions.",
  "icon": "mdi:application-import",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Convertigo project name to create or customize.",
    },
    "templateUrl": {
      "kind": "text",
      "type": "string",
      "default": "",
      "description": "Optional project archive URL to import instead of creating a bare Flow project (when the project does not exist or force=true). Leave empty: a Flow project needs no template.",
    },
    "ui": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Also configure the experimental Svelte frontbuilder. For persisted business data with roles, include lib_flow_entity in references and follow flow://guide/multipage-entities; authentication, CSV and jobs do not select direct SQL.",
    },
    "references": {
      "kind": "literal",
      "type": "array",
      "items": {
        "type": "string",
      },
      "default": [],
      "description": "Existing Convertigo projects to reference after bootstrap. Include lib_flow_entity for persisted business data with roles, including with demonstration sign-in, CSV or jobs.",
    },
    "corsOrigin": {
      "kind": "text",
      "type": "string",
      "default": "",
      "description": "CORS policy of a project the bootstrap creates. Empty (the default): no cross-origin call, the Flow viewer and the built application being served by Convertigo itself. To open the project on purpose: the allowed origins separated by # (https://app.example.com#https://admin.example.com), =Global for the cors.policy of the server, or =Origin / * for any origin, only for an API whose callers send no session cookie (a cookie session called from any origin is open to cross-site requests). An existing project keeps its policy (Properties > CORS Origin).",
    },
    "force": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Recreate the project even if it already exists (its previous files are backed up, as a project deploy does).",
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Preview the bootstrap without importing or saving.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.projectBootstrap",
      "description": "Scope path receiving the bootstrap result.",
    },
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": {
          "type": "boolean",
        },
        "project": {
          "type": "string",
        },
        "imported": {
          "type": "boolean",
        },
        "createdFlowEngine": {
          "type": "boolean",
        },
        "configuredSvelte": {
          "type": "boolean",
        },
        "studioTarget": {
          "type": "object",
          "properties": {
            "project": {
              "type": "string",
            },
            "nodeId": {
              "type": "string",
            },
            "sourcePath": {
              "type": "string",
            },
            "reveal": {
              "type": "boolean",
            },
          },
        },
      },
    },
  },
  "runtime": "rhino",
}

(function () {
	// A new Flow project needs no template: no default connector since engine #1225, and no sequence. It is the
	// project bean alone, written in the standard YAML format, then loaded and given its FlowEngine and references.
	var NEW_PROJECT_COMMENT = "Flow project";
	var NEW_PROJECT_VERSION = "1.0.0";
	var GITIGNORE = [
		"/_private/",
		"/.settings",
		"/.gradle",
		"/.project",
		"",
		"/DisplayObjects/mobile/*",
		"!/DisplayObjects/mobile/assets",
		"",
		"/oas2/",
		"/oas3/",
		"",
		"/build/",
		""
	].join("\n");
	var GITATTRIBUTES = "* text=auto\n*.sh eol=lf\n";
	var ENGINE_QNAME = "lib_flow_engine.Engine";
	var FRONTBUILDER_PROJECT = "lib_flow_frontbuilder_svelte";
	var lastWorkspaceRoots = [];

	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function boolValue(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		if (value === true || value === false) {
			return value;
		}
		var text = String(value).toLowerCase();
		if (text === "true" || text === "1" || text === "yes") {
			return true;
		}
		if (text === "false" || text === "0" || text === "no") {
			return false;
		}
		return fallback;
	}

	function projectName(value) {
		var name = String(value || "").trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
			throw new Error("Invalid Convertigo project name: " + name);
		}
		return name;
	}

	function projectNames(value) {
		if (value === undefined || value === null || value === "") {
			return [];
		}
		var values = Object.prototype.toString.call(value) === "[object Array]" ? value : [value];
		var seen = {};
		var names = [];
		values.forEach(function (entry) {
			var name = projectName(entry);
			if (!seen[name]) {
				seen[name] = true;
				names.push(name);
			}
		});
		return names;
	}

	// The demo sign-in switch of the application, off unless the server says otherwise: a Flow that opens a session
	// without a password runs only when String(config.demo.login) === "true", which the global symbol
	// <project>.demo.login turns on for a demo server or the Studio; a CAR deployed elsewhere keeps it off.
	function demoLoginLines(name) {
		return [
			"  demo:",
			"    login: \"${" + name + ".demo.login=false}\""
		];
	}

	function engineSource(name, ui, resourceRoot, modelPath) {
		if (!ui) {
			return [
				"version: 1",
				"engineQName: " + ENGINE_QNAME,
				"bindings: {}",
				"config:"
			].concat(demoLoginLines(name), [""]).join("\n");
		}
		return [
			"version: 1",
			"engineQName: " + ENGINE_QNAME,
			"bindings: {}",
			"config:"
		].concat(demoLoginLines(name), [
			"  frontbuilder:",
			"    svelte:",
			"      target: svelte5",
			"      resourceRoot: " + resourceRoot,
			"      privateDir: _private/svelte",
			"      modelPath: " + modelPath,
			"      buildOutput: DisplayObjects/mobile",
			"configVisibility:",
			"  frontbuilder: private",
			""
		]).join("\n");
	}

	function jsString(value) {
		return JSON.stringify(String(value || ""));
	}

	function svelteModelPath(name) {
		return "_flow/frontbuilder/svelte/model/" + name + "/src/routes/+page.flow.svelte";
	}

	function ensureParent(file) {
		Packages.java.nio.file.Files.createDirectories(file.getParentFile().toPath());
	}

	function writeUtf8(file, content) {
		var Files = Packages.java.nio.file.Files;
		var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
		Files.write(file.toPath(), new Packages.java.lang.String(String(content)).getBytes(StandardCharsets.UTF_8));
	}

	// The first Page of a new frontend, in the v2 source format the frontbuilder loads.

	function ensureSvelteModel(ctx, project, name) {
		var File = Packages.java.io.File;
		var relative = svelteModelPath(name);
		var file = new File(String(project.getDirPath()), relative);
		var created = false;
		if (!file.isFile()) {
			ensureParent(file);
			writeUtf8(file, ctx.lib("project-starter").initialSveltePage(name));
			created = true;
		}
		return {
			path: relative,
			file: String(file.getAbsolutePath()),
			created: created,
			exists: file.isFile(),
			// The revision code-get returns for this Page: its first code-set passes it (the Page exists already)
			revision: file.isFile() ? sha256Hex(String(Packages.org.apache.commons.io.FileUtils.readFileToString(file, "UTF-8"))) : null
		};
	}

	function sha256Hex(text) {
		var digest = Packages.java.security.MessageDigest.getInstance("SHA-256")
			.digest(new Packages.java.lang.String(String(text || "")).getBytes("UTF-8"));
		var out = "";
		for (var i = 0; i < digest.length; i++) {
			var value = digest[i] < 0 ? digest[i] + 256 : digest[i];
			out += (value < 16 ? "0" : "") + value.toString(16);
		}
		return out;
	}

	function currentModelPath(source) {
		var match = String(source || "").match(/^\s*modelPath:\s*(.*?)\s*$/m);
		return match ? match[1] : "";
	}

	function projectFileExists(project, path) {
		if (!path) {
			return false;
		}
		var File = Packages.java.io.File;
		return new File(String(project.getDirPath()), String(path)).isFile();
	}

	function projectNameFromFile(file) {
		try {
			return String(Packages.com.twinsoft.convertigo.engine.DatabaseObjectsManager.getProjectName(file) || "");
		} catch (_ignoreDefinition) {
			return "";
		}
	}

	function siblingProjectFile(engine, name, anchorProject) {
		var File = Packages.java.io.File;
		var roots = {};
		function add(root) {
			if (root && root.isDirectory()) {
				roots[String(root.getAbsolutePath())] = root;
			}
		}
		if (engine.PROJECTS_PATH !== undefined && engine.PROJECTS_PATH !== null) {
			add(new File(String(engine.PROJECTS_PATH)));
		}
		if (anchorProject) {
			add(new File(String(anchorProject.getDirPath())).getParentFile());
		}
		var dbom = engine.theApp.databaseObjectsManager;
		try {
			var names = dbom.getAllProjectNamesList(false).iterator();
			while (names.hasNext()) {
				var existingName = String(names.next());
				var loadedProject = null;
				try {
					loadedProject = dbom.getLoadedProjectByName(existingName);
				} catch (_ignoreLoadedProject) {
				}
				if (loadedProject != null) {
					add(new File(String(loadedProject.getDirPath())).getParentFile());
					continue;
				}
				try {
					add(new File(String(engine.projectDir(existingName))).getParentFile());
				} catch (_ignoreProjectDir) {
				}
			}
		} catch (_ignoreProjectNames) {
		}
		var rootKeys = Object.keys(roots);
		lastWorkspaceRoots = rootKeys.slice();
		for (var i = 0; i < rootKeys.length; i++) {
			var children = roots[rootKeys[i]].listFiles();
			if (!children) {
				continue;
			}
			for (var j = 0; j < children.length; j++) {
				var definition = new File(children[j], "c8oProject.yaml");
				var candidateName = definition.isFile() ? projectNameFromFile(definition) : "";
				if (candidateName === name) {
					return definition;
				}
			}
		}
		return null;
	}

	function resolveProject(engine, name, anchorProject) {
		var firstError = null;
		try {
			var loaded = engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(name), false);
			if (loaded != null) {
				return loaded;
			}
		} catch (e) {
			firstError = e;
		}
		var projectFile = null;
		try {
			projectFile = engine.projectYamlFile(String(name));
		} catch (_ignoreProjectYamlFile) {
		}
		if (projectFile == null || !projectFile.isFile()) {
			projectFile = siblingProjectFile(engine, String(name), anchorProject);
		}
		if (projectFile == null || !projectFile.isFile()) {
			return null;
		}
		try {
			var imported = engine.theApp.databaseObjectsManager.importProject(projectFile, false);
			if (imported != null) {
				return imported;
			}
			if (firstError != null) {
				throw firstError;
			}
			return null;
		} catch (e) {
			throw new Error("Unable to load workspace project " + name + " from " +
				String(projectFile.getAbsolutePath()) + ": " + String(e || firstError));
		}
	}

	function svelteResourceRoot() {
		return "_flow/frontbuilder/svelte";
	}

	function ensureFrontbuilderReference(engine, project) {
		try {
			engine.theApp.referencedProjectManager.getReferenceFromProject(project, FRONTBUILDER_PROJECT);
			return true;
		} catch (_ignoreReference) {
			return false;
		}
	}

	function yamlHeaderVersion() {
		try {
			var YamlConverter = Packages.com.twinsoft.convertigo.engine.util.YamlConverter;
			return String(YamlConverter.minimumVersion(String(Packages.com.twinsoft.convertigo.beans.Version.version),
				YamlConverter.Format.STANDARD));
		} catch (_ignoreVersion) {
			return "8.5.0.m006";
		}
	}

	// The CORS policy of a new project: empty, a # list of origins (scheme://host[:port]), =Global, =Origin or *.
	function corsOriginValue(value) {
		var text = String(value === undefined || value === null ? "" : value).trim();
		if (text === "" || text === "=Global" || text === "=Origin" || text === "*") {
			return text;
		}
		var origins = text.split("#");
		origins.forEach(function (origin) {
			if (!/^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(origin) && !/^https?:\/\/\[[0-9A-Fa-f:.]+\](?::\d{1,5})?$/.test(origin)) {
				throw new Error("corsOrigin must be empty, =Global, =Origin, * or origins separated by #, each scheme://host[:port] " +
					"without path or trailing slash (https://app.example.com#https://admin.example.com): " + JSON.stringify(origin));
			}
		});
		return text;
	}

	// =Origin or * answers any site: with the session cookie of a signed-in user, any page the user visits may call the
	// application in their name. The bootstrap still applies it (an API without cookie may need it) but says so.
	function corsOriginWarning(cors) {
		if (cors !== "=Origin" && cors !== "*") {
			return null;
		}
		return {
			code: "CORS_ANY_ORIGIN",
			severity: "warning",
			message: "corsOrigin " + cors + " lets any site call this project with the session cookie of a signed-in user. " +
				"Keep the default (empty: same origin, the Flow viewer and the production build are served by Convertigo) or list the allowed origins " +
				"separated by #; use " + cors + " only for an API whose callers send no session cookie."
		};
	}

	// The project bean of a new Flow project, in the standard YAML format. Its timeouts are the defaults of a
	// Convertigo project (an HTTP session of 1800 s, a context of 300 s): the templates' 60 s ended the session of an
	// API client idle for a minute. Its CORS policy is empty unless corsOrigin opens it: the templates' =Origin
	// answered any origin with the session cookie of the caller.
	function newProjectYaml(name, corsOrigin) {
		var cors = corsOriginValue(corsOrigin);
		return [
			"convertigo: " + yamlHeaderVersion(),
			"↓" + name + " [core.Project]:",
			"  comment: " + NEW_PROJECT_COMMENT,
			"  corsOrigin: '" + cors.replace(/'/g, "''") + "'",
			"  version: " + NEW_PROJECT_VERSION,
			""
		].join("\n");
	}

	function writeIfMissing(file, content) {
		if (!file.exists()) {
			writeUtf8(file, content);
		}
	}

	// A bare Flow project, created and loaded without download. force replaces an existing project as a deploy does:
	// its files are backed up first, its Eclipse project and VCS metadata are kept.
	function createProject(engine, name, existing, corsOrigin) {
		var File = Packages.java.io.File;
		var dbom = engine.theApp.databaseObjectsManager;
		var projectFile = existing != null
			? new File(String(existing.getDirPath()), "c8oProject.yaml")
			: engine.projectYamlFile(String(name));
		var warmup = null;
		try {
			warmup = Packages.com.twinsoft.convertigo.engine.flow.FlowRuntimeWarmup;
		} catch (_ignoreWarmup) {
		}
		if (existing != null) {
			try { warmup.projectDeploying(String(name)); } catch (_ignoreDeploying) {}
			var Option = Packages.com.twinsoft.convertigo.engine.enums.DeleteProjectOption;
			dbom.deleteProject(String(name), Option.createBackup, Option.preserveEclipse, Option.preserveVCS);
		}
		try {
			ensureParent(projectFile);
			writeUtf8(projectFile, newProjectYaml(name, corsOrigin));
			writeIfMissing(new File(projectFile.getParentFile(), ".gitignore"), GITIGNORE);
			writeIfMissing(new File(projectFile.getParentFile(), ".gitattributes"), GITATTRIBUTES);
			var project = dbom.importProject(projectFile, true);
			if (project == null) {
				throw new Error("No project loaded from " + String(projectFile.getAbsolutePath()));
			}
			project.setYamlFormat(Packages.com.twinsoft.convertigo.engine.util.YamlConverter.Format.STANDARD);
			return project;
		} finally {
			if (existing != null) {
				try { warmup.projectDeployed(String(name)); } catch (_ignoreDeployed) {}
			}
		}
	}

	function importTemplate(engine, name, templateUrl) {
		var ProjectUrlParser = Packages.com.twinsoft.convertigo.engine.util.ProjectUrlParser;
		var parser = new ProjectUrlParser(name + "=" + templateUrl);
		if (!parser.isValid()) {
			throw new Error("Invalid template URL: " + templateUrl);
		}
		var project = engine.theApp.referencedProjectManager.importProject(parser, true);
		if (project == null) {
			throw new Error("No project imported with: " + name + "=" + templateUrl);
		}
		// A copied template is a new project; configuring an existing project keeps its format.
		project.setYamlFormat(Packages.com.twinsoft.convertigo.engine.util.YamlConverter.Format.STANDARD);
		return project;
	}

	// An existing _flow/engine.yaml is never rewritten: the bootstrap adds the keys it needs that are missing, at the end
	// of their mapping, and keeps every value already there (config.sql, connections, another frontend path...).

	function isMapping(value) {
		return value !== null && typeof value === "object" && !Array.isArray(value);
	}

	function yamlScalar(value) {
		if (value === null || value === undefined) {
			return "null";
		}
		if (typeof value !== "string") {
			return JSON.stringify(value);
		}
		return /^[A-Za-z_\/][\w.\/+-]*$/.test(value) && !/^(?:true|false|null|yes|no|on|off|y|n)$/i.test(value)
			? value : JSON.stringify(value);
	}

	function yamlLines(key, value, indent) {
		var pad = new Array(indent + 1).join(" ");
		if (!isMapping(value)) {
			return [pad + key + ": " + yamlScalar(value)];
		}
		var keys = Object.keys(value);
		return keys.length ? keys.reduce(function (lines, child) {
			return lines.concat(yamlLines(child, value[child], indent + 2));
		}, [pad + key + ":"]) : [pad + key + ": {}"];
	}

	var YAML_KEY = /^("(?:[^"\\]|\\.)*"|'[^']*'|[^\s#'"\-][^:#]*?|-[^\s:#][^:#]*?)\s*:(?=\s|$)/;

	function contentLine(line) {
		return line.trim() !== "" && !/^\s*#/.test(line);
	}

	function indentOf(line) {
		return line.match(/^ */)[0].length;
	}

	// the keys of the block mapping held by lines[from, to)
	function mappingEntries(lines, from, to) {
		var indent = -1;
		var entries = {};
		for (var i = from; i < to; i++) {
			if (!contentLine(lines[i])) {
				continue;
			}
			if (indent < 0) {
				indent = indentOf(lines[i]);
			}
			var match = indentOf(lines[i]) === indent ? lines[i].substring(indent).match(YAML_KEY) : null;
			if (match) {
				entries[match[1].replace(/^(["'])(.*)\1$/, "$2")] = i;
			}
		}
		return { indent: indent, entries: entries };
	}

	// the line after the value of the key at line start (compact sequences sit at the key's own indent)
	function blockEnd(lines, start, indent, to) {
		var last = start + 1;
		for (var i = start + 1; i < to; i++) {
			if (!contentLine(lines[i])) {
				continue;
			}
			var lineIndent = indentOf(lines[i]);
			if (lineIndent < indent || lineIndent === indent && !/^-(?:\s|$)/.test(lines[i].substring(indent))) {
				break;
			}
			last = i + 1;
		}
		return last;
	}

	function missingConfig(current, target, path, report) {
		var missing = {};
		Object.keys(target).forEach(function (key) {
			var keyPath = path.concat(key).join(".");
			if (!Object.prototype.hasOwnProperty.call(current, key)) {
				missing[key] = target[key];
				report.added.push(keyPath);
			} else if (isMapping(current[key]) && isMapping(target[key])) {
				var nested = missingConfig(current[key], target[key], path.concat(key), report);
				if (Object.keys(nested).length) {
					missing[key] = nested;
				}
			} else if (JSON.stringify(current[key]) !== JSON.stringify(target[key])) {
				report.kept.push(keyPath);
			}
		});
		return missing;
	}

	function insertMissing(lines, from, to, indent, missing, edits) {
		var scan = mappingEntries(lines, from, to);
		if (scan.indent >= 0) {
			indent = scan.indent;
		}
		var appended = [];
		Object.keys(missing).forEach(function (key) {
			var at = scan.entries[key];
			if (at === undefined) {
				appended = appended.concat(yamlLines(key, missing[key], indent));
				return;
			}
			var rest = lines[at].substring(indent).replace(YAML_KEY, "").replace(/\s+#.*$/, "").trim();
			if (rest === "{}") {
				edits.push({ start: at, end: at + 1, lines: yamlLines(key, missing[key], indent) });
			} else if (rest === "") {
				insertMissing(lines, at + 1, blockEnd(lines, at, indent, to), indent + 2, missing[key], edits);
			} else {
				throw new Error("flow-style mapping " + key);
			}
		});
		if (appended.length) {
			var last = from;
			for (var i = from; i < to; i++) {
				if (contentLine(lines[i])) {
					last = i + 1;
				}
			}
			edits.push({ start: last, end: last, lines: appended });
		}
	}

	function canonical(value) {
		if (Array.isArray(value)) {
			return value.map(canonical);
		}
		if (!isMapping(value)) {
			return value;
		}
		var out = {};
		Object.keys(value).sort().forEach(function (key) { out[key] = canonical(value[key]); });
		return out;
	}

	function deepMerge(current, missing) {
		var out = JSON.parse(JSON.stringify(current));
		Object.keys(missing).forEach(function (key) {
			out[key] = Object.prototype.hasOwnProperty.call(out, key) && isMapping(out[key]) && isMapping(missing[key])
				? deepMerge(out[key], missing[key]) : missing[key];
		});
		return out;
	}

	// { source, added, kept } or { source: null, ... } when the text cannot be edited without touching what it holds
	function mergeEngineSource(parseYaml, source, wanted) {
		var report = { source: null, added: [], kept: [] };
		var current = parseYaml(source);
		var target = parseYaml(wanted);
		if (!isMapping(current) || !isMapping(target)) {
			return report;
		}
		var missing = missingConfig(current, target, [], report);
		if (!report.added.length) {
			report.source = source;
			return report;
		}
		if (/[\r\t]/.test(source) || /^(?:---|\.\.\.|%)/m.test(source)) {
			return report;
		}
		var lines = source.split("\n");
		var finalNewline = lines.length > 1 && lines[lines.length - 1] === "";
		if (finalNewline) {
			lines.pop();
		}
		var edits = [];
		try {
			insertMissing(lines, 0, lines.length, 0, missing, edits);
		} catch (_flowStyle) {
			return report;
		}
		edits.map(function (edit, index) { edit.index = index; return edit; })
			.sort(function (left, right) { return right.start - left.start || right.index - left.index; })
			.forEach(function (edit) {
				Array.prototype.splice.apply(lines, [edit.start, edit.end - edit.start].concat(edit.lines));
			});
		var merged = lines.join("\n") + "\n";
		// proof: every value already there is unchanged, and only the missing keys were added
		if (JSON.stringify(canonical(parseYaml(merged))) === JSON.stringify(canonical(deepMerge(current, missing)))) {
			report.source = merged;
		}
		return report;
	}

	function ensureFlowEngine(ctx, project, ui, resourceRoot, modelPath) {
		var written = false;
		var FlowEngine = Packages.com.twinsoft.convertigo.beans.flow.FlowEngine;
		var flowEngine = project.getFlowEngine();
		var created = false;
		var merge = null;
		if (flowEngine == null) {
			flowEngine = new FlowEngine();
			flowEngine.bNew = true;
			flowEngine.setName("FlowEngine");
			project.add(flowEngine);
			created = true;
		}
		flowEngine.setEngineQName(ENGINE_QNAME);
		var source = String(flowEngine.getEngineSource() || "");
		var hasFrontend = source.indexOf("frontbuilder:") !== -1;
		var sourceModelPath = currentModelPath(source);
		var sourceModelExists = projectFileExists(project, sourceModelPath);
		var wanted = engineSource(String(project.getName()), ui, resourceRoot, modelPath);
		if (created || source.trim() === "") {
			flowEngine.setEngineSource(wanted);
			written = true;
		} else if (ui && (!hasFrontend || !sourceModelExists)) {
			merge = mergeEngineSource(function (text) { return ctx.parseYaml(text); }, source, wanted);
			if (merge.source !== null && merge.source !== source) {
				flowEngine.setEngineSource(merge.source);
				written = true;
			}
		}
		project.hasChanged = true;
		return {
			flowEngine: flowEngine,
			created: created,
			written: written,
			merge: merge,
			configuredSvelte: ui && (merge === null || merge.source !== null)
		};
	}

	function notifyStudioSelection(project, sourcePath) {
		if (!sourcePath) {
			return false;
		}
		try {
			var Bridge = Packages.com.twinsoft.convertigo.engine.flow.FlowEngineBridge;
			if (typeof Bridge.notifySourceMutationWithReveal === "function") {
				Bridge.notifySourceMutationWithReveal(
					String(project.getDirPath()),
					String(sourcePath),
					true
				);
			} else {
				Bridge.notifySourceMutation(
					String(project.getDirPath()),
					String(sourcePath),
					true
				);
			}
			return true;
		} catch (_ignoreStudioSelection) {
			return false;
		}
	}

	function refreshStudio(engine, project, sourcePath) {
		var projectName = String(project.getName());
		try {
			engine.theApp.schemaManager.clearCache(projectName);
		} catch (_ignoreSchemaCache) {
		}
		try {
			notifyStudioSelection(project, sourcePath);
			if (engine.isStudioMode() !== true) {
				return;
			}
			var ConvertigoPlugin = Packages.com.twinsoft.convertigo.eclipse.ConvertigoPlugin;
			var Runnable = Packages.java.lang.Runnable;
			var plugin = ConvertigoPlugin.getDefault();
			if (plugin == null) {
				return;
			}
			ConvertigoPlugin.asyncExec(new Runnable({ run: function () {
				try {
					var view = plugin.getProjectExplorerView();
					if (view == null) {
						return;
					}
					var treeObject = view.findTreeObjectByUserObject(project);
					if (treeObject != null) {
						view.reloadTreeObject(treeObject);
					} else {
						view.refreshProjects();
					}
				} catch (e) {
					ConvertigoPlugin.logException(e, "Unable to refresh Project Explorer after Flow bootstrap", false);
				}
			}}));
		} catch (_ignoreStudioRefresh) {
		}
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var name = projectName(prop(props, "project") || prop(props, "name"));
			var templateUrl = String(prop(props, "templateUrl") || "").trim();
			var ui = boolValue(prop(props, "ui"), false);
			var references = projectNames(prop(props, "references"));
			var force = boolValue(prop(props, "force"), false);
			var dryRun = boolValue(prop(props, "dryRun"), false);
			var corsOrigin = corsOriginValue(prop(props, "corsOrigin"));
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var engine = Engine;
			var existing = resolveProject(engine, name, null);
			var shouldImport = existing == null || force;
			var result = {
				ok: true,
				project: name,
				templateUrl: templateUrl,
				ui: ui,
				force: force,
				dryRun: dryRun,
				references: references,
				imported: false,
				created: false,
				existing: existing != null,
				createdFlowEngine: false,
				configuredSvelte: false,
				saved: false,
				studioTarget: {
					project: name,
					nodeId: name,
					sourcePath: ui ? svelteModelPath(name) : "",
					reveal: ui
				}
			};
			if (dryRun) {
				result.wouldImport = shouldImport && templateUrl.length > 0;
				result.wouldCreate = shouldImport && templateUrl.length === 0;
				if (result.wouldCreate) {
					result.corsOrigin = corsOrigin;
					if (corsOriginWarning(corsOrigin)) {
						result.warnings = [corsOriginWarning(corsOrigin)];
					}
				}
				result.wouldCustomize = true;
				result.wouldReference = references.slice();
				result.next = "Review this plan, then call flow-project-bootstrap once with dryRun:false.";
				ctx.write(prop(props, "out") || "local.projectBootstrap", result);
				return result;
			}
			var project = !shouldImport ? existing
				: templateUrl.length ? importTemplate(engine, name, templateUrl) : createProject(engine, name, existing, corsOrigin);
			result.imported = shouldImport && templateUrl.length > 0;
			result.created = shouldImport && templateUrl.length === 0;
			if (result.created) {
				result.corsOrigin = corsOrigin;
				var corsWarning = corsOriginWarning(corsOrigin);
				if (corsWarning) {
					result.warnings = [corsWarning];
				}
			}
			var resourceRoot = svelteResourceRoot();
			var model = ui ? ensureSvelteModel(ctx, project, name) : { path: "", file: "", created: false, exists: false };
			var flow = ensureFlowEngine(ctx, project, ui, resourceRoot, model.path);
			result.createdFlowEngine = flow.created;
			if (flow.merge) {
				result.configAdded = flow.merge.source !== null ? flow.merge.added : [];
				var configWarnings = [];
				if (flow.merge.source === null) {
					configWarnings.push({ code: "CONFIG_NOT_MERGED", message: "_flow/engine.yaml was kept unchanged: its layout could not take " +
						flow.merge.added.join(", ") + " without touching the existing configuration. Add these keys to it yourself." });
				}
				if (flow.merge.kept.length) {
					configWarnings.push({ code: "CONFIG_KEPT", message: "The existing configuration was kept for " + flow.merge.kept.join(", ") +
						" (the bootstrap default differs)." });
				}
				if (configWarnings.length) {
					result.warnings = (result.warnings || []).concat(configWarnings);
				}
			}
			if (flow.written && (!flow.merge || flow.merge.added.indexOf("config.demo") !== -1 || flow.merge.added.indexOf("config.demo.login") !== -1 ||
					flow.merge.added.indexOf("config") !== -1)) {
				result.demoLogin = {
					config: "demo.login",
					symbol: name + ".demo.login",
					value: false,
					note: "Off by default. A sign-in Flow without password (demo accounts) must refuse unless String(config.demo.login) === \"true\"; " +
						"set the global symbol " + name + ".demo.login to true only on a demo server or the Studio. See flow://guide/start; authentication mode does not change the entity data route."
				};
			}
			result.configuredSvelte = flow.configuredSvelte;
			result.engineQName = String(flow.flowEngine.getEngineQName());
			if (ui) {
				result.frontbuilderReference = ensureFrontbuilderReference(engine, project);
				result.frontbuilderResourceRoot = resourceRoot;
				result.frontbuilderModelPath = model.path;
				result.frontbuilderModelFile = model.file;
				result.frontbuilderModelRevision = model.revision;
				result.createdSvelteModel = model.created;
			}
			result.projectReferences = references.map(function (referenceName) {
				if (referenceName === name) {
					throw new Error("A project cannot reference itself: " + name);
				}
				if (resolveProject(engine, referenceName, project) == null) {
					throw new Error("Unable to resolve referenced Convertigo project: " + referenceName +
						". Checked workspace roots: " + lastWorkspaceRoots.join(", "));
				}
				engine.theApp.referencedProjectManager.getReferenceFromProject(project, referenceName);
				return referenceName;
			});
			engine.theApp.databaseObjectsManager.exportProject(project);
			result.saved = true;
			result.projectDir = String(project.getDirPath());
			result.next = "Project is ready. Continue with project configuration or code-set; do not call flow-project-bootstrap again." +
				(ui && model.revision ? " The home Page " + model.path + " exists already: its first code-set passes revision " +
					model.revision + " (frontbuilderModelRevision)." : "");
			refreshStudio(engine, project, ui ? model.path : "");
			ctx.write(prop(props, "out") || "local.projectBootstrap", result);
			return result;
		}
	};
}())
