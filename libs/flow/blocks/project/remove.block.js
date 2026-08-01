const _meta = {
  "version": 1,
  "description": "Safely unloads a Convertigo project from Studio or removes its workspace content after explicit checks.",
  "icon": "mdi:folder-remove-outline",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Loaded Convertigo project name to unload or remove."
    },
    "action": {
      "kind": "literal",
      "type": "string",
      "enum": ["unload", "delete"],
      "default": "unload",
      "description": "Unload keeps project files; delete also removes the Eclipse project content from disk."
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "default": true,
      "description": "Inspect safety blockers without changing Studio or project files."
    },
    "force": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Bypass dirty, linked, Git and incoming-reference protections. Use only after reviewing dryRun."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.projectRemoval",
      "description": "Scope path receiving the removal plan or result."
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": { "type": "boolean" },
        "project": { "type": "string" },
        "action": { "type": "string" },
        "dryRun": { "type": "boolean" },
        "safe": { "type": "boolean" },
        "blockers": { "type": "array", "items": { "type": "object" } },
        "referencedBy": { "type": "array", "items": { "type": "string" } }
      }
    }
  },
  "runtime": "rhino"
}

(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function boolValue(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		return value === true || String(value).toLowerCase() === "true";
	}

	function projectName(value) {
		var name = String(value || "").trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
			throw new Error("Invalid Convertigo project name: " + name);
		}
		return name;
	}

	function actionValue(value) {
		var action = String(value || "unload").trim().toLowerCase();
		if (action !== "unload" && action !== "delete") {
			throw new Error("Unsupported project removal action: " + action);
		}
		return action;
	}

	function loadedProject(engine, name) {
		try {
			var manager = engine.theApp.databaseObjectsManager;
			var project = manager.getLoadedProjectByName(String(name));
			return project != null ? project : manager.getOriginalProjectByName(String(name), false);
		} catch (_ignoreMissing) {
			return null;
		}
	}

	function addUnique(values, value) {
		value = String(value || "");
		if (value && values.indexOf(value) === -1) {
			values.push(value);
		}
	}

	function referencedProjectNames(project) {
		var names = [];
		if (project == null) {
			return names;
		}
		var ProjectSchemaReference = Packages.com.twinsoft.convertigo.beans.references.ProjectSchemaReference;
		var iterator = project.getReferenceList().iterator();
		while (iterator.hasNext()) {
			var reference = iterator.next();
			if (reference instanceof ProjectSchemaReference) {
				addUnique(names, reference.getParser().getProjectName());
			}
		}
		return names;
	}

	function definitionReferences(engine, ownerName, targetName) {
		var FileUtils = Packages.org.apache.commons.io.FileUtils;
		var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
		var ProjectUrlParser = Packages.com.twinsoft.convertigo.engine.util.ProjectUrlParser;
		var definition = engine.projectYamlFile(String(ownerName));
		if (definition == null || !definition.isFile()) {
			definition = engine.projectFile(String(ownerName));
		}
		if (definition == null || !definition.isFile()) {
			return { found: false, readable: false };
		}
		try {
			var source = String(FileUtils.readFileToString(definition, StandardCharsets.UTF_8));
			var patterns = [
				/^\s*projectName:\s*["']?([^\s"'#]+)["']?\s*(?:#.*)?$/gm,
				/<property\s+name=["']projectName["'][^>]*>\s*<java\.lang\.String[^>]*value=["']([^"']+)["']/g
			];
			for (var p = 0; p < patterns.length; p++) {
				var match;
				while ((match = patterns[p].exec(source)) !== null) {
					var parser = new ProjectUrlParser(String(match[1]));
					if (String(parser.getProjectName()) === targetName) {
						return { found: true, readable: true };
					}
				}
			}
			return { found: false, readable: true };
		} catch (_readFailure) {
			return { found: false, readable: false };
		}
	}

	function incomingReferences(engine, targetName) {
		var databaseObjectsManager = engine.theApp.databaseObjectsManager;
		var referencedBy = [];
		var unreadable = [];
		var names = databaseObjectsManager.getAllProjectNamesList(false).iterator();
		while (names.hasNext()) {
			var ownerName = String(names.next());
			if (ownerName === targetName) {
				continue;
			}
			var owner = loadedProject(engine, ownerName);
			if (owner != null && referencedProjectNames(owner).indexOf(targetName) !== -1) {
				addUnique(referencedBy, ownerName);
				continue;
			}
			var definition = definitionReferences(engine, ownerName, targetName);
			if (definition.found) {
				addUnique(referencedBy, ownerName);
			} else if (!definition.readable) {
				addUnique(unreadable, ownerName);
			}
		}
		referencedBy.sort();
		unreadable.sort();
		return { referencedBy: referencedBy, unreadable: unreadable };
	}

	function storageInfo(engine, project, name) {
		var Files = Packages.java.nio.file.Files;
		var Paths = Packages.java.nio.file.Paths;
		var projectPath = Paths.get(String(engine.projectDir(String(name))));
		var workspaceEntry = Paths.get(String(engine.PROJECTS_PATH), String(name));
		var linked = Files.isSymbolicLink(projectPath) || Files.isSymbolicLink(workspaceEntry) ||
			Files.isRegularFile(workspaceEntry);
		var realPath = projectPath;
		try {
			realPath = projectPath.toRealPath();
		} catch (_ignoreRealPath) {
		}
		var git = Files.exists(realPath.resolve(".git"));
		return {
			directory: String(projectPath.toAbsolutePath()),
			realDirectory: String(realPath.toAbsolutePath()),
			linked: linked,
			git: git
		};
	}

	function blocker(code, message) {
		return { code: code, message: message };
	}

	function inspect(engine, project, name, action) {
		var storage = storageInfo(engine, project, name);
		var references = incomingReferences(engine, name);
		var blockers = [];
		if (name === "lib_flow_mcp") {
			blockers.push(blocker("ACTIVE_MCP_PROJECT", "The MCP host project cannot remove itself."));
		}
		if (project.hasChanged === true) {
			blockers.push(blocker("UNSAVED_PROJECT", "The loaded project has unsaved DatabaseObject changes."));
		}
		if (references.referencedBy.length > 0) {
			blockers.push(blocker("PROJECT_REFERENCED", "Other projects still reference this project."));
		}
		if (references.unreadable.length > 0) {
			blockers.push(blocker("REFERENCE_SCAN_INCOMPLETE", "Some workspace project definitions could not be inspected."));
		}
		if (action === "delete" && storage.linked) {
			blockers.push(blocker("LINKED_PROJECT", "The project is linked outside the regular Studio workspace."));
		}
		if (action === "delete" && storage.git) {
			blockers.push(blocker("VERSIONED_PROJECT", "The project directory contains Git metadata."));
		}
		return {
			storage: storage,
			referencedBy: references.referencedBy,
			unreadableProjects: references.unreadable,
			blockers: blockers
		};
	}

	function removeStudioTreeNode(engine, project) {
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
			ConvertigoPlugin.syncExec(new Runnable({ run: function () {
				try {
					var view = plugin.getProjectExplorerView();
					if (view != null) {
						var treeObject = view.findTreeObjectByUserObject(project);
						if (treeObject != null) {
							view.removeProjectTreeObject(treeObject);
							var TreeObjectEvent = Packages.com.twinsoft.convertigo.eclipse.views.projectexplorer.TreeObjectEvent;
							view.fireTreeObjectRemoved(new TreeObjectEvent(treeObject));
						}
					}
				} catch (e) {
					ConvertigoPlugin.logException(e, "Unable to reconcile Project Explorer after Flow project removal", false);
				}
			}}));
		} catch (_ignoreStudioReconcile) {
		}
	}

	function remove(engine, project, name, action) {
		var databaseObjectsManager = engine.theApp.databaseObjectsManager;
		var DeleteProjectOption = Packages.com.twinsoft.convertigo.engine.enums.DeleteProjectOption;
		if (engine.isStudioMode() === true) {
			if (action === "delete") {
				databaseObjectsManager.deleteProjectAndCar(name, DeleteProjectOption.unloadOnly);
			} else {
				databaseObjectsManager.deleteProject(name, DeleteProjectOption.unloadOnly);
			}
			var ConvertigoPlugin = Packages.com.twinsoft.convertigo.eclipse.ConvertigoPlugin;
			var plugin = ConvertigoPlugin.getDefault();
			if (plugin == null) {
				throw new Error("Convertigo Studio plugin is unavailable for project removal.");
			}
			plugin.deleteProjectPluginResource(action === "delete", name);
			removeStudioTreeNode(engine, project);
			return;
		}
		if (action === "delete") {
			databaseObjectsManager.deleteProjectAndCar(name);
		} else {
			databaseObjectsManager.deleteProject(name, DeleteProjectOption.unloadOnly);
		}
	}

	return {
		inspect: inspect,
		run: function (ctx, node) {
			var props = ctx.props(node);
			var name = projectName(prop(props, "project"));
			var action = actionValue(prop(props, "action"));
			var dryRun = boolValue(prop(props, "dryRun"), true);
			var force = boolValue(prop(props, "force"), false);
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var project = loadedProject(Engine, name);
			if (project == null) {
				throw new Error("Convertigo project is not loaded: " + name);
			}
			var inspection = inspect(Engine, project, name, action);
			var response = {
				ok: true,
				project: name,
				action: action,
				dryRun: dryRun,
				force: force,
				loaded: true,
				directory: inspection.storage.directory,
				realDirectory: inspection.storage.realDirectory,
				linked: inspection.storage.linked,
				git: inspection.storage.git,
				referencedBy: inspection.referencedBy,
				unreadableProjects: inspection.unreadableProjects,
				blockers: inspection.blockers,
				safe: inspection.blockers.length === 0,
				removed: false
			};
			if (dryRun) {
				response.next = response.safe
					? "Review this plan, then repeat with dryRun:false."
					: "Resolve blockers before removing the project; force:true bypasses them except the active MCP project.";
				ctx.write(prop(props, "out") || "local.projectRemoval", response);
				return response;
			}
			var hardBlocker = inspection.blockers.some(function (entry) {
				return entry.code === "ACTIVE_MCP_PROJECT";
			});
			if (hardBlocker || inspection.blockers.length > 0 && !force) {
				throw new Error("Project removal blocked: " + JSON.stringify(response));
			}
			remove(Engine, project, name, action);
			response.removed = true;
			response.safe = true;
			response.next = action === "delete"
				? "Project content was removed from the Studio workspace."
				: "Project was unloaded from Studio; its files remain on disk.";
			ctx.write(prop(props, "out") || "local.projectRemoval", response);
			return response;
		}
	};
}())
