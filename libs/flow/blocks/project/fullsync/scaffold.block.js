const _meta = {
  "version": 1,
  "description": "Creates or updates FullSync DBOs through Convertigo Java APIs without editing project YAML.",
  "icon": "mdi:database-sync-outline",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Existing Convertigo project to configure."
    },
    "connector": {
      "kind": "literal",
      "type": "object",
      "description": "FullSync connector: {name, anonymousReplication?: 'allow'|'deny', comment?}.",
      "properties": {
        "name": { "type": "string" },
        "anonymousReplication": { "type": "string", "enum": ["allow", "deny"] },
        "comment": { "type": "string" }
      },
      "required": ["name"],
      "additionalProperties": false
    },
    "designDocuments": {
      "kind": "literal",
      "type": "array",
      "default": [],
      "description": "Design documents with structured views, filters, updates and validateDocumentUpdate fields.",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "language": { "type": "string" },
          "views": { "type": "object" },
          "filters": { "type": "object" },
          "updates": { "type": "object" },
          "validateDocumentUpdate": { "type": "string" }
        },
        "required": ["name"],
        "additionalProperties": false
      }
    },
    "transactions": {
      "kind": "literal",
      "type": "array",
      "default": [],
      "description": "Transactions: getDocument, getView, getServerInfo, postDocument, postBulkDocuments, getDocumentAttachment, putDocumentAttachment or resetDatabase.",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["getDocument", "getView", "getServerInfo", "postDocument", "postBulkDocuments", "getDocumentAttachment", "putDocumentAttachment", "resetDatabase"]
          },
          "view": { "type": "string" },
          "policy": {
            "type": "string",
            "enum": ["none", "create", "override", "merge"]
          },
          "aclPolicy": {
            "type": "string",
            "enum": ["fromAuthenticatedUser", "anonymous", "noOp", "fromKeyC8oAcl"]
          },
          "useHash": { "type": "boolean" },
          "accessibility": { "type": "string", "enum": ["Private", "Public", "Hidden"] },
          "comment": { "type": "string" },
          "variables": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "multiValued": { "type": "boolean" },
                "required": { "type": "boolean" },
                "description": { "type": "string" },
                "defaultValue": {}
              },
              "required": ["name"],
              "additionalProperties": false
            }
          }
        },
        "required": ["name", "type"],
        "additionalProperties": false
      }
    },
    "listeners": {
      "kind": "literal",
      "type": "array",
      "default": [],
      "description": "FullSync view listeners targeting a Sequence or Flow: {name, targetSequence, targetView, chunk?, enabled?, comment?}.",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "targetSequence": { "type": "string" },
          "targetView": { "type": "string" },
          "chunk": { "type": "integer", "minimum": 1 },
          "enabled": { "type": "boolean" },
          "comment": { "type": "string" }
        },
        "required": ["name", "targetSequence", "targetView"],
        "additionalProperties": false
      }
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Validate and report planned DBO changes without mutating the project."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.fullsyncScaffold",
      "description": "Scope path receiving the scaffold result."
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": { "type": "boolean" },
        "project": { "type": "string" },
        "connector": { "type": "string" },
        "dryRun": { "type": "boolean" },
        "created": { "type": "array", "items": { "type": "string" } },
        "updated": { "type": "array", "items": { "type": "string" } },
        "reused": { "type": "array", "items": { "type": "string" } },
        "warnings": { "type": "array", "items": { "type": "object" } },
        "saved": { "type": "boolean" },
        "readiness": {
          "type": "object",
          "properties": {
            "checked": { "type": "boolean" },
            "ready": { "type": "boolean" },
            "syncAttempted": { "type": "boolean" },
            "database": { "type": "string" },
            "designDocuments": { "type": "array", "items": { "type": "object" } },
            "errors": { "type": "array", "items": { "type": "object" } }
          }
        },
        "repair": { "type": "object" }
      }
    }
  },
  "runtime": "rhino"
}

(function () {
	var TRANSACTION_TYPES = {
		getDocument: "com.twinsoft.convertigo.beans.transactions.couchdb.GetDocumentTransaction",
		getView: "com.twinsoft.convertigo.beans.transactions.couchdb.GetViewTransaction",
		getServerInfo: "com.twinsoft.convertigo.beans.transactions.couchdb.GetServerInfoTransaction",
		postDocument: "com.twinsoft.convertigo.beans.transactions.couchdb.PostDocumentTransaction",
		postBulkDocuments: "com.twinsoft.convertigo.beans.transactions.couchdb.PostBulkDocumentsTransaction",
		getDocumentAttachment: "com.twinsoft.convertigo.beans.transactions.couchdb.GetDocumentAttachmentTransaction",
		putDocumentAttachment: "com.twinsoft.convertigo.beans.transactions.couchdb.PutDocumentAttachmentTransaction",
		resetDatabase: "com.twinsoft.convertigo.beans.transactions.couchdb.ResetDatabaseTransaction"
	};

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
		return String(value).toLowerCase() === "true";
	}

	function objectValue(value, label) {
		if (value === undefined || value === null || value === "") {
			return {};
		}
		if (typeof value !== "object" || Array.isArray(value)) {
			throw new Error(label + " must be an object.");
		}
		return value;
	}

	function arrayValue(value, label) {
		if (value === undefined || value === null || value === "") {
			return [];
		}
		if (!Array.isArray(value)) {
			throw new Error(label + " must be an array.");
		}
		return value;
	}

	function requiredName(value, label, pattern) {
		var name = String(value || "").trim();
		if (!name || pattern && !pattern.test(name)) {
			throw new Error("Invalid " + label + ": " + name);
		}
		return name;
	}

	function projectName(value) {
		return requiredName(value, "Convertigo project name", /^[A-Za-z_][A-Za-z0-9_]*$/);
	}

	function connectorName(value) {
		return requiredName(value, "FullSync connector name", /^[a-z][a-z0-9_$()+\/-]*$/);
	}

	function dboName(value, label) {
		return requiredName(value, label, /^[A-Za-z_][A-Za-z0-9_.-]*$/);
	}

	function loadedProject(engine, name) {
		try {
			return engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(name), false);
		} catch (_ignoreMissing) {
			return null;
		}
	}

	function existingConnector(project, name) {
		try {
			return project.getConnectorByName(name);
		} catch (_ignoreMissing) {
			return null;
		}
	}

	function javaJson(value) {
		var JSONObject = Packages.org.codehaus.jettison.json.JSONObject;
		return new JSONObject(JSON.stringify(value || {}));
	}

	function designJson(spec, name) {
		var JSONObject = Packages.org.codehaus.jettison.json.JSONObject;
		var json = new JSONObject();
		json.put("_id", "_design/" + name);
		if (spec.language) {
			json.put("language", String(spec.language));
		}
		["views", "filters", "updates"].forEach(function (key) {
			if (spec[key] !== undefined && spec[key] !== null) {
				json.put(key, javaJson(objectValue(spec[key], "designDocuments[]." + key)));
			}
		});
		if (spec.validateDocumentUpdate !== undefined && spec.validateDocumentUpdate !== null && String(spec.validateDocumentUpdate) !== "") {
			json.put("validate_doc_update", String(spec.validateDocumentUpdate));
		}
		return json;
	}

	function designWarnings(designDocuments) {
		var warnings = [];
		designDocuments.forEach(function (rawSpec) {
			var spec = objectValue(rawSpec, "designDocuments[]");
			var views = objectValue(spec.views, "designDocuments[].views");
			Object.keys(views).forEach(function (viewName) {
				var view = objectValue(views[viewName], "designDocuments[].views." + viewName);
				var map = String(view.map || "");
				var match = /emit\s*\(\s*String\s*\(\s*doc\.([A-Za-z_$][\w$]*)\s*\)/.exec(map);
				if (match) {
					warnings.push({
						code: "FULLSYNC_VIEW_KEY_COERCION",
						designDocument: String(spec.name || ""),
						view: viewName,
						field: match[1],
						message: "String(doc." + match[1] + ") collapses an array-valued relation into one comma-joined key. Emit the native scalar key, and when the field can be an array, emit one row per element."
					});
				}
			});
		});
		return warnings;
	}

	function plainJson(value) {
		if (value === undefined || value === null) {
			return value;
		}
		try {
			if (value.getClass && String(value.getClass().getName()) === "org.codehaus.jettison.json.JSONObject") {
				return JSON.parse(String(value));
			}
		} catch (_ignoreJavaClass) {
		}
		return value;
	}

	function designMismatches(actual, expected, prefix) {
		actual = plainJson(actual);
		expected = plainJson(expected);
		prefix = prefix || "";
		var mismatches = [];
		if (expected && typeof expected === "object" && !Array.isArray(expected)) {
			if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
				return [prefix || "$"];
			}
			Object.keys(expected).forEach(function (key) {
				mismatches = mismatches.concat(designMismatches(
					actual[key],
					expected[key],
					prefix ? prefix + "." + key : key
				));
			});
			return mismatches;
		}
		if (JSON.stringify(actual) !== JSON.stringify(expected)) {
			mismatches.push(prefix || "$");
		}
		return mismatches;
	}

	function readReadiness(connector, designDocuments) {
		var database = String(connector.getDatabaseName());
		var readiness = {
			checked: true,
			ready: false,
			syncAttempted: false,
			database: database,
			designDocuments: [],
			errors: []
		};
		try {
			var client = connector.getCouchClient();
			var databaseInfo = plainJson(client.getDatabase(database));
			if (databaseInfo && databaseInfo.error) {
				throw new Error(String(databaseInfo.error) + ": " + String(databaseInfo.reason || "database unavailable"));
			}
			designDocuments.forEach(function (rawSpec) {
				var spec = objectValue(rawSpec, "designDocuments[]");
				var name = String(spec.name);
				var status = { name: name, ready: false, mismatches: [] };
				try {
					var remote = plainJson(client.getDocument(database, "_design/" + name));
					if (remote && remote.error) {
						throw new Error(String(remote.error) + ": " + String(remote.reason || "design document unavailable"));
					}
					status.mismatches = designMismatches(remote, designJson(spec, name));
					status.ready = status.mismatches.length === 0;
					if (!status.ready) {
						readiness.errors.push({
							code: "FULLSYNC_DESIGN_DOCUMENT_STALE",
							designDocument: name,
							message: "Live design document differs from the saved DBO.",
							paths: status.mismatches
						});
					}
				} catch (e) {
					status.error = String(e.message || e);
					readiness.errors.push({
						code: "FULLSYNC_DESIGN_DOCUMENT_UNAVAILABLE",
						designDocument: name,
						message: status.error
					});
				}
				readiness.designDocuments.push(status);
			});
			readiness.ready = readiness.errors.length === 0 &&
				readiness.designDocuments.every(function (status) { return status.ready; });
		} catch (e) {
			readiness.errors.push({
				code: "FULLSYNC_DATABASE_UNAVAILABLE",
				message: String(e.message || e)
			});
		}
		return readiness;
	}

	function verifyReadiness(connector, designDocuments) {
		var readiness = readReadiness(connector, designDocuments);
		if (readiness.ready) {
			return readiness;
		}
		Packages.com.twinsoft.convertigo.engine.providers.couchdb.CouchDbManager.syncDocument(connector);
		readiness = readReadiness(connector, designDocuments);
		readiness.syncAttempted = true;
		return readiness;
	}

	function transactionClass(type) {
		var name = TRANSACTION_TYPES[type];
		if (!name) {
			throw new Error("Unsupported FullSync transaction type: " + type);
		}
		return name;
	}

	function sameValue(left, right) {
		if (left === right || left == null && right == null) {
			return true;
		}
		try {
			if (left != null && typeof left.equals === "function" && left.equals(right)) {
				return true;
			}
		} catch (_ignoreEquals) {
		}
		return String(left) === String(right);
	}

	function newTransaction(type) {
		switch (type) {
		case "getDocument": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.GetDocumentTransaction();
		case "getView": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.GetViewTransaction();
		case "getServerInfo": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.GetServerInfoTransaction();
		case "postDocument": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.PostDocumentTransaction();
		case "postBulkDocuments": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.PostBulkDocumentsTransaction();
		case "getDocumentAttachment": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.GetDocumentAttachmentTransaction();
		case "putDocumentAttachment": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.PutDocumentAttachmentTransaction();
		case "resetDatabase": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.ResetDatabaseTransaction();
		default: throw new Error("Unsupported FullSync transaction type: " + type);
		}
	}

	function defaultVariables(type, spec) {
		if (type === "getDocument") {
			return [{ name: "_use_docid", description: "Document ID" }];
		}
		if (type === "postBulkDocuments") {
			return [{
				name: "_use_json_base",
				description: "JSON array of complete documents to write in one bulk request"
			}];
		}
		if (type === "getDocumentAttachment") {
			return [
				{ name: "_use_attpath", description: "Optional destination attachment path" },
				{ name: "_use_attname", description: "Attachment name" },
				{ name: "_use_docid", description: "Document ID" }
			];
		}
		if (type === "putDocumentAttachment") {
			return [
				{ name: "_use_attpath", description: "Optional source attachment path" },
				{ name: "_use_attname", description: "Attachment name" },
				{ name: "_use_docid", description: "Document ID" },
				{ name: "_use_attbase64", description: "Base64 content used when the path is blank or unavailable" },
				{ name: "_use_attcontent_type", description: "Attachment content type" }
			];
		}
		if (type === "getView") {
			var variables = [
				{ name: "_use_include_docs", description: "Include source documents in view rows" },
				{ name: "_use_limit", description: "Optional maximum number of view rows" }
			];
			if (!spec.view) {
				variables.unshift(
					{ name: "_use_ddoc", description: "Design document" },
					{ name: "_use_view", description: "View" }
				);
			}
			return variables;
		}
		return [];
	}

	function canonicalVariableName(type, name) {
		name = String(name || "");
		if ((type === "getView" || type === "getDocument" || type === "getDocumentAttachment" || type === "putDocumentAttachment") && name.indexOf("_use_") !== 0) {
			return "_use_" + name;
		}
		return name;
	}

	function mergedVariables(type, spec) {
		var ordered = [];
		var indexes = {};
		defaultVariables(type, spec).concat(arrayValue(spec.variables, "transactions[].variables")).forEach(function (variable) {
			variable = objectValue(variable, "transactions[].variables[]");
			var name = requiredName(canonicalVariableName(type, variable.name), "transaction variable name", /^[A-Za-z_][A-Za-z0-9_.-]*$/);
			variable = Object.assign({}, variable, { name: name });
			if (indexes[name] === undefined) {
				indexes[name] = ordered.length;
				ordered.push(variable);
			} else {
				ordered[indexes[name]] = variable;
			}
		});
		return ordered;
	}

	function configureVariable(transaction, spec, result, transactionQName) {
		var name = requiredName(spec.name, "transaction variable name", /^[A-Za-z_][A-Za-z0-9_.-]*$/);
		var multi = boolValue(spec.multiValued, false);
		var variable = transaction.getVariable(name);
		var expectedClass = multi
			? "com.twinsoft.convertigo.beans.variables.RequestableMultiValuedVariable"
			: "com.twinsoft.convertigo.beans.variables.RequestableVariable";
		var qname = transactionQName + "." + name;
		if (variable != null && String(variable.getClass().getName()) !== expectedClass) {
			throw new Error("Variable " + qname + " already exists with incompatible multiplicity.");
		}
		var created = false;
		if (variable == null) {
			variable = multi
				? new Packages.com.twinsoft.convertigo.beans.variables.RequestableMultiValuedVariable()
				: new Packages.com.twinsoft.convertigo.beans.variables.RequestableVariable();
			variable.bNew = true;
			variable.setName(name);
			transaction.add(variable);
			created = true;
		}
		var changed = created;
		if (spec.description !== undefined && String(variable.getDescription() || "") !== String(spec.description || "")) {
			variable.setDescription(String(spec.description || ""));
			changed = true;
		}
		if (spec.required !== undefined && Boolean(variable.isRequired()) !== boolValue(spec.required, false)) {
			variable.setRequired(boolValue(spec.required, false));
			changed = true;
		}
		if (spec.defaultValue !== undefined && !sameValue(variable.getValueOrNull(), spec.defaultValue)) {
			variable.setValueOrNull(spec.defaultValue);
			changed = true;
		}
		if (changed) {
			variable.hasChanged = true;
			(created ? result.created : result.updated).push(qname);
		} else {
			result.reused.push(qname);
		}
		return changed;
	}

	function configureTransaction(transaction, type, spec) {
		var changed = false;
		if (spec.comment !== undefined && String(transaction.getComment() || "") !== String(spec.comment || "")) {
			transaction.setComment(String(spec.comment || ""));
			changed = true;
		}
		if (spec.accessibility !== undefined) {
			var Accessibility = Packages.com.twinsoft.convertigo.engine.enums.Accessibility;
			var accessibility = Accessibility.valueOf(String(spec.accessibility));
			if (!sameValue(transaction.getAccessibility(), accessibility)) {
				transaction.setAccessibility(accessibility);
				changed = true;
			}
		}
		if (type === "getView" && spec.view !== undefined && String(transaction.getViewname() || "") !== String(spec.view || "")) {
			transaction.setViewname(String(spec.view || ""));
			changed = true;
		}
		if ((type === "postDocument" || type === "postBulkDocuments") && spec.policy !== undefined) {
			var CouchPostDocumentPolicy = Packages.com.twinsoft.convertigo.engine.enums.CouchPostDocumentPolicy;
			var policy = CouchPostDocumentPolicy.valueOf(String(spec.policy));
			if (!sameValue(transaction.getPolicy(), policy)) {
				transaction.setPolicy(policy);
				changed = true;
			}
		}
		if ((type === "postDocument" || type === "postBulkDocuments") && spec.aclPolicy !== undefined) {
			var FullSyncAclPolicy = Packages.com.twinsoft.convertigo.engine.enums.FullSyncAclPolicy;
			var aclPolicy = FullSyncAclPolicy.valueOf(String(spec.aclPolicy));
			if (!sameValue(transaction.getFullSyncAclPolicy(), aclPolicy)) {
				transaction.setFullSyncAclPolicy(aclPolicy);
				changed = true;
			}
		}
		if ((type === "postDocument" || type === "postBulkDocuments") && spec.useHash !== undefined && Boolean(transaction.isUseHash()) !== boolValue(spec.useHash, false)) {
			transaction.setUseHash(boolValue(spec.useHash, false));
			changed = true;
		}
		if (changed) {
			transaction.hasChanged = true;
		}
		return changed;
	}

	function listenerTarget(value, label, segments) {
		var target = String(value || "").trim();
		var parts = target.split(".");
		if (parts.length !== segments || parts.some(function (part) { return !/^[A-Za-z_][A-Za-z0-9_$-]*$/.test(part); })) {
			throw new Error("Invalid " + label + ": " + target);
		}
		return target;
	}

	function configureListener(listener, spec) {
		var changed = false;
		var targetSequence = listenerTarget(spec.targetSequence, "listener targetSequence", 2);
		var targetView = listenerTarget(spec.targetView, "listener targetView", 4);
		if (String(listener.getTargetSequence() || "") !== targetSequence) {
			listener.setTargetSequence(targetSequence);
			changed = true;
		}
		if (String(listener.getTargetView() || "") !== targetView) {
			listener.setTargetView(targetView);
			changed = true;
		}
		if (spec.chunk !== undefined) {
			var chunk = Number(spec.chunk);
			if (!isFinite(chunk) || Math.floor(chunk) !== chunk || chunk < 1) {
				throw new Error("listeners[].chunk must be a positive integer.");
			}
			if (Number(listener.getChunk()) !== chunk) {
				listener.setChunk(chunk);
				changed = true;
			}
		}
		if (spec.enabled !== undefined && Boolean(listener.isEnabled()) !== boolValue(spec.enabled, true)) {
			listener.setEnabled(boolValue(spec.enabled, true));
			changed = true;
		}
		if (spec.comment !== undefined && String(listener.getComment() || "") !== String(spec.comment || "")) {
			listener.setComment(String(spec.comment || ""));
			changed = true;
		}
		if (changed) {
			listener.hasChanged = true;
		}
		return changed;
	}

	function refreshStudio(engine, project) {
		var projectName = String(project.getName());
		try {
			engine.theApp.schemaManager.clearCache(projectName);
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
					ConvertigoPlugin.logException(e, "Unable to refresh Project Explorer after FullSync scaffold", false);
				}
			}}));
		} catch (_ignoreStudioRefresh) {
		}
	}

	return {
		canonicalVariableName: canonicalVariableName,
		configureListener: configureListener,
		configureTransaction: configureTransaction,
		defaultVariables: defaultVariables,
		designWarnings: designWarnings,
		designMismatches: designMismatches,
		newTransaction: newTransaction,

		run: function (ctx, node) {
			var props = ctx.props(node);
			var name = projectName(prop(props, "project"));
			var connectorSpec = objectValue(prop(props, "connector"), "connector");
			var fsName = connectorName(connectorSpec.name);
			var designDocuments = arrayValue(prop(props, "designDocuments"), "designDocuments");
			var transactions = arrayValue(prop(props, "transactions"), "transactions");
			var listeners = arrayValue(prop(props, "listeners"), "listeners");
			var dryRun = boolValue(prop(props, "dryRun"), false);
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var project = loadedProject(Engine, name);
			if (project == null && !dryRun) {
				throw new Error("Convertigo project not found: " + name + ". Run flow-project-bootstrap first.");
			}
			var connector = project == null ? null : existingConnector(project, fsName);
			if (connector != null && String(connector.getClass().getName()) !== "com.twinsoft.convertigo.beans.connectors.FullSyncConnector") {
				throw new Error("Connector " + name + "." + fsName + " exists but is not a FullSyncConnector.");
			}

			var result = {
				ok: true,
				project: name,
				connector: fsName,
				dryRun: dryRun,
				created: [],
				updated: [],
				reused: [],
				warnings: designWarnings(designDocuments),
				saved: false,
				usage: {
					postBulkDocuments: "Pass the document array as input._use_json_base. Do not invent a docs variable."
				}
			};
			var connectorQName = name + "." + fsName;
			var projectChanged = false;

			designDocuments.forEach(function (rawSpec) {
				var spec = objectValue(rawSpec, "designDocuments[]");
				dboName(spec.name, "design document name");
				designJson(spec, String(spec.name));
			});
			transactions.forEach(function (rawSpec) {
				var spec = objectValue(rawSpec, "transactions[]");
				dboName(spec.name, "transaction name");
				var type = String(spec.type || "");
				transactionClass(type);
				mergedVariables(type, spec);
			});
			listeners.forEach(function (rawSpec) {
				var spec = objectValue(rawSpec, "listeners[]");
				dboName(spec.name, "listener name");
				listenerTarget(spec.targetSequence, "listener targetSequence", 2);
				listenerTarget(spec.targetView, "listener targetView", 4);
				if (spec.chunk !== undefined) {
					var chunk = Number(spec.chunk);
					if (!isFinite(chunk) || Math.floor(chunk) !== chunk || chunk < 1) {
						throw new Error("listeners[].chunk must be a positive integer.");
					}
				}
			});

			if (dryRun) {
				result.readiness = {
					checked: false,
					ready: false,
					syncAttempted: false,
					database: fsName,
					designDocuments: [],
					errors: []
				};
				result.plan = {
					connector: connectorQName,
					designDocuments: designDocuments.map(function (spec) { return connectorQName + "." + spec.name; }),
					transactions: transactions.map(function (spec) { return connectorQName + "." + spec.name; }),
					listeners: listeners.map(function (spec) { return connectorQName + "." + spec.name; })
				};
				ctx.write(prop(props, "out") || "local.fullsyncScaffold", result);
				return result;
			}

			if (connector == null) {
				connector = new Packages.com.twinsoft.convertigo.beans.connectors.FullSyncConnector();
				connector.bNew = true;
				connector.setName(fsName);
				project.add(connector);
				result.created.push(connectorQName);
				projectChanged = true;
			} else {
				result.reused.push(connectorQName);
			}
			if (connectorSpec.comment !== undefined && String(connector.getComment() || "") !== String(connectorSpec.comment || "")) {
				connector.setComment(String(connectorSpec.comment || ""));
				connector.hasChanged = true;
				projectChanged = true;
			}
			if (connectorSpec.anonymousReplication !== undefined) {
				var FullSyncAnonymousReplication = Packages.com.twinsoft.convertigo.engine.enums.FullSyncAnonymousReplication;
				var anonymousReplication = FullSyncAnonymousReplication.valueOf(String(connectorSpec.anonymousReplication));
				if (!sameValue(connector.getAnonymousReplication(), anonymousReplication)) {
					connector.setAnonymousReplication(anonymousReplication);
					connector.hasChanged = true;
					projectChanged = true;
				}
			}

			designDocuments.forEach(function (rawSpec) {
				var spec = objectValue(rawSpec, "designDocuments[]");
				var designName = dboName(spec.name, "design document name");
				var qname = connectorQName + "." + designName;
				var document = connector.getDocumentByName(designName);
				if (document != null && String(document.getClass().getName()) !== "com.twinsoft.convertigo.beans.couchdb.DesignDocument") {
					throw new Error("Document " + qname + " exists but is not a DesignDocument.");
				}
				var desired = designJson(spec, designName);
				if (document == null) {
					document = new Packages.com.twinsoft.convertigo.beans.couchdb.DesignDocument();
					document.bNew = true;
					document.setName(designName);
					document.setJSONObject(desired);
					connector.add(document);
					result.created.push(qname);
					projectChanged = true;
				} else if (designMismatches(document.getJSONObject(), desired).length !== 0) {
					document.setJSONObject(desired);
					document.hasChanged = true;
					result.updated.push(qname);
					projectChanged = true;
				} else {
					result.reused.push(qname);
				}
			});

			transactions.forEach(function (rawSpec) {
				var spec = objectValue(rawSpec, "transactions[]");
				var transactionName = dboName(spec.name, "transaction name");
				var type = String(spec.type || "");
				var expectedClass = transactionClass(type);
				var qname = connectorQName + "." + transactionName;
				var transaction = connector.getTransactionByName(transactionName);
				var created = false;
				if (transaction != null && String(transaction.getClass().getName()) !== expectedClass) {
					throw new Error("Transaction " + qname + " exists with incompatible type " + transaction.getClass().getName() + ".");
				}
				if (transaction == null) {
					transaction = newTransaction(type);
					transaction.bNew = true;
					transaction.setName(transactionName);
					connector.add(transaction);
					created = true;
					result.created.push(qname);
					projectChanged = true;
				} else {
					result.reused.push(qname);
				}
				projectChanged = configureTransaction(transaction, type, spec) || projectChanged;
				var variables = mergedVariables(type, spec);
				variables.forEach(function (variableSpec) {
					projectChanged = configureVariable(transaction, variableSpec, result, qname) || projectChanged;
				});
			});

			listeners.forEach(function (rawSpec) {
				var spec = objectValue(rawSpec, "listeners[]");
				var listenerName = dboName(spec.name, "listener name");
				var qname = connectorQName + "." + listenerName;
				var listener = connector.getListenerByName(listenerName);
				var expectedClass = "com.twinsoft.convertigo.beans.couchdb.FullSyncListener";
				if (listener != null && String(listener.getClass().getName()) !== expectedClass) {
					throw new Error("Listener " + qname + " exists with incompatible type " + listener.getClass().getName() + ".");
				}
				if (listener == null) {
					listener = new Packages.com.twinsoft.convertigo.beans.couchdb.FullSyncListener();
					listener.bNew = true;
					listener.setName(listenerName);
					connector.add(listener);
					result.created.push(qname);
					projectChanged = true;
				} else {
					result.reused.push(qname);
				}
				projectChanged = configureListener(listener, spec) || projectChanged;
			});

			if (projectChanged) {
				project.hasChanged = true;
				Engine.theApp.databaseObjectsManager.exportProject(project);
				result.saved = true;
			}
			result.readiness = verifyReadiness(connector, designDocuments);
			result.ok = result.readiness.ready;
			if (!result.ok) {
				result.repair = {
					tool: "flow-fullsync-scaffold",
					arguments: {
						project: name,
						connector: connectorSpec,
						designDocuments: designDocuments,
						transactions: transactions,
						listeners: listeners,
						dryRun: false
					}
				};
			}
			if (projectChanged) {
				refreshStudio(Engine, project);
			}
			ctx.write(prop(props, "out") || "local.fullsyncScaffold", result);
			return result;
		}
	};
}())
