load(new java.io.File(arguments[1], 'tests/support/guide-family.js'));
// Extract all runnable FlowScript fences from guides, skills and block longDescription.
// JavaScript fences containing a Rhino/browser implementation are not FlowScript.
var engineRoot = new java.io.File(arguments[0]).getCanonicalFile();
var mcpRoot = new java.io.File(arguments[1]).getCanonicalFile();
var __flowEngineDir = String(engineRoot), files = Packages.org.apache.commons.io.FileUtils;
var temporary = java.nio.file.Files.createTempDirectory(engineRoot.getParentFile().getParentFile().toPath(),'flow-teaching-').toFile();
var __flowProjectDir = String(temporary), checks = 0, examples = 0;
var update = String(java.lang.System.getenv('FLOW_UPDATE_DOC_EXAMPLES') || '') === '1';
function read(file) { return String(files.readFileToString(file,'UTF-8')); }
function assert(value,message) { checks++; if(!value)throw new Error(message); }
function all(root,extension) {
 var out=[];function visit(dir){var list=dir.listFiles();for(var i=0;list&&i<list.length;i++){if(list[i].isDirectory())visit(list[i]);else if(String(list[i].getName()).endsWith(extension))out.push(list[i]);}}visit(root);return out;
}
try {
 files.writeStringToFile(new java.io.File(temporary,'c8oProject.yaml'),'projectName: lib_flow_sql\nprojectName: lib_flow_crud_data\nprojectName: lib_flow_entity\n','UTF-8');
 var engine=eval(read(new java.io.File(engineRoot,'Engine.js')));
 function api(method,args){return JSON.parse(engine[method](JSON.stringify(args)));}
 // A guide teaches this real project-local vocabulary before its caller example.
 var customText=read(new java.io.File(mcpRoot,'_flow/resources/guide/custom-blocks.md'));
 var customExample=/```(?:javascript|flowscript)\n([\s\S]*?)```/.exec(customText)[1];
 var created=api('blockCodeSet',{name:'crm.customerLabel',code:customExample});
 assert(created.ok,'custom-block guide must compile: '+JSON.stringify(created));
 // Register the ordinary project actor taught before its callers, rather than accepting an unknown block.
 var entityText=guideFamily(mcpRoot,'entities');
 var actorExample=/<!-- example: actor-block -->\s*```javascript\n([\s\S]*?)```/.exec(entityText);
 assert(actorExample,'Entity guide must teach its actor block');
 var actorCreated=api('blockCodeSet',{name:'app.actor',code:actorExample[1]});
 assert(actorCreated.ok,'Entity actor guide must compile: '+JSON.stringify(actorCreated));

 function canonical(text,where) {
  var meta='',body=text.trim(),isBlock=/^const _meta\s*=/.test(body);
  if (isBlock) {
   // The header is a literal contract, not executable FlowScript; validate it through blockCodeSet above.
   var at=body.indexOf('\nfunction ');assert(at>=0,where+': Flow block needs function');
   meta=body.substring(0,at).trim()+'\n\n';body=body.substring(at+1);
  }
  var complete=/^(?:const _flow\s*=|function\s)/.test(body),name=/function\s+(\w+)/.exec(body);
  name=name?name[1]:'TeachingExample';
  var code=complete?body+'\n':'function '+name+'({ input, config, result }) {\n'+body.split('\n').map(function(line){return line?'  '+line:'';}).join('\n')+'\n}\n';
  var parsed=api('flowSourceValidate',{name:name,code:code});
  assert(parsed.ok,where+': compile failed '+JSON.stringify(parsed));
  var formatted=api('flowSourceValidate',{name:name,flowSource:parsed.source,includeHeader:false,includeImplicitReturn:false});
  assert(formatted.ok,where+': formatter failed '+JSON.stringify(formatted));
  var output=formatted.code;
  if(!complete)output=output.substring(output.indexOf('{\n')+2,output.lastIndexOf('\n}')).split('\n').map(function(line){return line.replace(/^  /,'');}).join('\n')+'\n';
  return meta+output;
 }
 // FlowScript v3 (B line): the backend authoring family and the backend skills teach v3. Their examples are translated
 // and run by tests/flowscript-v3-guide-examples.js of lib_flow_engine; a v3 text is never formatted from its tree.
 var v3Sources=/\/(guide\/(authoring[^\/]*|authoring\/[^\/]+|start|start\/syntax|multipage-roles\/pages)\.md|skills\/convertigo-flow-(backend|mcp)\/SKILL\.md)$/;
 function transform(document,where) {
  return document.replace(/```(flowscript|javascript|js)\n([\s\S]*?)```/g,function(fence,lang,text,offset){
   if(/\(function\s*\(|^function\s*\(input\)/.test(text))return fence; // Explicit native implementation.
   if(v3Sources.test(String(where).replace(/\\/g,'/'))||/sourceVersion\s*:\s*3/.test(text))return fence;
   examples++;
   var result=canonical(text,where+':'+(document.substring(0,offset).split('\n').length));
   if(!update)assert(result===text,where+': example is not formatted:\n'+result);
   return '```'+lang+'\n'+result+'```';
  });
 }
 var roots=[new java.io.File(mcpRoot,'_flow/resources/guide'),new java.io.File(mcpRoot,'_flow/resources/skills'),new java.io.File(engineRoot,'resources/guide')];
 roots.forEach(function(root){all(root,'.md').forEach(function(file){var before=read(file),after=transform(before,String(file));if(update&&before!==after)files.writeStringToFile(file,after,'UTF-8');});});
 [new java.io.File(engineRoot,'blocks'),new java.io.File(mcpRoot,'_flow/blocks')].forEach(function(root){all(root,'.block.js').forEach(function(file){
  var before=read(file),after=before.replace(/((?:"longDescription"|longDescription)\s*:\s*)("(?:[^"\\]|\\.)*")/g,function(whole,prefix,literal){return prefix+JSON.stringify(transform(JSON.parse(literal),String(file)));});
  if(update&&before!==after)files.writeStringToFile(file,after,'UTF-8');
 });});
 assert(examples>=20,'No silent omission of teaching sources: '+examples);
 // Execute the v3 row projection with the server state prepared by its surrounding Flow.
 var rolesGuide=read(new java.io.File(mcpRoot,'_flow/resources/guide/multipage-roles/pages.md'));
 var projection=/```javascript\n(const books = list\.map\([\s\S]*?)```/.exec(rolesGuide);
 assert(projection,'The roles guide must provide the row permission projection');
 ['MEMBER','LIBRARIAN',''].forEach(function(role){
  var catalog={books:[{id:'1',title:'Bel-Ami',available:true},{id:'2',title:'Germinal',available:false}],loans:[{id:'3',title:'Germinal'}]};
  var code='const _flow = { sourceVersion: 3 }\nfunction LibraryPage({ input, config, result }) {\n'
   +'  local.user = input.user\n  local.catalog = input.catalog\n'+projection[1]+'}\n';
  var run=api('flowCodeRun',{name:'LibraryPage',code:code,
   input:{user:{role:role},catalog:catalog},includeTrace:false});
  assert(run.ok,'The role projection must run: '+JSON.stringify(run));
  assert(run.result.role===role,'The page receives the server role');
  assert(run.result.books[0].canBorrow===(role==='MEMBER'),'Only a member can borrow an available book');
  assert(run.result.books[1].canBorrow===false,'No role can borrow an unavailable book');
  assert(JSON.stringify(run.result.loans)===JSON.stringify(catalog.loans),'The permitted loans are preserved');
 });
 print('flowscript-teaching-examples OK ('+examples+' extracted examples, '+checks+' checks)');
} finally {files.deleteDirectory(temporary);}
