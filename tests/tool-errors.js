// Tool execution errors are readable CallToolResults; JSON-RPC errors are protocol-only.
var project = new java.io.File(arguments[0]).getCanonicalFile();
var mcp = eval(String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project, '_flow/lib/mcp.js'), 'UTF-8')));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function context(userAgent) { return {convertigoContext:function(){return {httpServletRequest:{getHeader:function(name){return name==='User-Agent'?userAgent:null;}}};}}; }
var request={jsonrpc:'2.0',id:17,method:'tools/call',params:{name:'code-get',arguments:{project:'Example'}}};
var error={code:'MISSING_FLOW_QNAME',message:'code-get requires a Flow qname.',hint:'Pass qname: Example.Flow.',details:{property:'qname',context:'text context',password:'never disclose'}};
function verify(answer,isError) {
  assert(answer.id===17 && answer.jsonrpc==='2.0' && !answer.error,'Tool execution must not be a JSON-RPC error');
  assert(answer.result.isError===isError,'Wrong client error flag');
  var e=answer.result.structuredContent.error;
  assert(e.code===error.code && e.message===error.message && e.hint===error.hint,'Lost readable code/message/hint');
  assert(e.details.property==='qname' && e.details.context==='text context','Lost free-form error details');
  assert(e.details.password==='[redacted]','Error details leaked a secret');
  assert(answer.result.content.some(function(c){return c.type==='text' && c.text.indexOf(error.code)>=0 && c.text.indexOf(error.message)>=0;}),'Text clients cannot see the code and cause');
}
var ordinary=mcp.toolError(request,error,context('codex_cli_rs/0.1'));
verify(ordinary,true);
verify(mcp.toolError(request,error,context('claude-code/2')),true);
var vibe=mcp.toolError(request,error,context('MistralAI-VibeCLI/1.0'));
verify(vibe,false);
verify(mcp.toolError(request,error,context('other MistralAI-VibeCLI/1.0')),true);
request.params.arguments.userAgent='MistralAI-VibeCLI/1.0';
verify(mcp.toolError(request,error,context('ordinary')),true);
var noContext=mcp.toolError(request,new Error('Unexpected failure'),{});
assert(noContext.result.isError===true && noContext.result.structuredContent.error.code==='FLOW_MCP_TOOL_ERROR','Unstructured exceptions need a stable fallback');
assert(noContext.result.structuredContent.error.hint==='' && noContext.result.structuredContent.error.details===null,'Every error has hint and details');
var structured=mcp.toolResponse(request,{ok:false,error:error,revision:'draft'},context('ordinary'));
verify(structured,true);
assert(structured.result.structuredContent.revision==='draft','Error conversion lost draft recovery metadata');
assert(!mcp.toolResponse(request,{ok:true,result:{error:'application domain value'}},{}).result.isError,'Nested domain error became a tool error');
var protocol=mcp.jsonRpcError(17,-32601,'Unknown method',{code:'METHOD_NOT_FOUND'});
assert(protocol.error.code===-32601 && !protocol.result,'Protocol error must remain JSON-RPC');
var resource=mcp.toolError({id:17,method:'resources/read'},error,{});
assert(resource.error && !resource.result,'Non-tool resource errors must remain protocol errors');
var schema=mcp.toolOutputSchema({type:'object',properties:{answer:{type:'integer'}},required:['answer'],additionalProperties:false});
assert(schema.type==='object' && schema.properties.error.type==='object','Output schema must expose a free error object');
assert(schema.anyOf[0].required[0]==='answer' && schema.anyOf[0].additionalProperties===false,'Success schema strictness changed');
assert(schema.anyOf[1].required[0]==='error','The error branch must not accept an arbitrary empty result');
// The dispatch boundary catches errors thrown before a private tool wrapper, while legacy answers retain identity.
var dispatcherSource=String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project,'_flow/blocks/mcp/tools/call.block.js'),'UTF-8'));
var dispatcher=eval(dispatcherSource.substring(dispatcherSource.indexOf('\n(function () {')));
var ctx=context('ordinary');
ctx.props=function(node){return node.props;};ctx.lib=function(){return mcp;};ctx.write=function(){};
ctx.blockNames=function(){return ['mcp.tool.code.get'];};
ctx.callBlock=function(){throw error;};
verify(dispatcher.run(ctx,{props:{request:request}}),true);
ctx.callBlock=function(){return mcp.jsonRpcError(17,-32000,error.message,error);};
verify(dispatcher.run(ctx,{props:{request:request}}),true);
ctx.blockNames=function(){throw error;};
// block catalog lookup itself is also part of tool execution.
try { var unexpected=dispatcher.run(ctx,{props:{request:request}}); verify(unexpected,true); }
catch (e) { assert(false,'Catalog lookup exception escaped tools/call: '+e); }
var legacy={jsonrpc:'2.0',id:17,error:{code:-32000,message:'Legacy response stays unchanged'}};
var relayMcp={requestValue:mcp.requestValue,legacyRelayTool:function(){return true;},legacyRelayCall:function(){return legacy;}};
ctx.blockNames=function(){return [];};ctx.lib=function(){return relayMcp;};
assert(dispatcher.run(ctx,{props:{request:request}})===legacy,'Legacy JSON-RPC response was rewrapped');
print('tool-errors OK ('+checks+' checks)');
if(String(arguments[1]||'')==='--schemas') print('SCHEMA_FIXTURES:'+JSON.stringify({schema:schema,generic:mcp.toolOutputSchema(),ordinary:ordinary.result.structuredContent,vibe:vibe.result.structuredContent}));
