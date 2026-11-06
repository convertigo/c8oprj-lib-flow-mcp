// Export real public descriptors and finalized responses for the JSON Schema contract test.
var projectDir = String(arguments[0]), engineDir = String(arguments[1]);
var io = Packages.org.apache.commons.io.FileUtils;
var __flowProjectDir = String(new java.io.File(projectDir).getCanonicalPath());
var __flowEngineDir = String(new java.io.File(engineDir).getCanonicalPath());
Packages.com.twinsoft.convertigo.engine.EnginePropertiesManager.initProperties();
function read(path) { return String(io.readFileToString(new java.io.File(projectDir, path), 'UTF-8')); }
var engine = eval(String(io.readFileToString(new java.io.File(engineDir, 'Engine.js'), 'UTF-8')));
var source = read('_flow/flows/McpServer.flow.js'), mcp = eval(read('_flow/lib/mcp.js'));
function call(method, params) {
  var execution = JSON.parse(engine.run(JSON.stringify({flowSource:source, includeTrace:false,
    input:{request:JSON.stringify({jsonrpc:'2.0',id:1,method:method,params:params || {}})}})));
  if (!execution.ok || execution.result.error) throw Error(JSON.stringify(execution));
  return execution.result.result;
}
var tools = call('tools/list').tools, cases = [];
function add(name, label, result) { cases.push({name:name, label:label, result:result}); }
// Exercise every public tool through the shared compaction/finalization boundary. Domain IO is
// deliberately not executed: mutation tools must not touch real projects in a protocol test.
tools.forEach(function(tool) {
  [{}, {detail:'full'}, {detail:'compact',kind:'source'}, {format:'text'},
   {detail:'full',includeDefinition:true,maxDepth:9}, {startLine:1,endLine:1}].forEach(function(args, index) {
    var request = {id:1,method:'tools/call',params:{name:tool.name,arguments:args}};
    var value = {ok:true,text:'# Test document\nComplete body\n',content:'# Test document\nComplete body\n',
      source:'resources/read',code:'result.answer = 42\n',revision:'fixture',
      flows:[],items:[],diagnostics:[],result:{answer:42},
      normalizations:[{property:'example',after:true}],argumentWarning:'Example notice',operatorNote:'Example note',
      experience:{reason:'domain',drawer:'flow://experience/backend',entries:[{id:'example',text:'Example advice'}]}};
    var response = mcp.toolResponse(request, value, {});
    add(tool.name, 'success-'+index, response.result);
    add(tool.name, 'finalized-twice-'+index, mcp.finalizeResponse({},request,response).result);
    add(tool.name, 'error-'+index, mcp.toolError(request,{code:'TEST_ERROR',message:'Expected refusal'},{}).result);
    add(tool.name, 'failed-'+index, mcp.toolResponse(request,{ok:false,content:'Expected failure'},{}).result);
  });
});
// Real router success and error paths for guide, skill and ACE reads, including the default.
['flow://guide/start','flow://skills/convertigo-flow-mcp/SKILL','flow://ace'].forEach(function(uri) {
  [undefined,'text','structured'].forEach(function(format) {
    add('flow-resource-get',uri+' '+String(format),call('tools/call',{
      name:'flow-resource-get',arguments:{uri:uri,format:format}}));
  });
});
add('flow-resource-get','missing-resource',call('tools/call',{
  name:'flow-resource-get',arguments:{uri:'flow://guide/does-not-exist',format:'text'}}));
add('code-get','missing-qname',call('tools/call',{name:'code-get',arguments:{projectDir:projectDir}}));
// A tool-specific success schema, with the error alternative every declared schema gets, guards the guard below; the
// generic schema (any object) must not be declared by any tool.
var sampleOutputSchema = mcp.toolOutputSchema({type:'object',properties:{ok:{type:'boolean'},result:{type:'object'}},required:['ok']});
print('OUTPUT_CONTRACT:'+JSON.stringify({tools:tools,cases:cases,sampleOutputSchema:sampleOutputSchema,genericOutputSchema:mcp.toolOutputSchema()}));
java.lang.System.exit(0);
