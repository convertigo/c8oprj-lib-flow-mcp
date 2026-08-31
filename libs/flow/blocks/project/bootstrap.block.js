const _meta = {
  "version": 1,
  "description": "Bootstraps a Convertigo project for Flow authoring from the official sequence template, then adds FlowEngine metadata through DBO APIs.",
  "icon": "mdi:application-import",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Convertigo project name to create or customize."
    },
    "templateUrl": {
      "kind": "text",
      "type": "string",
      "default": "https://github.com/convertigo/c8oprj-template-sequence/archive/8.3.0.zip",
      "description": "Template archive URL used when the project does not exist or force=true."
    },
    "ui": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Also configure the experimental Svelte frontbuilder."
    },
    "references": {
      "kind": "literal",
      "type": "array",
      "items": { "type": "string" },
      "default": [],
      "description": "Existing Convertigo projects to reference after bootstrap."
    },
    "force": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Re-import the template even if the project already exists."
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Preview the bootstrap without importing or saving."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.projectBootstrap",
      "description": "Scope path receiving the bootstrap result."
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": { "type": "boolean" },
        "project": { "type": "string" },
        "imported": { "type": "boolean" },
        "createdFlowEngine": { "type": "boolean" },
        "configuredSvelte": { "type": "boolean" },
        "studioTarget": {
          "type": "object",
          "properties": {
            "project": { "type": "string" },
            "nodeId": { "type": "string" },
            "sourcePath": { "type": "string" },
            "reveal": { "type": "boolean" }
          }
        }
      }
    }
  },
  "runtime": "rhino"
}

(function () {
	var TEMPLATE_URL = "https://github.com/convertigo/c8oprj-template-sequence/archive/8.3.0.zip";
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

	function engineSource(ui, resourceRoot, modelPath) {
		if (!ui) {
			return [
				"version: 1",
				"engineQName: " + ENGINE_QNAME,
				"bindings: {}",
				"config: {}",
				""
			].join("\n");
		}
		return [
			"version: 1",
			"engineQName: " + ENGINE_QNAME,
			"bindings: {}",
			"config:",
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
		].join("\n");
	}

	function jsString(value) {
		return JSON.stringify(String(value || ""));
	}

	function svelteModelPath(name) {
		return "libs/flow/frontbuilder/svelte/model/" + name + "/src/routes/+page.flow.svelte";
	}

	function ensureParent(file) {
		Packages.java.nio.file.Files.createDirectories(file.getParentFile().toPath());
	}

	function writeUtf8(file, content) {
		var Files = Packages.java.nio.file.Files;
		var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
		Files.write(file.toPath(), new Packages.java.lang.String(String(content)).getBytes(StandardCharsets.UTF_8));
	}

	function initialSveltePage(name) {
		return [
			"<script module>",
			"  export const _flow = {",
			"    page: {",
			"      id: \"home\",",
			"      route: \"/\",",
			"      title: " + jsString(name),
			"    }",
			"  };",
			"</script>",
			"",
			"<FlowComponent id=\"home\" label=" + jsString(name) + ">",
			"  <Structure>",
			"    <PageShell id=\"pageShell\" maxWidth=\"960px\" padding=\"24px\" gap=\"16px\" align=\"stretch\">",
			"      <Children>",
			"        <Card id=\"welcomeCard\" padding=\"20px\" radius=\"8px\" variant=\"surface\">",
			"          <Children>",
			"            <Text id=\"welcomeTitle\" text=" + jsString(name) + " />",
			"            <Text id=\"welcomeText\" text=\"Flow Svelte frontend is ready.\" />",
			"          </Children>",
			"        </Card>",
			"      </Children>",
			"    </PageShell>",
			"  </Structure>",
			"</FlowComponent>",
			""
		].join("\n");
	}

	function ensureSvelteModel(project, name) {
		var File = Packages.java.io.File;
		var relative = svelteModelPath(name);
		var file = new File(String(project.getDirPath()), relative);
		var created = false;
		if (!file.isFile()) {
			ensureParent(file);
			writeUtf8(file, initialSveltePage(name));
			created = true;
		}
		return {
			path: relative,
			file: String(file.getAbsolutePath()),
			created: created,
			exists: file.isFile()
		};
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
			var FileUtils = Packages.org.apache.commons.io.FileUtils;
			var source = String(FileUtils.readFileToString(file, "UTF-8"));
			var lines = source.split(/\r?\n/);
			for (var i = 0; i < lines.length; i++) {
				var match = /^↓([^\s\[]+) \[core\.Project\]: $/.exec(lines[i]);
				if (match) {
					return String(match[1]);
				}
			}
			return "";
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
		return "libs/flow/frontbuilder/svelte";
	}

	function ensureFrontbuilderReference(engine, project) {
		try {
			engine.theApp.referencedProjectManager.getReferenceFromProject(project, FRONTBUILDER_PROJECT);
			return true;
		} catch (_ignoreReference) {
			return false;
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
		return project;
	}

	function ensureFlowEngine(project, ui, resourceRoot, modelPath) {
		var FlowEngine = Packages.com.twinsoft.convertigo.beans.flow.FlowEngine;
		var flowEngine = project.getFlowEngine();
		var created = false;
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
		if (created || source.trim() === "" || ui && (!hasFrontend || !sourceModelExists)) {
			flowEngine.setEngineSource(engineSource(ui, resourceRoot, modelPath));
		}
		project.hasChanged = true;
		return {
			flowEngine: flowEngine,
			created: created,
			configuredSvelte: ui
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
			var templateUrl = String(prop(props, "templateUrl") || TEMPLATE_URL).trim();
			var ui = boolValue(prop(props, "ui"), false);
			var references = projectNames(prop(props, "references"));
			var force = boolValue(prop(props, "force"), false);
			var dryRun = boolValue(prop(props, "dryRun"), false);
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
				result.wouldImport = shouldImport;
				result.wouldCustomize = true;
				result.wouldReference = references.slice();
				result.next = "Review this plan, then call flow-project-bootstrap once with dryRun:false.";
				ctx.write(prop(props, "out") || "local.projectBootstrap", result);
				return result;
			}
			var project = shouldImport ? importTemplate(engine, name, templateUrl) : existing;
			result.imported = shouldImport;
			var resourceRoot = svelteResourceRoot();
			var model = ui ? ensureSvelteModel(project, name) : { path: "", file: "", created: false, exists: false };
			var flow = ensureFlowEngine(project, ui, resourceRoot, model.path);
			result.createdFlowEngine = flow.created;
			result.configuredSvelte = flow.configuredSvelte;
			result.engineQName = String(flow.flowEngine.getEngineQName());
			if (ui) {
				result.frontbuilderReference = ensureFrontbuilderReference(engine, project);
				result.frontbuilderResourceRoot = resourceRoot;
				result.frontbuilderModelPath = model.path;
				result.frontbuilderModelFile = model.file;
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
			result.next = "Project is ready. Continue with project configuration or code-set; do not call flow-project-bootstrap again.";
			refreshStudio(engine, project, ui ? model.path : "");
			ctx.write(prop(props, "out") || "local.projectBootstrap", result);
			return result;
		}
	};
}())
