const _meta = {
  "version": 1,
  "description": "Resolves a workspace Convertigo project and adds its reference through DBO APIs.",
  "icon": "mdi:source-branch",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Convertigo project that receives the reference."
    },
    "reference": {
      "kind": "text",
      "type": "string",
      "description": "Workspace Convertigo project to resolve and reference."
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Preview the reference change without saving."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.projectReference",
      "description": "Scope path receiving the reference result."
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": { "type": "boolean" },
        "project": { "type": "string" },
        "reference": { "type": "string" },
        "created": { "type": "boolean" },
        "saved": { "type": "boolean" }
      }
    }
  },
  "runtime": "rhino"
}

(function () {
	var lastWorkspaceRoots = [];
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function projectName(value) {
		var name = String(value || "").trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
			throw new Error("Invalid Convertigo project name: " + name);
		}
		return name;
	}

	function boolValue(value) {
		return value === true || String(value || "").toLowerCase() === "true";
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
				if (definition.isFile() && projectNameFromFile(definition) === name) {
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

	function hasReference(project, referenceName) {
		var ProjectSchemaReference = Packages.com.twinsoft.convertigo.beans.references.ProjectSchemaReference;
		var iterator = project.getReferenceList().iterator();
		while (iterator.hasNext()) {
			var reference = iterator.next();
			if (reference instanceof ProjectSchemaReference &&
					String(reference.getParser().getProjectName()) === referenceName) {
				return true;
			}
		}
		return false;
	}

	function refreshStudio(engine, project) {
		try {
			engine.theApp.schemaManager.clearCache(String(project.getName()));
		} catch (_ignoreSchemaCache) {
		}
		try {
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
					var treeObject = view == null ? null : view.findTreeObjectByUserObject(project);
					if (treeObject != null) {
						view.reloadTreeObject(treeObject);
					} else if (view != null) {
						view.refreshProjects();
					}
				} catch (e) {
					ConvertigoPlugin.logException(e, "Unable to refresh Project Explorer after Flow project reference", false);
				}
			}}));
		} catch (_ignoreStudioRefresh) {
		}
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var projectNameValue = projectName(prop(props, "project"));
			var referenceName = projectName(prop(props, "reference"));
			var dryRun = boolValue(prop(props, "dryRun"));
			if (projectNameValue === referenceName) {
				throw new Error("A project cannot reference itself: " + projectNameValue);
			}
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var project = resolveProject(Engine, projectNameValue, null);
			var referencedProject = resolveProject(Engine, referenceName, project);
			if (project == null) {
				throw new Error("Unable to resolve Convertigo project: " + projectNameValue);
			}
			if (referencedProject == null) {
				throw new Error("Unable to resolve referenced Convertigo project: " + referenceName +
					". Checked workspace roots: " + lastWorkspaceRoots.join(", "));
			}
			var exists = hasReference(project, referenceName);
			var response = {
				ok: true,
				project: projectNameValue,
				reference: referenceName,
				dryRun: dryRun,
				created: !exists,
				saved: false
			};
			if (!dryRun && !exists) {
				Engine.theApp.referencedProjectManager.getReferenceFromProject(project, referenceName);
				Engine.theApp.databaseObjectsManager.exportProject(project);
				response.saved = true;
				refreshStudio(Engine, project);
			}
			ctx.write(prop(props, "out") || "local.projectReference", response);
			return response;
		}
	};
}())
