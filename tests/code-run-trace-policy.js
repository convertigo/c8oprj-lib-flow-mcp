// Compact MCP runs must not allocate snapshots which the response discards.
var project=new java.io.File(arguments[0]).getCanonicalFile();
var source=String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project,'_flow/lib/mcp.js'),'UTF-8'));
var mcp=eval(source),checks=0;
function assert(v,m){checks++;if(!v)throw new Error(m);}
function prepare(name,args){return mcp.prepareToolArguments(null,{params:{name:name,arguments:args||{}}},{resolveProject:false});}
['code-run','flow-code-run'].forEach(function(name){
 assert(prepare(name,{}).includeTrace===false,'Compact default must skip trace capture');
 assert(prepare(name,{includeTrace:true}).includeTrace===true,'Explicit compact trace must remain enabled');
 assert(prepare(name,{includeTrace:false}).includeTrace===false,'Explicit no-trace must remain disabled');
 assert(prepare(name,{includeFullTrace:true}).includeTrace===true,'Full trace alias must enable capture');
 assert(prepare(name,{fullTrace:true}).includeTrace===true,'Legacy full trace alias must enable capture');
 assert(prepare(name,{includeFullResponse:true}).includeTrace===undefined,'Full response must keep its default engine semantics');
});
assert(prepare('flow-test',{}).includeTrace===undefined,'Other APIs must retain their trace policy');
print('code-run-trace-policy OK ('+checks+' checks)');
