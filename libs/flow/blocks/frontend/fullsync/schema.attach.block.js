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
      "description": "Exact FrontAst mutation path ending in props.outputSchema."
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
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var path = String(props.path || "");
			var requestable = String(props.requestable || "");
			if (!/\.props\.outputSchema$/.test(path)) {
				throw new Error("FullSync schema attachment path must target props.outputSchema.");
			}
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
			var attached = ctx.authoringMutateSource({
				projectDir: props.projectDir,
				sourceFile: props.sourceFile,
				mutation: { op: "replace", path: path, value: schemaResult.schema }
			});
			attached.schemaRequestable = requestable;
			attached.schemaLearned = schemaResult.learned === true;
			attached.schema = schemaResult.schema;
			ctx.write(props.out || "local.schemaAttachment", attached);
			return attached;
		}
	};
}())
