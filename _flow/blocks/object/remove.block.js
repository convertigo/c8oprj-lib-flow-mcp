const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Deletes one object of a project as the Studio Delete does: a Flow with its source and learned schemas, a connector, a transaction, a sequence or a Flow item; or the sources a Flow the project no longer has left.",
  "icon": "mdi:delete-outline",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Loaded Convertigo project that owns the object.",
    },
    "qname": {
      "kind": "text",
      "type": "string",
      "description": "QName of the object, as the Studio and the code tools name it: project.Flow, project.Connector, project.Connector.Transaction, or the qualified id of a Flow item. project.Flow also names the sources of a Flow the project no longer has.",
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "default": true,
      "description": "Tells what the deletion removes (folders, database, Flow sources) without changing anything.",
    },
    "folders": {
      "kind": "literal",
      "type": "array",
      "items": {
        "type": "string",
      },
      "default": [],
      "description": "Folders to remove too, chosen among the folders the dry run returned.",
    },
    "dropDatabase": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Also drops the CouchDB database of a FullSync connector, as returned by the dry run.",
    },
    "saveProject": {
      "kind": "literal",
      "type": "boolean",
      "default": true,
      "description": "Saves the project with the deletion, so that the files match the loaded project; refused, before any change, while the project holds unsaved Studio work. false leaves the deletion for the next Save of the project, as the Studio Delete does.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.objectRemoval",
      "description": "Scope path receiving the deletion plan or result.",
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
        "qname": {
          "type": "string",
        },
        "type": {
          "type": "string",
        },
        "dryRun": {
          "type": "boolean",
        },
        "removes": {
          "type": "object",
        },
        "done": {
          "type": "boolean",
        },
        "saved": {
          "type": "boolean",
        },
        "unsavedChanges": {
          "type": "array",
          "items": {
            "type": "string",
          },
        },
      },
    },
  },
  "runtime": "rhino",
}

(function () {
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
	function jsonValue(value) {
		return value == null ? {} : JSON.parse(String(value.toString()));
	}
	/**
	 * Everything a deletion would lose or a Save would write along with it: objects edited in the Studio,
	 * Flow working copies (the deleted Flow's own included) and Flow engine source drafts.
	 */
	function unsavedWork(mcp, project, exceptQName) {
		return mcp.unsavedProjectChanges(project, exceptQName).concat(
			typeof mcp.pendingStudioDrafts === "function" ? mcp.pendingStudioDrafts(project, "") : []);
	}
	function flowDraftDirty(dbo) {
		try {
			return dbo.isFlowSourceDirty() === true;
		} catch (_noWorkingCopy) {
			return false;
		}
	}

	/**
	 * The sources of a Flow the project no longer has, as a Flow deleted by an older Studio left them: its
	 * FlowScript and its learned schemas go as the sources of a deleted Flow, at the Save of the project.
	 */
	function removeOrphanFlow(ctx, node, props, mcp, removal, project, projectName, qname) {
		var flowName = qname.indexOf(projectName + ".") === 0 ? qname.substring(projectName.length + 1) : "";
		var orphan = /^[A-Za-z_][A-Za-z0-9_]*$/.test(flowName) && typeof removal.checkOrphanFlow === "function"
			? removal.checkOrphanFlow(project, flowName) : null;
		if (orphan == null) {
			fail("OBJECT_NOT_FOUND", "No object " + qname + " in the loaded projects.",
				typeof removal.checkOrphanFlow === "function"
					? "Use flow-list for Flows, or the qname shown by the Studio."
					: "Use flow-list for Flows, or the qname shown by the Studio. Removing the sources a deleted Flow left needs a newer Convertigo (develop of 12/10/2026 evening or later).");
		}
		var check = jsonValue(orphan);
		var result = {
			ok: true,
			project: projectName,
			qname: qname,
			type: "OrphanFlowSource",
			dryRun: boolValue(props.dryRun, true),
			removes: {
				folders: [],
				database: null,
				sources: check.sources || []
			},
			done: false,
			saved: false
		};
		if (result.dryRun) {
			result.unsavedChanges = unsavedWork(mcp, project, "");
			result.next = "The project has no Flow " + flowName + ", only these sources it left. Call again with dryRun:false to remove them" +
				" and save the project" + (result.unsavedChanges.length ? " (refused while it holds the unsaved Studio changes listed)" : "") + ".";
			ctx.write(props.out || "local.objectRemoval", result);
			return result;
		}
		var saveProject = boolValue(props.saveProject, true) &&
			mcp.assertProjectSaveAllowed({ project: projectName, saveProject: true }, flowName);
		if (saveProject) {
			mcp.assertNoUnsavedProjectChanges(project, projectName, "");
		}
		var removed = jsonValue(removal.removeOrphanFlow(project, flowName));
		result.done = removed.done === true;
		if (!result.done) {
			fail("OBJECT_REMOVE_FAILED", String(removed.error || ("Unable to remove the sources of " + qname + ".")));
		}
		if (saveProject) {
			Packages.com.twinsoft.convertigo.engine.Engine.theApp.databaseObjectsManager.exportProject(project);
			result.saved = true;
		}
		result.studioRefresh = mcp.studioRefreshFlowEngine({ project: projectName }, "orphan Flow sources removed");
		result.next = result.saved ? "Removed and saved." :
			"Removed as working copies; the Save of the project deletes the files.";
		ctx.write(props.out || "local.objectRemoval", result);
		return result;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var projectName = String(props.project || "").trim();
			var qname = String(props.qname || "").trim();
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(projectName)) {
				fail("PROJECT_REQUIRED", "flow-object-remove requires the project that owns the object.");
			}
			if (!qname) {
				fail("QNAME_REQUIRED", "flow-object-remove requires the qname of the object to delete.");
			}
			var studio = Packages.com.twinsoft.convertigo.engine.admin.services.studio;
			var removal = studio.dbo.DboRemoval;
			if (typeof removal.check !== "function") {
				fail("OBJECT_REMOVE_UNAVAILABLE", "This Convertigo server does not share the Studio deletion yet.",
					"Update Convertigo to a build that includes it (develop of 12/10/2026 or later).");
			}
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var project = Engine.theApp.databaseObjectsManager.getOriginalProjectByName(projectName, false);
			if (project == null) {
				fail("UNKNOWN_PROJECT", "Unknown or unloaded project: " + projectName);
			}
			var dbo = studio.Utils.getDbo(qname);
			if (dbo == null) {
				return removeOrphanFlow(ctx, node, props, mcp, removal, project, projectName, qname);
			}
			if (dbo instanceof Packages.com.twinsoft.convertigo.beans.core.Project) {
				fail("OBJECT_IS_PROJECT", qname + " is a project.", "Use flow-project-remove.");
			}
			if (dbo.getProject() == null || String(dbo.getProject().getName()) !== projectName) {
				fail("OBJECT_OUTSIDE_PROJECT", qname + " does not belong to the project " + projectName + ".");
			}
			var isFlow = dbo instanceof Packages.com.twinsoft.convertigo.beans.flow.Flow;
			var check = jsonValue(removal.check(dbo));
			var result = {
				ok: true,
				project: projectName,
				qname: String(dbo.getQName ? dbo.getQName() : qname),
				type: String(dbo.getClass().getSimpleName()),
				dryRun: boolValue(props.dryRun, true),
				removes: {
					folders: check.folders || [],
					database: check.database || null,
					sources: check.sources || []
				},
				done: false,
				saved: false
			};
			var ownDraft = isFlow && flowDraftDirty(dbo);
			if (result.dryRun) {
				result.unsavedChanges = unsavedWork(mcp, project, result.qname);
				if (ownDraft) {
					result.next = "The Flow " + String(dbo.getName()) + " has an unsaved draft, which the deletion would lose: it is refused" +
						" until the draft is discarded (code-discard) or promoted (code-promote)" +
						(result.unsavedChanges.length > 1 ? ". The project also holds the other unsaved Studio changes listed" : "") + ".";
					ctx.write(props.out || "local.objectRemoval", result);
					return result;
				}
				result.next = "Call again with dryRun:false to delete it and save the project" +
					(result.removes.folders.length ? ", folders:[...] to remove some of these folders too" : "") +
					(result.removes.database ? ", dropDatabase:true to drop its database" : "") +
					(result.unsavedChanges.length ? ". The project holds the unsaved Studio changes listed: the user saves them first, or pass saveProject:false to leave the deletion for the next Save" : "") + ".";
				ctx.write(props.out || "local.objectRemoval", result);
				return result;
			}
			var folders = props.folders && props.folders.length !== undefined ? props.folders : [];
			var chosen = new java.util.ArrayList();
			for (var i = 0; i < folders.length; i++) {
				var folder = String(folders[i]);
				if (result.removes.folders.indexOf(folder) === -1) {
					fail("FOLDER_NOT_LINKED", "The folder " + folder + " is not removed with " + qname + ".",
						"Choose among the folders of the dry run.");
				}
				chosen.add(folder);
			}
			if (boolValue(props.dropDatabase, false) && !result.removes.database) {
				fail("NO_DATABASE", qname + " has no database to drop.");
			}
			// the deletion would drop the draft without a trace, even when it is left for the next Save
			if (ownDraft) {
				fail("FLOW_HAS_UNSAVED_DRAFT", "The Flow " + String(dbo.getName()) + " has an unsaved draft. Nothing was changed.",
					"Discard the draft with code-discard (or promote it with code-promote), then delete the Flow.");
			}
			// checked before the deletion, whose Flow source removals are unsaved work of the project too
			var saveProject = boolValue(props.saveProject, true) &&
				mcp.assertProjectSaveAllowed({ project: projectName, saveProject: true }, isFlow ? String(dbo.getName()) : "");
			if (saveProject) {
				mcp.assertNoUnsavedProjectChanges(project, projectName, result.qname);
			}
			var removed = jsonValue(removal.remove(dbo, chosen, boolValue(props.dropDatabase, false)));
			result.done = removed.done === true;
			if (!result.done) {
				fail("OBJECT_REMOVE_FAILED", String(removed.error || ("Unable to delete " + qname + ".")));
			}
			project.hasChanged = true;
			if (saveProject) {
				Engine.theApp.databaseObjectsManager.exportProject(project);
				result.saved = true;
			}
			result.studioRefresh = mcp.studioRefreshFlowEngine({ project: projectName }, "object removed");
			result.next = result.saved ? "Deleted and saved." :
				"Deleted in the loaded project only (saveProject:false); the Save of the project writes it" +
				(result.removes.sources.length ? ", with the removal of the Flow sources" : "") + ".";
			ctx.write(props.out || "local.objectRemoval", result);
			return result;
		}
	};
}())
