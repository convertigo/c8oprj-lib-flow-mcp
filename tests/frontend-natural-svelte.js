var projectDir = String(arguments[0]);
var engineDir = String(arguments[1]);
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

function checked(code) { return callTool(2,'frontend-svelte-code-check',{project:'target',projectDir:targetProjectDir,sourceFile:file,code:code,responseDetail:'full'}); }
var state='<Variables><State $$id="count" value={0} /><State $$id="name" value="Ada" /></Variables>';
var natural=header+state+'<Structure><h1>{page.name}</h1><Input $$id="nameInput" bind:value={page.name} /><button $$id="add" onclick={() => page.count = page.count + 1}>Add</button>{#if page.count > 0}<p>{page.count}</p>{/if}</Structure></FlowComponent>';
var accepted=checked(natural);
assertTrue(accepted.ok===true,'natural Svelte must pass actual MCP contracts: '+JSON.stringify(accepted));
var broken=natural.replace('{#if page.count','{#if @page.count');
var syntax=checked(broken);
assertTrue(syntax.ok===false,'syntax stays refused');
var sd=syntax.diagnostics.filter(function(d){return d.svelte;})[0];
assertTrue(sd && sd.line && sd.column && sd.svelte.code,'Svelte diagnostic must retain coordinates and code: '+JSON.stringify(syntax));
// Attribute form has a mechanical exact patch; malformed block syntax need not be guessed.
var attr=header+state+'<Structure><Text text={@page.name} /></Structure></FlowComponent>';
var invalid=checked(attr), proposal=invalid.proposedPatch;
assertTrue(proposal && proposal.edits[0].oldText===attr,'exact submitted-source patch: '+JSON.stringify(invalid));
assertTrue(checked(proposal.edits[0].newText).ok===true,'proposed patch must pass actual compiler');
rejected(attr,'FRONTEND_SOURCE_INVALID');
var htmlBad=header+'<Structure><div invented="x">Text</div></Structure></FlowComponent>';
rejected(htmlBad,'FRONTEND_PROPERTY_UNKNOWN');
var layout=header+'<Structure><RowLayout justify="between" /></Structure></FlowComponent>';
var fix=checked(layout).proposedPatch;
assertTrue(fix && checked(fix.edits[0].newText).ok===true,'layout enum correction is exact and applicable: '+JSON.stringify(checked(layout)));
var portable=header+state+'<Events><OnMount><Actions><NumberAdd $$id="sum" left={1} right={2} target="page.count" /></Actions></OnMount></Events><Structure /></FlowComponent>';
var result=checked(portable);
assertTrue(result.proposedPatch && result.proposedPatch.edits[0].newText.indexOf('$$out')>=0,'portable target diagnostic offers output patch: '+JSON.stringify(result));
print('frontend-natural-svelte OK');
