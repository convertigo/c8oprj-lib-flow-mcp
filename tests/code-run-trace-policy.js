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

var __flowEngineDir=String(new java.io.File(arguments[1]).getCanonicalPath());
var __flowProjectDir=String(project);
var io=Packages.org.apache.commons.io.FileUtils;
var engine=eval(String(io.readFileToString(new java.io.File(__flowEngineDir,'Engine.js'),'UTF-8')));
var router=String(io.readFileToString(new java.io.File(project,'_flow/flows/McpServer.flow.js'),'UTF-8'));
var temp=java.nio.file.Files.createTempDirectory('code-run-precision-').toFile();
try {
 var decimal='12.5', integer='123456789012345678901234567890';
 var flow='const _flow = { sourceVersion: 3, accessibility: "public" }\n'+
  'function Numbers({ input, result }) {\n return test.numbers({})\n}\n';
 io.writeStringToFile(new java.io.File(temp,'_flow/blocks/test/numbers.block.js'),
  'const _meta = {sourceVersion: 2, description: "Java numbers", runtime: "rhino"}\n'+
  '({run: function () { return { values: [new java.math.BigDecimal("'+decimal+'"), new java.math.BigInteger("'+integer+'"), '+
  'new java.math.BigDecimal("1E+400")] }; }})','UTF-8');
 io.writeStringToFile(new java.io.File(temp,'_flow/flows/Numbers.flow.js'),flow,'UTF-8');
 var args={name:'Numbers',projectDir:String(temp)};
 var call={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'code-run',arguments:args}};
 var execution=JSON.parse(engine.run(JSON.stringify({flowSource:router,includeTrace:false,input:{request:JSON.stringify(call)}})));
 var run=execution.result && execution.result.result && execution.result.result.structuredContent;
 var expected={values:[12.5,Number(integer),null]};
 assert(run && run.ok && JSON.stringify(run.result)===JSON.stringify(expected),'code-run returns Java numbers as JSON numbers: '+JSON.stringify(run));
 // Exercise the same detachment, result projection and JSON writer as a native .json request.
 var cx=Packages.org.mozilla.javascript.Context.getCurrentContext(), scope=this;
 var detached;
 function detach() { throw Error('Expected the native detachment policy'); }
 detach.sanitize=function(payload, policy) {
  detached=Packages.com.twinsoft.convertigo.engine.util.SanitizedJson.map(payload,cx,scope,policy);
 };
 __flowProjectDir=String(temp);
 engine.runObject(JSON.stringify({flowSource:flow,flowName:'Numbers',includeTrace:false}),detach);
 assert(detached && String(detached.get('ok'))==='true','native Flow runs successfully: '+String(detached));
 var projected=Packages.com.twinsoft.convertigo.engine.flow.NativeJsonSupport.projectResult(detached.get('result'),'item');
 var json=String(Packages.com.twinsoft.convertigo.engine.util.RhinoUtils.jsonStringify(projected));
 assert(JSON.stringify(JSON.parse(json))===JSON.stringify(expected),'native HTTP JSON writing emits both numbers and null for overflow: '+json);
} finally { io.deleteDirectory(temp); }

var dataHint='Pass signed base-10 text, for example "42", instead of a JavaScript number.';
var sqlHint='Pass a safe integer number (from -9007199254740991 to 9007199254740991) or the exact base-10 text, "42" or "9007199254740993".';
function encoding(message,hint) {
 return mcp.toolError({id:1,method:'tools/call',params:{name:'code-run',arguments:{}}},
  {code:'DATA_INT64_ENCODING',message:message,hint:hint}).result;
}
var dataMessage='int64 must be exact base-10 text, never a JavaScript number.';
var sqlMessage='Parameter offset of query list: 9007199254740992 is not a safe integer number.';
[[dataMessage,dataHint],[sqlMessage,sqlHint]].forEach(function(test) {
 var response=encoding(test[0],test[1]);
 assert(response.isError && response.structuredContent.error.hint===test[1] && response.content[0].text.indexOf(test[1])>=0,
  'Keep the provider hint for '+test[0]);
});
assert(/\{id: "42"\}/.test(encoding(dataMessage).structuredContent.error.hint) &&
 !encoding(sqlMessage).structuredContent.error.hint,'Only a Data error without a hint gets the Data fallback');
print('code-run-trace-policy OK ('+checks+' checks)');
