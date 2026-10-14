const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Reads or sets the version and the description of a project, as its Properties in the Studio.",
  "icon": "mdi:tag-text-outline",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Loaded Convertigo project whose metadata is read or set.",
    },
    "version": {
      "kind": "text",
      "type": "string",
      "description": "New version of the project, as 1.2.0; omitted, the version is kept.",
    },
    "description": {
      "kind": "text",
      "type": "string",
      "description": "New description of the project, its comment in the Studio and the console; omitted, it is kept.",
    },
    "saveProject": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Saves the project at once; refused while it holds unsaved Studio work. Otherwise the Save of the project writes the change.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.projectMetadata",
      "description": "Scope path receiving the metadata of the project.",
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
        "version": {
          "type": "string",
        },
        "description": {
          "type": "string",
        },
        "changed": {
          "type": "array",
          "items": {
            "type": "string",
          },
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
	var MAX_VERSION = 64;
	var MAX_DESCRIPTION = 4000;

	function boolValue(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		return value === true || String(value).toLowerCase() === "true";
	}
	function fail(code, message, hint) {
		var error = new Error(message);
		error.code = code;
		if (hint) {
			error.hint = hint;
		}
		throw error;
	}
	// a value the call gives, else undefined: an omitted property keeps the metadata
	function given(value) {
		return value === undefined || value === null ? undefined : String(value);
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var projectName = String(props.project || "").trim();
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(projectName)) {
				fail("PROJECT_REQUIRED", "flow-project-metadata requires the name of a loaded project.");
			}
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var project = Engine.theApp.databaseObjectsManager.getOriginalProjectByName(projectName, false);
			if (project == null) {
				fail("UNKNOWN_PROJECT", "Unknown or unloaded project: " + projectName);
			}
			var version = given(props.version);
			if (version !== undefined) {
				version = version.trim();
				if (!version.length || version.length > MAX_VERSION || /[\r\n]/.test(version)) {
					fail("INVALID_VERSION", "The version must be one line of 1 to " + MAX_VERSION + " characters.", "As 1.2.0.");
				}
			}
			var description = given(props.description);
			if (description !== undefined && description.length > MAX_DESCRIPTION) {
				fail("INVALID_DESCRIPTION", "The description must have at most " + MAX_DESCRIPTION + " characters.");
			}
			var changes = [];
			if (version !== undefined && version !== String(project.getVersion() || "")) {
				changes.push("version");
			}
			if (description !== undefined && description !== String(project.getComment() || "")) {
				changes.push("description");
			}
			// checked before the change, which is unsaved work of the project too
			var saveProject = changes.length > 0 && boolValue(props.saveProject, false) &&
				mcp.assertProjectSaveAllowed({ project: projectName, saveProject: true }, "");
			if (changes.indexOf("version") !== -1) {
				project.setVersion(version);
			}
			if (changes.indexOf("description") !== -1) {
				project.setComment(description);
			}
			if (changes.length) {
				mcp.withProjectFlagLock(project, function () {
					project.changed();
				});
			}
			if (saveProject) {
				Engine.theApp.databaseObjectsManager.exportProject(project);
			}
			var result = {
				ok: true,
				project: projectName,
				version: String(project.getVersion() || ""),
				description: String(project.getComment() || ""),
				changed: changes,
				saved: saveProject === true
			};
			result.next = !changes.length ? (version === undefined && description === undefined
				? "Pass version and/or description to set them."
				: "Nothing changed: the project already has these metadata.")
				: result.saved ? "Set and saved."
				: "Set in the loaded project; the Save of the project writes it, or pass saveProject:true.";
			ctx.write(props.out || "local.projectMetadata", result);
			return result;
		}
	};
}())
