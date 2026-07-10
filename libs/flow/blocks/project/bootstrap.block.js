const _meta = {
  "version": 1,
  "description": "Bootstraps a Convertigo project for Flow authoring from the official sequence template, then adds FlowEngine metadata through DBO APIs.",
  "icon": "mdi:application-import",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Convertigo project name to create or customize."
    },
    "templateUrl": {
      "kind": "text",
      "type": "string",
      "default": "https://github.com/convertigo/c8oprj-template-sequence/archive/8.3.0.zip",
      "description": "Template archive URL used when the project does not exist or force=true."
    },
    "ui": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Also configure the experimental Svelte frontbuilder."
    },
    "force": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Re-import the template even if the project already exists."
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Preview the bootstrap without importing or saving."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "result",
      "description": "Scope path receiving the bootstrap result."
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": { "type": "boolean" },
        "project": { "type": "string" },
        "imported": { "type": "boolean" },
        "createdFlowEngine": { "type": "boolean" },
        "configuredSvelte": { "type": "boolean" }
      }
    }
  },
  "runtime": "rhino"
}

(function () {
	var TEMPLATE_URL = "https://github.com/convertigo/c8oprj-template-sequence/archive/8.3.0.zip";
	var ENGINE_QNAME = "lib_flow_engine.Engine";
	var FRONTBUILDER_PROJECT = "lib_flow_frontbuilder_svelte";

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
		var text = String(value).toLowerCase();
		if (text === "true" || text === "1" || text === "yes") {
			return true;
		}
		if (text === "false" || text === "0" || text === "no") {
			return false;
		}
		return fallback;
	}

	function projectName(value) {
		var name = String(value || "").trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
			throw new Error("Invalid Convertigo project name: " + name);
		}
		return name;
	}

	function engineSource(ui, resourceRoot) {
		if (!ui) {
			return [
				"version: 1",
				"engineQName: " + ENGINE_QNAME,
				"bindings: {}",
				"config: {}",
				""
			].join("\n");
		}
		return [
			"version: 1",
			"engineQName: " + ENGINE_QNAME,
			"bindings: {}",
			"config:",
			"  frontbuilder:",
			"    svelte:",
			"      target: svelte5",
			"      resourceRoot: " + resourceRoot,
			"      privateDir: _private/svelte",
			"      modelPath: libs/flow/frontbuilder/svelte/model/SvelteFrontend/src/routes/+page.flow.svelte",
			"      buildOutput: DisplayObjects/mobile",
			""
		].join("\n");
	}

	function loadedProject(engine, name) {
		try {
			return engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(name), false);
		} catch (_ignoreMissing) {
			return null;
		}
	}

	function svelteResourceRoot(engine) {
		var File = Packages.java.io.File;
		var project = loadedProject(engine, FRONTBUILDER_PROJECT);
		if (project != null) {
			return String(new File(String(project.getDirPath()), "libs/flow/frontbuilder/svelte").getAbsolutePath());
		}
		return "libs/flow/frontbuilder/svelte";
	}

	function ensureFrontbuilderReference(engine, project) {
		try {
			engine.theApp.referencedProjectManager.getReferenceFromProject(project, FRONTBUILDER_PROJECT);
			return true;
		} catch (_ignoreReference) {
			return false;
		}
	}

	function importTemplate(engine, name, templateUrl) {
		var ProjectUrlParser = Packages.com.twinsoft.convertigo.engine.util.ProjectUrlParser;
		var parser = new ProjectUrlParser(name + "=" + templateUrl);
		if (!parser.isValid()) {
			throw new Error("Invalid template URL: " + templateUrl);
		}
		var project = engine.theApp.referencedProjectManager.importProject(parser, true);
		if (project == null) {
			throw new Error("No project imported with: " + name + "=" + templateUrl);
		}
		return project;
	}

	function ensureFlowEngine(project, ui, resourceRoot) {
		var FlowEngine = Packages.com.twinsoft.convertigo.beans.flow.FlowEngine;
		var flowEngine = project.getFlowEngine();
		var created = false;
		if (flowEngine == null) {
			flowEngine = new FlowEngine();
			flowEngine.bNew = true;
			flowEngine.setName("FlowEngine");
			project.add(flowEngine);
			created = true;
		}
		flowEngine.setEngineQName(ENGINE_QNAME);
		var source = String(flowEngine.getEngineSource() || "");
		if (created || source.trim() === "" || ui && source.indexOf("frontbuilder:") === -1) {
			flowEngine.setEngineSource(engineSource(ui, resourceRoot));
		}
		project.hasChanged = true;
		return {
			flowEngine: flowEngine,
			created: created,
			configuredSvelte: ui
		};
	}

	function refreshStudio(engine, projectName) {
		try {
			engine.theApp.schemaManager.clearCache(String(projectName));
		} catch (_ignoreSchemaCache) {
		}
		try {
			Packages.com.twinsoft.convertigo.engine.sync.SharedWorkspaceSyncManager.markProjectReload(String(projectName));
		} catch (_ignoreSync) {
		}
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var name = projectName(prop(props, "project") || prop(props, "name"));
			var templateUrl = String(prop(props, "templateUrl") || TEMPLATE_URL).trim();
			var ui = boolValue(prop(props, "ui"), false);
			var force = boolValue(prop(props, "force"), false);
			var dryRun = boolValue(prop(props, "dryRun"), false);
			var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
			var engine = Engine;
			var existing = loadedProject(engine, name);
			var shouldImport = existing == null || force;
			var result = {
				ok: true,
				project: name,
				templateUrl: templateUrl,
				ui: ui,
				force: force,
				dryRun: dryRun,
				imported: false,
				existing: existing != null,
				createdFlowEngine: false,
				configuredSvelte: false,
				saved: false
			};
			if (dryRun) {
				result.wouldImport = shouldImport;
				result.wouldCustomize = true;
				ctx.write(prop(props, "out") || "result", result);
				return result;
			}
			var project = shouldImport ? importTemplate(engine, name, templateUrl) : existing;
			result.imported = shouldImport;
			var resourceRoot = svelteResourceRoot(engine);
			var flow = ensureFlowEngine(project, ui, resourceRoot);
			result.createdFlowEngine = flow.created;
			result.configuredSvelte = flow.configuredSvelte;
			result.engineQName = String(flow.flowEngine.getEngineQName());
			if (ui) {
				result.frontbuilderReference = ensureFrontbuilderReference(engine, project);
				result.frontbuilderResourceRoot = resourceRoot;
			}
			engine.theApp.databaseObjectsManager.exportProject(project);
			result.saved = true;
			result.projectDir = String(project.getDirPath());
			refreshStudio(engine, name);
			ctx.write(prop(props, "out") || "result", result);
			return result;
		}
	};
}())
