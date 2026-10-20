// Corrections are an audit trail, including in the default compact response.
var project = new java.io.File(arguments[0]).getCanonicalFile();
var mcp = eval(String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project, '_flow/lib/mcp.js'), 'UTF-8')));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var code = new Array(240).join('// keep the complete corrected source\n') + 'function Sample({result}) { result.value = 1 }';
var fixes = [];
for (var index=0;index<30;index++) fixes.push({code:'FLOWSCRIPT_BLOCK_CALL_LIFTED',line:index+1,before:new Array(200).join('before '),after:new Array(200).join('after ')});
function response(name, value, args) { return mcp.toolResponse({id:1,params:{name:name,arguments:args||{}}},value,{}).result.structuredContent; }
['code-set','code-patch','code-promote','flow-block-code-set','flow-block-code-patch'].forEach(function(name) {
  var out = response(name,{ok:true,revision:'checked',code:code,fixes:fixes,warnings:[]});
  assert(out.code === code,name+' truncated the corrected source');
  assert(JSON.stringify(out.fixes) === JSON.stringify(fixes),name+' dropped or truncated a correction');
});
var refused = response('code-set',{ok:false,draft:true,revision:'checked',code:code,fixes:fixes,error:{code:'UNKNOWN_BLOCK',message:'Unknown block'}});
assert(refused.code === code && refused.fixes.length === 30 && refused.error.code === 'UNKNOWN_BLOCK','A refusal must not hide corrections applied to its draft');
var run = response('code-run',{ok:true,draft:true,qname:'Project.Sample',revision:'exact-draft',result:{value:1}});
var unsaved = run.warnings.filter(function(warning){return warning.code==='FLOW_CODE_UNSAVED_WORKING_COPY';})[0];
assert(unsaved && unsaved.revision === 'exact-draft' && unsaved.qname === 'Project.Sample' && unsaved.hint.indexOf('exact-draft') >= 0,'Unsaved warning must identify the exact revision to resume');
assert(!response('code-set',{ok:true,revision:'normal',warnings:[]}).fixes,'No fabricated correction for an unchanged source');
print('code-safe-corrections OK ('+checks+' checks)');
