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

var schema=JSON.parse(engine.run(JSON.stringify({flowSource:mcpFlowSource,input:{request:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}}))).result.result.tools;
['authoring-mutate','frontend-svelte-mutate'].forEach(function(name){var tool=schema.filter(function(t){return t.name===name;})[0];assertTrue(tool.inputSchema.properties.action && tool.inputSchema.properties.action.type==='object',name+' schema declares palette action');
 [ {},{mutation:{op:'insert',path:'frontends.svelte.routes'}},{mutations:[{op:'insert',path:'frontends.svelte.routes'}]} ].forEach(function(shape){var out=callTool(2,name,Object.assign({projectDir:targetProjectDir,op:'ignored'},shape));assertTrue(out.error && /^AUTHORING_/.test(out.error.code) && out.argumentWarning && /op/.test(out.argumentWarning),'shape and ignored arguments must be actionable: '+JSON.stringify(out));});});
var invalidName=callTool(3,'authoring-mutate',{projectDir:targetProjectDir,name:'bad name',mutation:{op:'replace',path:'nodes',value:[]}});
assertTrue(invalidName.error && invalidName.error.code==='INVALID_FLOW_NAME','INVALID_FLOW_NAME is reserved for an actual invalid Flow name: '+JSON.stringify(invalidName));
print('authoring-mutate-shapes OK');
