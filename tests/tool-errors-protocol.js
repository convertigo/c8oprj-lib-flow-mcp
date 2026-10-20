// Exercise the public router: parse/method errors stay JSON-RPC, tool failures stay CallToolResult.
var engineDir=arguments[0], projectDir=arguments[1];
var FileUtils=Packages.org.apache.commons.io.FileUtils;
var __flowEngineDir=String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir=String(new java.io.File(projectDir).getAbsolutePath());
var engine=eval(String(FileUtils.readFileToString(new java.io.File(engineDir,'Engine.js'),'UTF-8')));
var source=String(FileUtils.readFileToString(new java.io.File(projectDir,'_flow/flows/McpServer.flow.js'),'UTF-8'));
var checks=0;
function assert(value,message){checks++;if(!value)throw new Error(message);}
function call(raw){var execution=JSON.parse(engine.run(JSON.stringify({flowSource:source,includeTrace:false,input:{request:typeof raw==='string'?raw:JSON.stringify(raw)}})));assert(execution.ok===true,'Router crashed: '+JSON.stringify(execution));return execution.result;}
var missing=call({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'code-get',arguments:{projectDir:__flowProjectDir}}});
assert(!missing.error && missing.result.isError===true && missing.result.structuredContent.error.code==='MISSING_FLOW_QNAME','Missing qname must be a tool error');
var invalid=call('{');
assert(invalid.id===null && invalid.error.code===-32700 && !invalid.result,'Invalid JSON must be a parse error');
var method=call({jsonrpc:'2.0',id:2,method:'unknown/method'});
assert(method.id===2 && method.error.code===-32601 && !method.result,'Unknown method must be a protocol error');
var unknown=call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'missing-tool',arguments:{}}});
assert(unknown.id===3 && unknown.result.isError===true && !unknown.error,'Unknown tool is not an unknown protocol method');
var tools=call({jsonrpc:'2.0',id:4,method:'tools/list'}).result.tools;
var own=tools.filter(function(t){return !/Relayed to the Convertigo MCP/.test(t.description||'');});
assert(own.length>=40,'Expected the real Flow catalog');
own.forEach(function(t){assert(t.outputSchema && t.outputSchema.type==='object' && t.outputSchema.properties.error.type==='object',t.name+' output schema rejects errors');});
var authSource='const _flow={sourceVersion:2,inputs:{request:{type:"object"}}}\nfunction Auth({input,config,result}) {\n local.response=mcp.handle({request:input.request})\n return({value:local.response})\n}\n';
var auth=JSON.parse(engine.run(JSON.stringify({flowSource:authSource,includeTrace:false,input:{request:{jsonrpc:'2.0',id:5,__flowMcpAuthenticationError:{code:'missing_token',message:'Bearer required'}}}})));
assert(auth.ok===true && auth.result.error.code===-32001 && !auth.result.result,'Authentication must remain a JSON-RPC error');
assert(auth.result.error.data.code==='missing_token','Authentication diagnostic was left as an unevaluated template');
print('tool-errors-protocol OK ('+checks+' checks, '+own.length+' Flow schemas)');
