var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getAbsolutePath());
var __flowProjectDir = projectDir;
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/lib/mcp.js"), "UTF-8"));
var mcp = eval(source);

function assertTrue(value, message) {
	if (!value) {
		throw new Error(message);
	}
}

function requestContext(port) {
	return {
		convertigoContext: function () {
			return {
				httpServletRequest: {
					getHeader: function (name) {
						if (name === "X-Forwarded-Proto") return "http";
						if (name === "Host") return "127.0.0.1:18080";
						if (name === "X-Convertigo-Viewer-Debug-Port") return String(port || "");
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

assertTrue(managed.browserDebugPort === 40811,
	"The MCP transport header must override client-supplied viewer ports");
assertTrue(unmanaged.browserDebugPort === undefined,
	"Client-supplied viewer ports must be discarded without a managed transport header");

print("managed-viewer-transport OK");
