// F-14: block and Flow code reads use inclusive, revision-checked line ranges.
var project = new java.io.File(arguments[0]).getCanonicalFile();
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project, "_flow/lib/mcp.js"), "UTF-8"));
var mcp = eval(source);
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
var full = { ok: true, name: "sample.probe", revision: "rev", code: "const _meta = {};\r\n\r\nfunction probe() {\r\n  return 17;\r\n}\r\n", descriptor: {description:"Full descriptor"}, implementationSource:"full body" };
function read(name, args, value) {
  return mcp.toolResponse({id:1,params:{name:name,arguments:args}},value || full,{}).result.structuredContent;
}
function fails(args, code) {
  try { read("flow-block-code-get",args); } catch (e) { assert(String(e.code) === code, "Expected " + code + ", got " + e); return; }
  assert(false,"Range unexpectedly accepted: " + JSON.stringify(args));
}
["flow-block-code-get","flow-code-get","code-get"].forEach(function(name) {
  var value = read(name,{block:"sample.probe",startLine:3,endLine:4,revision:"rev"});
  assert(value.code === "function probe() {\n  return 17;",name + " ignored the requested lines: " + value.code);
  assert(value.revision === "rev" && value.partial === true && value.startLine === 3 && value.endLine === 4,name+" lost range/revision metadata");
  assert(value.totalLines === 6 && value.totalContentLength === full.code.length && value.contentLength === value.code.length,name+" lost source dimensions");
  assert(value.descriptor === undefined && value.implementationSource === undefined,name+" leaked full source metadata into bounded read");
});
assert(read("flow-block-code-get",{}).code === full.code,"Unbounded read changed");
assert(full.code.indexOf("const _meta") === 0 && full.descriptor.description === "Full descriptor","Read mutated its source result");
fails({startLine:1},"CODE_RANGE_INCOMPLETE");
fails({endLine:1},"CODE_RANGE_INCOMPLETE");
fails({startLine:0,endLine:1},"CODE_RANGE_INVALID");
fails({startLine:2,endLine:1},"CODE_RANGE_INVALID");
fails({startLine:1.5,endLine:2},"CODE_RANGE_INVALID");
fails({startLine:1,endLine:7},"CODE_RANGE_INVALID");
fails({startLine:1,endLine:2,revision:"stale"},"CODE_STALE_REVISION");
var huge = {ok:true,revision:"rev",code:new Array(503).join("line\n")};
try { read("code-get",{block:"sample.probe",startLine:1,endLine:501},huge); assert(false,"501 lines accepted"); }
catch(e) { assert(e.code === "CODE_RANGE_INVALID","Wrong 500-line limit error"); }
var browser = read("code-get",{block:"sample.probe",target:"frontend",startLine:4,endLine:4});
assert(browser.code === "  return 17;","Browser implementation range ignored");
var already = {ok:true,code:"bounded",revision:"rev",partial:true,startLine:3,endLine:3,totalLines:10};
assert(read("code-get",{sourceFile:"page.flow.svelte",startLine:3,endLine:3},already).code === "bounded","Frontend source sliced twice");
print("code-get ranges: " + count + " assertions passed");
