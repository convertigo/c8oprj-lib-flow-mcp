// A relayed call answers before an MCP client drops it for 300 s of silence: the relay waits less than that, then
// answers LEGACY_RELAY_TIMEOUT with what it may have waited for. Only the HTTP transport is stubbed.
var project=new java.io.File(arguments[0]).getCanonicalFile(),realPackages=Packages,seen=[],mode='timeout';
var client={send:function(request){seen.push(request);if(mode==='timeout')throw new Error('java.net.http.HttpTimeoutException: request timed out');
	if(mode==='refused')throw new Error('java.net.ConnectException: Connection refused');
	return {statusCode:function(){return 200;},body:function(){return JSON.stringify({jsonrpc:'2.0',id:7,result:{content:[{type:'text',text:'ok'}],structuredContent:{status:'ok'}}});}};}};
var Packages={java:{io:realPackages.java.io,nio:realPackages.java.nio,lang:realPackages.java.lang,util:realPackages.java.util,time:realPackages.java.time,net:{URI:realPackages.java.net.URI,http:{HttpTimeoutException:realPackages.java.net.http.HttpTimeoutException,HttpRequest:{newBuilder:function(uri){var request={url:String(uri),headers:{}};var builder={timeout:function(duration){request.timeoutSeconds=Number(duration.getSeconds());return builder;},header:function(name,value){request.headers[name]=String(value);return builder;},POST:function(body){request.body=String(body);return builder;},build:function(){return request;}};return builder;},BodyPublishers:{ofString:function(text){return text;}}},HttpClient:{newBuilder:function(){var builder={connectTimeout:function(){return builder;},build:function(){return client;}};return builder;}},HttpResponse:{BodyHandlers:{ofString:function(){return {};}}}}}},org:realPackages.org,com:realPackages.com};
var mcp=eval(String(realPackages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project,'_flow/lib/mcp.js'),'UTF-8')));
var ctx={convertigoContext:function(){return {httpServletRequest:{getScheme:function(){return 'http';},getLocalPort:function(){return 28080;},getContextPath:function(){return '/convertigo';},getHeader:function(){return null;}}};}};
function call(args){return mcp.legacyRelayCall(ctx,{jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'requestable-execute',arguments:args}});}
function fail(message,value){throw new Error(message+': '+JSON.stringify(value));}

var answer=call({requestable:'SampleProject.runCheck',variables:{dryRun:true}});
var error=answer.result&&answer.result.structuredContent&&answer.result.structuredContent.error;
if(seen.length!==1)fail('A timed out relay must not be sent again',seen.length);
if(!(seen[0].timeoutSeconds>0&&seen[0].timeoutSeconds<300))fail('The relay must wait less than the 300 s an MCP client gives a silent call',seen[0].timeoutSeconds);
if(!error||error.code!=='LEGACY_RELAY_TIMEOUT')fail('A relay timeout must answer LEGACY_RELAY_TIMEOUT',answer);
if(answer.result.isError!==true)fail('A relay timeout is a tool error',answer.result);
if(error.message.indexOf('requestable-execute')<0||error.message.indexOf(String(seen[0].timeoutSeconds)+' s')<0)fail('The message names the tool and the wait',error.message);
if(!/code-run/.test(error.hint)||!/__sequence=/.test(error.hint)||!/once/.test(error.hint))fail('The hint gives the other proofs and one retry',error.hint);
if(error.details.tool!=='requestable-execute'||error.details.waitedSeconds!==seen[0].timeoutSeconds)fail('details name the tool and the wait',error.details);
if(error.details.studioMode!==false||error.details.projectFlagLock===undefined)fail('details read the project of the requestable without a Studio',error.details);
if(!/Convertigo MCP did not answer/.test(answer.result.content[0].text))fail('The text content says why',answer.result.content);

java.lang.System.setProperty('convertigo.flow.mcp.legacyRelayTimeoutSeconds','900');
seen=[];call({requestable:'SampleProject.runCheck'});
if(!(seen[0].timeoutSeconds<300))fail('A configured wait stays under 300 s',seen[0].timeoutSeconds);
java.lang.System.setProperty('convertigo.flow.mcp.legacyRelayTimeoutSeconds','30');
seen=[];call({project:'SampleProject'});
if(seen[0].timeoutSeconds!==30)fail('A shorter configured wait is kept',seen[0].timeoutSeconds);
java.lang.System.clearProperty('convertigo.flow.mcp.legacyRelayTimeoutSeconds');

mode='refused';seen=[];answer=call({requestable:'SampleProject.runCheck'});
error=answer.result.structuredContent.error;
if(error.code==='LEGACY_RELAY_TIMEOUT'||error.message.indexOf('Convertigo MCP relay failed')<0)fail('Other transport failures keep their own message',error);
mode='ok';seen=[];answer=call({requestable:'SampleProject.runCheck'});
if(answer.result.structuredContent.status!=='ok')fail('An answer in time is relayed as it is',answer);
print('legacy-relay-timeout OK (bounded wait under 300 s, LEGACY_RELAY_TIMEOUT with hint and details, other failures unchanged)');
