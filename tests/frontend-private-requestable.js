var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/_flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var engineFile = new java.io.File(engineDir, "Engine.js");
var engineSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(engineFile, "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
// The lookup is the only mocked boundary: the provider projection and MCP write path are real.
engineSource = engineSource.replace('function requestableInputContract(target, request) {',
 'function requestableInputContract(target, request) { if (target === ".Private" || target === ".Hidden") return {target:{kind:"flow",qname:"Headless"+target},accessibility:target === ".Private" ? "Private" : "Hidden",schema:{type:"object",properties:{}}};');
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
IO.writeStringToFile(new File(targetDir,'_flow/engine.yaml'),engineDefinition(home),'UTF-8');
function page(target){return [
 '<script module>export const _flow={sourceVersion:2};</script>',
 '<FlowComponent $$id="home">','<Events>','<OnMount><Actions>',
 '<CallSequence $$id="load" requestable="'+target+'" />',
 '</Actions></OnMount></Events>','<Structure />','</FlowComponent>'
].join('\n');}
if (!java.lang.Boolean.getBoolean('flow.test.revisionOnly')) {
var refused=callTool(1,'code-set',{projectDir:targetProjectDir,sourceFile:home,code:page('.Private')});
assertTrue(refused.error && refused.error.code==='FRONTEND_CALLSEQUENCE_PRIVATE','A real provider CallSequence towards Private must be refused: '+JSON.stringify(refused));
assertTrue(refused.error.details.line===5 && refused.error.details.property==='requestable' && /role/i.test(refused.error.hint), 'Private target needs source line, property and role guidance: '+JSON.stringify(refused));
assertTrue(!new File(targetDir,home).exists(),'Private CallSequence must not be written');
var hidden=callTool(2,'code-set',{projectDir:targetProjectDir,sourceFile:home,code:page('.Hidden')});
assertTrue(hidden.ok===true,'Hidden targets remain callable: '+JSON.stringify(hidden));
print('frontend-private-requestable OK (provider sourceKind, refused write, position and Hidden)');
}
var draft=callTool(3,'code-set',{projectDir:targetProjectDir,name:'Probe',code:'const _flow={sourceVersion:2};\nfunction Probe({result}) {\n result.ok=true\n}'});
var wrong='0000000000000000000000000000000000000000000000000000000000000000';
var promotion=callTool(4,'code-promote',{projectDir:targetProjectDir,name:'Probe',revision:wrong});
assertTrue(promotion.error && promotion.error.code==='FLOW_CODE_DRAFT_REVISION_MISMATCH' && promotion.error.message.indexOf(wrong)>=0 && promotion.error.message.indexOf(draft.revision)>=0 && !/changed since/.test(promotion.error.message),'MCP must keep exact received/current revisions without inventing a change: '+JSON.stringify(promotion));
assertTrue(promotion.error.details && promotion.error.details.receivedRevision===wrong && promotion.error.details.currentRevision===draft.revision && promotion.next.indexOf(draft.revision)>=0 && !/Patch the working copy/.test(promotion.next),'MCP must keep revision details and give a copy/review correction: '+JSON.stringify(promotion));
print('promote-revision-diagnostic OK');
