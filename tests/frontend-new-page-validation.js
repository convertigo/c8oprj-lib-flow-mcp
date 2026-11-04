var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/_flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var engineFile = new java.io.File(engineDir, "Engine.js");
var engineSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(engineFile, "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(engineSource);
var mcpFlowSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
var targetDir = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"),
	"lib_flow_mcp_authoring_" + java.lang.System.currentTimeMillis());
targetDir.mkdirs();
var targetProjectDir = String(targetDir.getAbsolutePath());
var routeRoot = new java.io.File(targetDir, "_flow/frontbuilder/svelte/model/Headless/src/routes");
var resourceRoot = String(java.lang.System.getenv("FLOW_FRONTBUILDER_RESOURCE_ROOT") || "");

function assertTrue(condition, message) {
	if (!condition) throw new Error(message);
}

function callTool(id, name, args) {
	var response = JSON.parse(engine.run(JSON.stringify({
		flowSource: mcpFlowSource,
		includeTrace: false,
		input: {
			request: JSON.stringify({
				jsonrpc: "2.0",
				id: id,
				method: "tools/call",
				params: { name: name, arguments: args }
			})
		}
	})));
	assertTrue(response.result && response.result.result && response.result.result.structuredContent,
		name + " failed: " + JSON.stringify(response));
	return response.result.result.structuredContent;
}

function engineDefinition(sourceFile) {
	return [
		"version: 1",
		"config:",
		"  frontbuilder:",
		"    svelte:",
		"      target: svelte5",
		"      resourceRoot: " + resourceRoot,
		"      modelPath: " + sourceFile,
		""
	].join("\n");
}

function findNode(node, predicate) {
	if (!node) return null;
	if (predicate(node)) return node;
	var children = node.children || [];
	for (var index = 0; index < children.length; index++) {
		var found = findNode(children[index], predicate);
		if (found) return found;
	}
	return null;
}

var IO=Packages.org.apache.commons.io.FileUtils,File=java.io.File;
var home='_flow/frontbuilder/svelte/model/Headless/src/routes/+page.flow.svelte';
IO.writeStringToFile(new File(targetDir,home),'<script module>export const _flow={sourceVersion:2};</script><FlowComponent $$id="home"><Structure /></FlowComponent>','UTF-8');
IO.writeStringToFile(new File(targetDir,'_flow/engine.yaml'),engineDefinition(home),'UTF-8');
var file='_flow/frontbuilder/svelte/model/Headless/src/routes/new/+page.flow.svelte';
function rejected(code,expected){var out=callTool(1,'frontend-svelte-code-set',{project:'target',projectDir:targetProjectDir,sourceFile:file,code:code});
 assertTrue(out.error && (out.error.code===expected || JSON.stringify(out).indexOf(expected)>=0),'new code-set must reject '+expected+': '+JSON.stringify(out));
 assertTrue(!new File(targetDir,file).exists(),'refused new page must not be written');}
var header='<script module>export const _flow={sourceVersion:2};</script><FlowComponent $$id="new">';
rejected(header+'<Structure><Text variant="h1" /></Structure></FlowComponent>','FRONTEND_PROPERTY_VALUE_INVALID');
rejected(header+'<Variables><State $$id="st" type="object" value={null} /></Variables><Events><OnMount><Actions><If $$id="hasSession" test={window.sessionReady()}><Then><SetValue target="st" value={"text" + page.st} /></Then></If></Actions></OnMount></Events><Structure /></FlowComponent>','FRONTEND_ACTION_EXPRESSION_NOT_PORTABLE');
print('frontend-new-page-validation OK');
