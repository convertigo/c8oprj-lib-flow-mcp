const _meta = {
  "version": 1,
  "private": true,
  "description": "Removes a project reference created by an unsuccessful atomic provider insertion.",
  "icon": "mdi:source-branch-remove",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Convertigo project that received the reference."
    },
    "reference": {
      "kind": "text",
      "type": "string",
      "description": "Referenced project to remove."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.projectReferenceRollback"
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": { "type": "boolean" },
        "project": { "type": "string" },
        "reference": { "type": "string" },
        "removed": { "type": "boolean" },
        "saved": { "type": "boolean" }
      }
    }
  },
  "runtime": "rhino"
}

// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html
(function () {
	function projectName(value) {
		var name = String(value || "").trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
			throw new Error("Invalid Convertigo project name: " + name);
		}
		return name;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var projectNameValue = projectName(props.project);
			var referenceName = projectName(props.reference);
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var ProjectSchemaReference = Packages.com.twinsoft.convertigo.beans.references.ProjectSchemaReference;
			var project = Engine.theApp.databaseObjectsManager.getOriginalProjectByName(projectNameValue, false);
			if (project == null) {
				throw new Error("Unable to resolve Convertigo project: " + projectNameValue);
			}
			var target = null;
			var references = project.getReferenceList().iterator();
			while (references.hasNext()) {
				var reference = references.next();
				if (reference instanceof ProjectSchemaReference &&
						String(reference.getParser().getProjectName()) === referenceName) {
					target = reference;
					break;
				}
			}
			var response = {
				ok: true,
				project: projectNameValue,
				reference: referenceName,
				removed: target != null,
				saved: false
			};
			if (target != null) {
				project.remove(target);
				project.hasChanged = true;
				project.changed();
				Engine.theApp.databaseObjectsManager.exportProject(project);
				Engine.theApp.schemaManager.clearCache(projectNameValue);
				response.saved = true;
			}
			ctx.write(props.out || "local.projectReferenceRollback", response);
			return response;
		}
	};
}())
