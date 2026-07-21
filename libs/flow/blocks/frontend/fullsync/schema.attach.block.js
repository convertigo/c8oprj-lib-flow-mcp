const _meta = {
  "version": 1,
  "description": "Learns a safe requestable schema and attaches it to one FullSync frontend action.",
  "icon": "mdi:database-import-outline",
  "properties": {
    "sourceFile": {
      "kind": "text",
      "type": "string",
      "description": "Flow Svelte source containing the FullSync action."
    },
    "path": {
      "kind": "text",
      "type": "string",
      "description": "Optional exact FrontAst mutation path ending in props.outputSchema. It is resolved from actionId when omitted."
    },
    "actionId": {
      "kind": "text",
      "type": "string",
      "description": "Stable id of the FullSync action used to resolve a missing mutation path."
    },
    "requestable": {
      "kind": "requestable",
      "type": "requestable",
      "description": "Safe server read requestable used to learn the local result contract."
    },
    "input": {
      "kind": "literal",
      "type": "object",
      "default": {},
      "description": "Optional safe sample inputs used when learning is required."
    },
    "learn": {
      "kind": "literal",
      "type": "boolean",
      "default": true,
      "description": "Execute the read requestable when no known schema exists."
    },
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Project used to resolve local requestable names."
    },
    "projectDir": {
      "kind": "text",
      "type": "string",
      "description": "Resolved target project directory."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.schemaAttachment"
    }
  },
  "outputs": { "out": { "type": "object" } },
  "private": true,
  "runtime": "rhino"
}

(function () {
	function cloneSchema(schema) {
		return schema && typeof schema === "object" ? JSON.parse(JSON.stringify(schema)) : {};
	}

	function normalizeXmlSchema(schema) {
		schema = cloneSchema(schema);
		var properties = schema.properties || {};
		var keys = Object.keys(properties).filter(function (key) {
			return key !== "attr" && key !== "_c8oMeta";
		});
		if (properties.text && keys.length === 1 && keys[0] === "text") {
			return normalizeXmlSchema(properties.text);
		}
		if (properties.item && keys.length === 1 && keys[0] === "item") {
			var item = properties.item;
			return item.type === "array"
				? { type: "array", items: normalizeXmlSchema(item.items || {}) }
				: { type: "array", items: normalizeXmlSchema(item) };
		}
		if (schema.type === "array") {
			schema.items = normalizeXmlSchema(schema.items || {});
			return schema;
		}
		if (schema.type === "object" || Object.keys(properties).length) {
			var normalized = { type: "object", properties: {} };
			keys.forEach(function (key) {
				normalized.properties[key] = normalizeXmlSchema(properties[key]);
			});
			return normalized;
		}
		return schema;
	}

	function normalizeFullSyncSchema(schema) {
		var current = cloneSchema(schema);
		["document", "couchdb_output"].forEach(function (name) {
			if (current.properties && current.properties[name]) {
				current = current.properties[name];
			}
		});
		current = normalizeXmlSchema(current);
		var properties = current.properties || (current.properties = {});
		properties.total_rows = { type: "number" };
		properties.offset = { type: "number" };
		if (!properties.rows || properties.rows.type !== "array") {
			properties.rows = { type: "array", items: { type: "object", properties: {} } };
		}
		var row = properties.rows.items || (properties.rows.items = { type: "object", properties: {} });
		row.type = "object";
		row.properties = row.properties || {};
		row.properties.id = { type: "string" };
		row.properties.key = row.properties.key || {};
		row.properties.value = row.properties.value || {};
		row.properties.doc = row.properties.doc || { type: "object" };
		return current;
	}

	function nodeDefinition(node) {
		var definition = node && node.definition;
		if (definition && typeof definition === "object") return definition;
		if (definition) {
			try { return JSON.parse(String(definition)); } catch (_ignored) {}
		}
		return node || {};
	}

	function resolveOutputSchemaPath(ctx, props) {
		var path = String(props.path || "");
		if (/\.props\.outputSchema$/.test(path)) return path;
		var actionId = String(props.actionId || "");
		if (!actionId || !props.sourceFile) {
			throw new Error("FullSync schema attachment requires path or sourceFile with actionId.");
		}
		var tree = ctx.authoringTreeSource({
			projectDir: props.projectDir,
			surface: "frontend",
			builder: "svelte",
			sourceFile: props.sourceFile,
			detail: "inspect",
			maxDepth: 64,
			internalDeep: true,
			includeDefinition: true,
			includeBindings: false
		});
		var matches = [];
		function visit(node) {
			if (!node) return;
			var definition = nodeDefinition(node);
			var type = String(node.type || definition.type || definition.tag || "").toLowerCase();
			if (String(definition.id || node.id || "") === actionId && type.indexOf("fullsync") !== -1) {
				var propertyPaths = definition.sourcePropertyMutationPaths || node.sourcePropertyMutationPaths || {};
				var sourceMutationPath = definition.sourceMutationPath || node.sourceMutationPath || "";
				var candidate = propertyPaths.outputSchema
					|| (sourceMutationPath ? String(sourceMutationPath) + ".props.outputSchema" : "");
				if (candidate && matches.indexOf(candidate) === -1) matches.push(candidate);
			}
			var children = (node.children || []).concat(node.items || []);
			for (var i = 0; i < children.length; i++) visit(children[i]);
		}
		visit(tree);
		if (matches.length !== 1) {
			throw new Error(matches.length
				? "FullSync action id is ambiguous in source: " + actionId
				: "FullSync action was not found in source: " + actionId);
		}
		return matches[0];
	}

	return {
		normalizeFullSyncSchema: normalizeFullSyncSchema,
		resolveOutputSchemaPath: resolveOutputSchemaPath,

		run: function (ctx, node) {
			var props = ctx.props(node);
			var path = resolveOutputSchemaPath(ctx, props);
			var requestable = String(props.requestable || "");
			if (!requestable) {
				throw new Error("FullSync schema attachment requires a safe read requestable.");
			}
			var schemaResult = ctx.requestableSchema({
				requestable: requestable,
				project: props.project,
				projectDir: props.projectDir,
				input: props.input || {},
				learn: props.learn !== false,
				includeSample: false
			}) || {};
			if (schemaResult.ok !== true || !schemaResult.schema) {
				throw new Error(schemaResult.error && schemaResult.error.message || "Schema unavailable for " + requestable);
			}
			var schema = normalizeFullSyncSchema(schemaResult.schema);
			var attached = ctx.authoringMutateSource({
				projectDir: props.projectDir,
				sourceFile: props.sourceFile,
				mutation: { op: "replace", path: path, value: schema }
			});
			attached.schemaRequestable = requestable;
			attached.schemaLearned = schemaResult.learned === true;
			attached.schema = schema;
			ctx.write(props.out || "local.schemaAttachment", attached);
			return attached;
		}
	};
}())
