var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getAbsolutePath());
var __flowProjectDir = projectDir;
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/lib/mcp.js"), "UTF-8"));
var mcp = eval(source);

function readProjectFile(relativePath) {
	return String(Packages.org.apache.commons.io.FileUtils.readFileToString(
		new java.io.File(projectDir, relativePath), "UTF-8"));
}

function assertTrue(value, message) {
	if (!value) {
		throw new Error(message);
	}
}

function requestContext(port, revealMode) {
	return {
		convertigoContext: function () {
			return {
				httpServletRequest: {
					getHeader: function (name) {
						if (name === "X-Forwarded-Proto") return "http";
						if (name === "Host") return "127.0.0.1:18080";
						if (name === "X-Convertigo-Viewer-Debug-Port") return String(port || "");
						if (name === "X-Convertigo-Reveal-Mode") return revealMode ? "true" : "";
						return null;
					},
					getScheme: function () { return "http"; },
					getServerName: function () { return "127.0.0.1"; },
					getServerPort: function () { return 18080; },
					getContextPath: function () { return "/convertigo"; }
				}
			};
		}
	};
}

var managed = mcp.prepareToolArguments(requestContext(40811), {
	params: {
		name: "frontend-svelte-action",
		arguments: {
			project: "Clock",
			actionId: "dev.open",
			browserDebugPort: 49999
		}
	}
}, { resolveProject: false });

var unmanaged = mcp.prepareToolArguments(requestContext(0), {
	params: {
		name: "frontend-svelte-action",
		arguments: {
			project: "Clock",
			actionId: "dev.open",
			browserDebugPort: 49999
		}
	}
}, { resolveProject: false });

var ensured = mcp.prepareToolArguments(requestContext(40811), {
	params: {
		name: "frontend-svelte-action",
		arguments: {
			project: "Clock",
			actionId: "dev.ensure",
			wait: false
		}
	}
}, { resolveProject: false });

var managedReveal = mcp.prepareToolArguments(requestContext(40811, true), {
	params: {
		name: "code-set",
		arguments: { project: "Clock", sourceFile: "libs/flow/frontbuilder/svelte/model/Clock/src/routes/+page.flow.svelte" }
	}
}, { resolveProject: false });

var explicitNoReveal = mcp.prepareToolArguments(requestContext(40811, true), {
	params: {
		name: "code-patch",
		arguments: {
			project: "Clock",
			sourceFile: "libs/flow/frontbuilder/svelte/model/Clock/src/routes/+page.flow.svelte",
			reveal: false
		}
	}
}, { resolveProject: false });

var unmanagedReveal = mcp.prepareToolArguments(requestContext(40811, false), {
	params: {
		name: "code-set",
		arguments: { project: "Clock", sourceFile: "libs/flow/frontbuilder/svelte/model/Clock/src/routes/+page.flow.svelte" }
	}
}, { resolveProject: false });

assertTrue(managed.browserDebugPort === 40811,
	"The MCP transport header must override client-supplied viewer ports");
assertTrue(unmanaged.browserDebugPort === undefined,
	"Client-supplied viewer ports must be discarded without a managed transport header");
assertTrue(ensured.actionId === "frontbuilder.svelte.dev.start" &&
	ensured.action.id === "frontbuilder.svelte.dev.start" && ensured.wait === false,
	"dev.ensure must stay an idempotent public alias for the existing dev start contract");
assertTrue(managedReveal.reveal === true,
	"Managed reveal mode must default canonical frontend source writes to reveal=true");
assertTrue(explicitNoReveal.reveal === false,
	"An explicit reveal=false must override the managed reveal default");
assertTrue(unmanagedReveal.reveal === undefined,
	"Unmanaged transports must not change frontend source reveal behavior");

[
	"libs/flow/blocks/mcp/tool/frontend/svelte/code/set.block.js",
	"libs/flow/blocks/mcp/tool/frontend/svelte/code/patch.block.js"
].forEach(function (relativePath) {
	var descriptor = readProjectFile(relativePath);
	assertTrue(/"reveal"\s*:\s*\{[^}]*"type"\s*:\s*"boolean"/.test(descriptor),
		"The private frontend write block must preserve reveal through dispatch: " + relativePath);
	assertTrue(/"reveal"\s*:\s*\{[^}]*"kind"\s*:\s*"literal"/.test(descriptor),
		"The private frontend write block must use the backend literal kind for reveal: " + relativePath);
	assertTrue(/args\s*:\s*\{[^}]*reveal\s*:\s*input\.reveal/.test(descriptor),
		"The private frontend write block must forward reveal to the source operation: " + relativePath);
});
assertTrue(/reveal\s*:\s*internalArgs\.reveal/.test(readProjectFile(
	"libs/flow/blocks/mcp/tool/code/dispatch.block.js")),
	"The unified code dispatcher must bind reveal on the private frontend write block");

print("managed-viewer-transport OK");
