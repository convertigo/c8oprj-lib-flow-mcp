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
      "description": "Transactions: getDocument, getView, getServerInfo, postBulkDocuments or resetDatabase.",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["getDocument", "getView", "getServerInfo", "postBulkDocuments", "resetDatabase"]
          },
          "view": { "type": "string" },
          "aclPolicy": {
            "type": "string",
            "enum": ["fromAuthenticatedUser", "anonymous", "noOp", "fromKeyC8oAcl"]
          },
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
        "saved": { "type": "boolean" }
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
		postBulkDocuments: "com.twinsoft.convertigo.beans.transactions.couchdb.PostBulkDocumentsTransaction",
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
		case "postBulkDocuments": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.PostBulkDocumentsTransaction();
		case "resetDatabase": return new Packages.com.twinsoft.convertigo.beans.transactions.couchdb.ResetDatabaseTransaction();
		default: throw new Error("Unsupported FullSync transaction type: " + type);
		}
	}

	function defaultVariables(type, spec) {
		if (type === "getDocument") {
			return [{ name: "_use_docid", description: "Document ID" }];
		}
		if (type === "getView" && !spec.view) {
			return [
				{ name: "_use_ddoc", description: "Design document" },
				{ name: "_use_view", description: "View" }
			];
		}
		return [];
	}

	function mergedVariables(type, spec) {
		var ordered = [];
		var indexes = {};
		defaultVariables(type, spec).concat(arrayValue(spec.variables, "transactions[].variables")).forEach(function (variable) {
			variable = objectValue(variable, "transactions[].variables[]");
			var name = requiredName(variable.name, "transaction variable name", /^[A-Za-z_][A-Za-z0-9_.-]*$/);
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
		if (type === "postBulkDocuments" && spec.aclPolicy !== undefined) {
			var FullSyncAclPolicy = Packages.com.twinsoft.convertigo.engine.enums.FullSyncAclPolicy;
			var aclPolicy = FullSyncAclPolicy.valueOf(String(spec.aclPolicy));
			if (!sameValue(transaction.getFullSyncAclPolicy(), aclPolicy)) {
				transaction.setFullSyncAclPolicy(aclPolicy);
				changed = true;
			}
		}
		if (changed) {
			transaction.hasChanged = true;
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
		run: function (ctx, node) {
			var props = ctx.props(node);
			var name = projectName(prop(props, "project"));
			var connectorSpec = objectValue(prop(props, "connector"), "connector");
			var fsName = connectorName(connectorSpec.name);
			var designDocuments = arrayValue(prop(props, "designDocuments"), "designDocuments");
			var transactions = arrayValue(prop(props, "transactions"), "transactions");
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
				saved: false
			};
			var connectorQName = name + "." + fsName;

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

			if (dryRun) {
				result.plan = {
					connector: connectorQName,
					designDocuments: designDocuments.map(function (spec) { return connectorQName + "." + spec.name; }),
					transactions: transactions.map(function (spec) { return connectorQName + "." + spec.name; })
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
			} else {
				result.reused.push(connectorQName);
			}
			if (connectorSpec.comment !== undefined && String(connector.getComment() || "") !== String(connectorSpec.comment || "")) {
				connector.setComment(String(connectorSpec.comment || ""));
				connector.hasChanged = true;
			}
			if (connectorSpec.anonymousReplication !== undefined) {
				var FullSyncAnonymousReplication = Packages.com.twinsoft.convertigo.engine.enums.FullSyncAnonymousReplication;
				var anonymousReplication = FullSyncAnonymousReplication.valueOf(String(connectorSpec.anonymousReplication));
				if (!sameValue(connector.getAnonymousReplication(), anonymousReplication)) {
					connector.setAnonymousReplication(anonymousReplication);
					connector.hasChanged = true;
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
				} else if (String(document.getJSONObject().toString()) !== String(desired.toString())) {
					document.setJSONObject(desired);
					document.hasChanged = true;
					result.updated.push(qname);
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
				} else {
					result.reused.push(qname);
				}
				configureTransaction(transaction, type, spec);
				var variables = mergedVariables(type, spec);
				variables.forEach(function (variableSpec) {
					configureVariable(transaction, variableSpec, result, qname);
				});
			});

			project.hasChanged = true;
			Engine.theApp.databaseObjectsManager.exportProject(project);
			result.saved = true;
			refreshStudio(Engine, project);
			ctx.write(prop(props, "out") || "local.fullsyncScaffold", result);
			return result;
		}
	};
}())
