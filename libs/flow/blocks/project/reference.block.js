const _meta = {
  "version": 1,
  "description": "Adds a loaded Convertigo project reference through DBO APIs.",
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
      "description": "Loaded Convertigo project to reference."
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

	function loadedProject(engine, name) {
		try {
			return engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(name), false);
		} catch (_ignoreMissing) {
			return null;
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
			var project = loadedProject(Engine, projectNameValue);
			var referencedProject = loadedProject(Engine, referenceName);
			if (project == null) {
				throw new Error("Convertigo project is not loaded: " + projectNameValue);
			}
			if (referencedProject == null) {
				throw new Error("Referenced Convertigo project is not loaded: " + referenceName);
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
