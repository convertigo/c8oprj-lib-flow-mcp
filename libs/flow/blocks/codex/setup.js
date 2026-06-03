(function () {
	var File = Packages.java.io.File;
	var Files = Packages.java.nio.file.Files;
	var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
	var StandardOpenOption = Packages.java.nio.file.StandardOpenOption;
	var System = Packages.java.lang.System;

	var SERVER_NAME = "convertigo-flow";
	var SKILL_DIR_NAME = "convertigo-flow-mcp";
	var SKILL_DISPLAY_NAME = "ConvertigoFlowMCP";
	var DEFAULT_ENDPOINT = "http://localhost:18080/convertigo/api/flow-mcp";

	function trim(value) {
		return value == null ? "" : String(value).trim();
	}

	function bool(value) {
		return value === true || String(value).toLowerCase() === "true";
	}

	function readText(file) {
		if (!file || !file.isFile()) {
			return "";
		}
		return String(new java.lang.String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
	}

	function writeText(file, text) {
		Files.createDirectories(file.getParentFile().toPath());
		Files.write(
			file.toPath(),
			new java.lang.String(String(text == null ? "" : text)).getBytes(StandardCharsets.UTF_8),
			StandardOpenOption.CREATE,
			StandardOpenOption.TRUNCATE_EXISTING,
			StandardOpenOption.WRITE
		);
	}

	function resolveHome(path) {
		var raw = trim(path);
		if (!raw) {
			raw = "~/.codex";
		}
		var home = trim(System.getProperty("user.home"));
		if (raw === "~") {
			raw = home;
		} else if (raw.indexOf("~/") === 0 || raw.indexOf("~\\") === 0) {
			raw = home + raw.substring(1);
		}
		return new File(raw).getCanonicalFile();
	}

	function normalizeUrl(url) {
		return trim(url).replace(/\/+$/g, "");
	}

	function deriveEndpoint(input, warnings) {
		var explicit = normalizeUrl(input);
		if (explicit) {
			return explicit;
		}
		try {
			var EnginePropertiesManager = Packages.com.twinsoft.convertigo.engine.EnginePropertiesManager;
			var PropertyName = Packages.com.twinsoft.convertigo.engine.EnginePropertiesManager.PropertyName;
			var base = normalizeUrl(EnginePropertiesManager.getProperty(PropertyName.APPLICATION_SERVER_CONVERTIGO_URL));
			if (/\/api\/flow-mcp$/i.test(base)) {
				return base;
			}
			if (/\/convertigo$/i.test(base)) {
				return base + "/api/flow-mcp";
			}
			if (/\/convertigo\/api$/i.test(base)) {
				return base + "/flow-mcp";
			}
			if (base) {
				warnings.push("Resolved Flow MCP URL from APPLICATION_SERVER_CONVERTIGO_URL using /convertigo/api/flow-mcp.");
				return base + "/convertigo/api/flow-mcp";
			}
		} catch (e) {
			warnings.push("Unable to derive Flow MCP URL from Engine properties: " + String(e));
		}
		warnings.push("Falling back to the default local Flow MCP URL.");
		return DEFAULT_ENDPOINT;
	}

	function tomlEscape(value) {
		return String(value == null ? "" : value)
			.replace(/\\/g, "\\\\")
			.replace(/"/g, "\\\"");
	}

	function lines(text) {
		return String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
	}

	function sectionRange(sourceLines, sectionName) {
		var header = "[" + sectionName + "]";
		var start = -1;
		var end = sourceLines.length;
		for (var i = 0; i < sourceLines.length; i++) {
			if (trim(sourceLines[i]) === header) {
				start = i;
				break;
			}
		}
		if (start < 0) {
			return { found: false, start: -1, end: -1 };
		}
		for (var j = start + 1; j < sourceLines.length; j++) {
			if (/^\s*\[.+\]\s*$/.test(sourceLines[j])) {
				end = j;
				break;
			}
		}
		return { found: true, start: start, end: end };
	}

	function setSectionLine(sectionLines, key, line, insertIndex) {
		var pattern = new RegExp("^\\s*" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=");
		for (var i = 1; i < sectionLines.length; i++) {
			if (pattern.test(sectionLines[i])) {
				var changed = trim(sectionLines[i]) !== line;
				sectionLines[i] = line;
				return changed;
			}
		}
		sectionLines.splice(Math.min(insertIndex, sectionLines.length), 0, line);
		return true;
	}

	function patchConfigToml(existingText, endpoint) {
		var text = String(existingText == null ? "" : existingText).replace(/\r\n?/g, "\n");
		var sourceLines = lines(text);
		var section = "mcp_servers." + SERVER_NAME;
		var range = sectionRange(sourceLines, section);
		var urlLine = "url = \"" + tomlEscape(endpoint) + "\"";
		var timeoutLine = "startup_timeout_sec = 60";
		var enabledLine = "enabled = true";
		var status = "unchanged";

		if (!range.found) {
			if (sourceLines.length && trim(sourceLines[sourceLines.length - 1])) {
				sourceLines.push("");
			}
			sourceLines.push("[" + section + "]");
			sourceLines.push(urlLine);
			sourceLines.push(timeoutLine);
			sourceLines.push(enabledLine);
			return {
				status: text ? "updated" : "created",
				text: sourceLines.join("\n").replace(/\n+$/, "\n")
			};
		}

		var block = sourceLines.slice(range.start, range.end);
		if (setSectionLine(block, "url", urlLine, 1)) {
			status = "updated";
		}
		if (setSectionLine(block, "startup_timeout_sec", timeoutLine, 2)) {
			status = "updated";
		}
		if (setSectionLine(block, "enabled", enabledLine, 3)) {
			status = "updated";
		}
		var next = sourceLines.slice(0, range.start).concat(block).concat(sourceLines.slice(range.end)).join("\n").replace(/\n+$/, "\n");
		if (next === text.replace(/\n+$/, "\n")) {
			status = "unchanged";
		}
		return { status: status, text: next };
	}

	function writeManaged(file, content, dryRun) {
		var existed = file.isFile();
		var previous = readText(file);
		var next = String(content == null ? "" : content);
		if (previous === next) {
			return { status: "unchanged", existed: existed };
		}
		if (!dryRun) {
			writeText(file, next);
		}
		return { status: existed ? "updated" : "created", existed: existed };
	}

	function skillMarkdown(endpoint) {
		return [
			"---",
			"name: convertigo-flow-mcp",
			"description: Use Convertigo Flow MCP to inspect, create, edit, test, and run Convertigo Flow projects through a compact MCP-first workflow.",
			"---",
			"",
			"# " + SKILL_DISPLAY_NAME,
			"",
			"Use this skill when working with the experimental Convertigo Flow engine or the Flow-native MCP server.",
			"",
			"## Route",
			"",
			"- Prefer the `convertigo-flow` MCP server when the task concerns Flow, FlowEngine, Flow blocks, property types, Flow schemas, or Flow-native backend authoring.",
			"- Start with `resources/list`, then read `flow://guide/start` when available.",
			"- Use `tools/list` once, then prefer `flow-search`, `flow-tree`, `flow-catalog`, and targeted mutation tools over broad dumps.",
			"- Before editing, inspect the current Flow with `flow-tree` or `flow-get`; after editing, validate with `flow-test` or `flow-run`.",
			"- For project-local implementation files, prefer `flow-resource-get` then `flow-resource-patch` with the returned base hash.",
			"- Keep responses compact: request summaries first, expand only the relevant node, block, type, or resource.",
			"",
			"## Authoring Rules",
			"",
			"- Treat a Flow as a readable execution graph and a block as a reusable function with typed properties, slots, hooks, and an implementation.",
			"- Prefer existing blocks from the current provider/namespace before creating new blocks.",
			"- Create custom blocks only when the behavior is reusable or hides unavoidable low-level code.",
			"- Keep Rhino code small and localized inside block implementations; use Flow blocks for orchestration.",
			"- Do not edit generated or cached files unless an MCP tool explicitly returns them as writable Flow resources.",
			"",
			"## Local MCP Endpoint",
			"",
			"- Expected Codex MCP server: `convertigo-flow`.",
			"- Expected endpoint: `" + endpoint + "`.",
			"- If the endpoint changes, run `lib_flow_mcp._setupCodex` again.",
			""
		].join("\n");
	}

	function runSetup(options) {
		var opts = options || {};
		var warnings = [];
		var dryRun = bool(opts.dryRun);
		var endpoint = deriveEndpoint(opts.mcpUrl, warnings);
		var codexHome = resolveHome(opts.codexHome);
		var skillFile = new File(new File(new File(codexHome, "skills"), SKILL_DIR_NAME), "SKILL.md");
		var configFile = new File(codexHome, "config.toml");

		var skillWrite = writeManaged(skillFile, skillMarkdown(endpoint), dryRun);
		var existingConfig = readText(configFile);
		var patched = patchConfigToml(existingConfig, endpoint);
		if (patched.status !== "unchanged" && !dryRun) {
			writeText(configFile, patched.text);
		}

		return {
			ok: true,
			skillName: SKILL_DISPLAY_NAME,
			skillDirectoryName: SKILL_DIR_NAME,
			skillStatus: skillWrite.status,
			configStatus: patched.status,
			configServerName: SERVER_NAME,
			resolvedCodexHome: String(codexHome.getAbsolutePath()),
			resolvedMcpUrl: endpoint,
			skillPath: String(skillFile.getAbsolutePath()),
			configPath: String(configFile.getAbsolutePath()),
			dryRun: dryRun,
			warnings: warnings,
			nextSteps: [
				"Restart Codex to pick up skill or MCP configuration changes.",
				"Start a fresh Codex session and use the convertigo-flow-mcp skill for Flow work.",
				"Use the convertigo-flow MCP server for Flow-native project authoring."
			]
		};
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var result = runSetup({
				codexHome: ctx.render(props.codexHome || ""),
				mcpUrl: ctx.render(props.mcpUrl || ""),
				dryRun: props.dryRun === undefined || props.dryRun === "" ? false : ctx.expr(props.dryRun)
			});
			if (props.out) {
				ctx.write(props.out, result);
			}
			return result;
		}
	};
}())
