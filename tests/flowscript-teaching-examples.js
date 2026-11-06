function guideFamily(dir,name){var files=new java.io.File(dir,"_flow/resources/guide").list();var names=[];for(var i=0;i<files.length;i++){var f=String(files[i]);if(f.indexOf(name+"-")===0&&/\.md$/.test(f))names.push(f);}names.sort();names.unshift(name+".md");return names.map(function(f){return String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(new java.io.File(dir,"_flow/resources/guide"),f),"UTF-8"));}).join("\n\n").replace(/ \(\d+\.\d KB\)/g,"");}
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
 function transform(document,where) {
  return document.replace(/```(flowscript|javascript|js)\n([\s\S]*?)```/g,function(fence,lang,text,offset){
   if(/\(function\s*\(|^function\s*\(input\)/.test(text))return fence; // Explicit native implementation.
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
 print('flowscript-teaching-examples OK ('+examples+' extracted examples, '+checks+' checks)');
} finally {files.deleteDirectory(temporary);}
