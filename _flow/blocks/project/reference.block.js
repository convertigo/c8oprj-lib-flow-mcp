const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Resolves a workspace Convertigo project and adds its reference through DBO APIs, or sets the Git URL another workspace imports it from.",
  "icon": "mdi:source-branch",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Convertigo project that receives the reference.",
    },
    "reference": {
      "kind": "text",
      "type": "string",
      "description": "Workspace Convertigo project to resolve and reference.",
    },
    "url": {
      "kind": "text",
      "type": "string",
      "description": "Git URL of the referenced project (https://host/org/repo.git or git@host:org/repo.git) or URL of its .zip/.car archive, which another workspace imports it from; sets or updates the URL of an existing reference.",
    },
    "branch": {
      "kind": "text",
      "type": "string",
      "description": "Git branch of the referenced project, with url; an empty value removes it.",
    },
    "path": {
      "kind": "text",
      "type": "string",
      "description": "Folder of the project in its Git repository when it is not the root, with url; an empty value removes it.",
    },
    "autoPull": {
      "kind": "literal",
      "type": "boolean",
      "description": "Pulls the Git repository of the referenced project when the project loads, with url.",
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Preview the reference change without saving.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.projectReference",
      "description": "Scope path receiving the reference result.",
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
        "reference": {
          "type": "string",
        },
        "url": {
          "type": "string",
        },
        "previousUrl": {
          "type": "string",
        },
        "created": {
          "type": "boolean",
        },
        "updated": {
          "type": "boolean",
        },
        "saved": {
          "type": "boolean",
        },
      },
    },
  },
  "runtime": "rhino",
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

	function projectReference(project, referenceName) {
		var ProjectSchemaReference = Packages.com.twinsoft.convertigo.beans.references.ProjectSchemaReference;
		var iterator = project.getReferenceList().iterator();
		while (iterator.hasNext()) {
			var reference = iterator.next();
			if (reference instanceof ProjectSchemaReference &&
					String(reference.getParser().getProjectName()) === referenceName) {
				return reference;
			}
		}
		return null;
	}

	function fail(code, message, hint) {
		var error = new Error(message);
		error.code = code;
		if (hint) {
			error.hint = hint;
		}
		throw error;
	}

	// The project URL of the reference, "name=url:path=...:branch=...:autoPull=true" as Convertigo writes it, from the
	// current one and the given url, branch, path and autoPull; null when none of them is given
	function referenceUrl(referenceName, current, props) {
		var keys = ["url", "branch", "path", "autoPull"].filter(function (key) {
			var value = prop(props, key);
			return value !== undefined && value !== null;
		});
		if (!keys.length) {
			return null;
		}
		var ProjectUrlParser = Packages.com.twinsoft.convertigo.engine.util.ProjectUrlParser;
		var parser = new ProjectUrlParser(String(current || referenceName));
		var url = prop(props, "url");
		if (url !== undefined && url !== null) {
			url = String(url).trim();
			if (url.indexOf(referenceName + "=") === 0) {
				parser.setUrl(url);
			} else {
				parser.setGitUrl(url);
			}
		}
		if (keys.indexOf("branch") !== -1) {
			parser.setGitBranch(String(prop(props, "branch")).trim());
		}
		if (keys.indexOf("path") !== -1) {
			parser.setProjectPath(String(prop(props, "path")).trim());
		}
		if (keys.indexOf("autoPull") !== -1) {
			parser.setAutoPull(boolValue(prop(props, "autoPull")));
		}
		if (String(parser.getProjectName()) !== referenceName) {
			fail("INVALID_REFERENCE_URL", "The URL names the project " + parser.getProjectName() + ", not " + referenceName + ".");
		}
		if (parser.getGitUrl() == null) {
			fail("INVALID_REFERENCE_URL", "The reference of " + referenceName + " has no Git or archive URL: " + String(url || current || ""),
				"A Git URL ends with .git (https://github.com/org/repo.git, git@github.com:org/repo.git); an archive URL ends with .zip or .car.");
		}
		return String(parser.getProjectUrl());
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
			var checked=ctx.nativePropertyContract().properties(ctx.props(node),{autoPull:{type:"boolean"},dryRun:{type:"boolean"},
				url:{type:"string",trim:true},branch:{type:"string",trim:true},path:{type:"string",trim:true}},"");
			var props = checked.value;
			var contract=ctx.nativePropertyContract();
			["branch","path"].forEach(function(key){
				if(props[key]!==undefined && props[key].indexOf(":")>=0)contract.invalid(key,props[key],"a Git branch or project folder without a ':' option separator");
			});
			if(props.url!==undefined){
				var seen=false;
				props.url=props.url.replace(/:autoPull=([^:]*)/g,function(token,value){
					if(seen)contract.invalid("url.autoPull",props.url,"one autoPull option");
					seen=true;
					var valueCheck=contract.scalar(value,{type:"boolean"},"url.autoPull");
					checked.normalizations=checked.normalizations.concat(valueCheck.normalizations);
					return ":autoPull="+String(valueCheck.value);
				});
			}
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
			var existing = projectReference(project, referenceName);
			var currentUrl = existing == null ? "" : String(existing.getProjectName());
			var url = referenceUrl(referenceName, currentUrl, props);
			var updated = existing != null && url !== null && url !== currentUrl;
			var response = {
				normalizations: checked.normalizations,
				ok: true,
				project: projectNameValue,
				reference: referenceName,
				url: url !== null ? url : currentUrl || referenceName,
				dryRun: dryRun,
				created: existing == null,
				updated: updated,
				saved: false
			};
			if (updated) {
				response.previousUrl = currentUrl;
			}
			if (!dryRun && (existing == null || updated)) {
				// the save writes the whole project: refused while it holds unsaved Studio work
				ctx.lib("mcp").assertProjectSaveAllowed({ project: projectNameValue, saveProject: true }, "");
				var reference = existing || Engine.theApp.referencedProjectManager.getReferenceFromProject(project, referenceName);
				if (url !== null && url !== String(reference.getProjectName())) {
					reference.setProjectName(url);
					reference.hasChanged = true;
					project.hasChanged = true;
				}
				response.url = String(reference.getProjectName());
				Engine.theApp.databaseObjectsManager.exportProject(project);
				response.saved = true;
				refreshStudio(Engine, project);
			}
			ctx.write(prop(props, "out") || "local.projectReference", response);
			return response;
		}
	};
}())
