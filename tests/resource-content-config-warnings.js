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
var document={version:1,config:{frontbuilder:{svelte:{modelPath:'_flow/frontbuilder/svelte/model/Headless/src/routes/+page.flow.svelte'}}},configVisibility:{frontbuilder:'private'}};
IO.writeStringToFile(new File(targetDir,'_flow/engine.yaml'),JSON.stringify(document),'UTF-8');
var before=callTool(1,'flow-resource-get',{projectDir:targetProjectDir,path:'_flow/engine.yaml'});
var patched=callTool(2,'flow-resource-patch',{projectDir:targetProjectDir,path:'_flow/engine.yaml',baseHash:before.hash,content:JSON.stringify({version:1,config:{}})+'\n'});
assertTrue(patched.ok && patched.mode==='content','content replacement succeeds with explicit warning');
assertTrue(patched.warnings.some(function(w){return w.code==='PROJECT_CONFIG_KEYS_REMOVED' && w.properties.indexOf('config.frontbuilder.svelte.modelPath')>=0;}),'wrapper must retain engine removal warning alongside newline notes: '+JSON.stringify(patched));
assertTrue(patched.warnings.some(function(w){return typeof w==='string' && /final new line/.test(w);}), 'the wrapper note is retained too');
print('resource-content-config-warnings OK');
