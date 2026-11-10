// Entity frictions of the validation runs of 09/11, as an agent meets them through the MCP.
// 1. options.active: the compact contract flow-block-get returns for entity.list and entity.count names its three
//    values, its refusal and that the access policy receives it; the entities and entities-policy guides say the same,
//    and that a filter on the active field reads as "all" under the policy.
// 2. Empty filter groups: the entities-model guide says {and: []} adds no condition and {or: []} matches no row.
// 3. A refused write: the text of an error (a client may show only the text, as Claude Code does for isError)
//    lists each refused field with its rule and expected form (details.errors, else details.fields), and the natural
//    key refusal keeps its hint; never a value that is not in the error. The guides name both.
// Run with Rhino: arguments are the lib_flow_mcp project, then the engine _flow; the libraries beside the MCP answer.
// FLOW_MCP_EXPECT_BASELINE=true runs it against an older MCP and entity: every regression check fails, every contract check passes.
var root=String(new java.io.File(arguments[0]).getCanonicalPath()),engineDir=String(new java.io.File(arguments.length>1?arguments[1]:root+'/../lib_flow_engine/_flow').getCanonicalPath());
var File=java.io.File,FU=Packages.org.apache.commons.io.FileUtils,Files=java.nio.file.Files,checks=0,results=[];
var negative=String(java.lang.System.getenv('FLOW_MCP_EXPECT_BASELINE')||'')==='true';
function read(p){return String(FU.readFileToString(new File(p),'UTF-8'));}
function guide(name){return read(root+'/_flow/resources/guide/'+name+'.md').replace(/\s+/g,' ');}
function check(v,m,detail,regression){checks++;results.push({name:m,passed:!!v,regression:regression!==false});print((v?'PASS ':'FAIL ')+m+(v?'':' '+String(JSON.stringify(detail)).substring(0,600)));}
var mcp=eval(read(root+'/_flow/lib/mcp.js'));
function respond(tool,args,value){return mcp.toolResponse({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool,arguments:args}},value,{}).result;}
// A Flow failure in code-run reaches the client as a thrown tool error (toolError), as in the trace of the run.
function thrown(tool,args,error){return mcp.toolError({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool,arguments:args}},error,{}).result;}
// 1. The contract of entity.list and entity.count, end to end through the MCP Flow and the entity library beside it.
var cache=new File(root,'../.cache/entity-tests').getCanonicalFile();cache.mkdirs();
var workspace=Files.createTempDirectory(cache.toPath(),'entity-frictions-').toFile(),target=new File(workspace,'FrictionApp');
try {
 ['lib_flow_engine','lib_flow_entity','lib_flow_sql','lib_flow_crud_data','lib_flow_mcp'].forEach(function(n){Files.createSymbolicLink(new File(workspace,'c8oprj-'+n.replace(/_/g,'-')).toPath(),new File(root,'../'+n).getCanonicalFile().toPath());});
 var mcpDir=new File(workspace,'c8oprj-lib-flow-mcp');
 var __flowEngineDir=String(new File(workspace,'c8oprj-lib-flow-engine/_flow').getAbsolutePath()),__flowProjectDir=String(mcpDir.getAbsolutePath());
 var engine=eval(read(__flowEngineDir+'/Engine.js')),source=read(String(mcpDir.getAbsolutePath())+'/_flow/flows/McpServer.flow.js'),calls=0;
 function call(name,args){var e=JSON.parse(engine.run(JSON.stringify({flowSource:source,includeTrace:false,input:{request:JSON.stringify({jsonrpc:'2.0',id:++calls,method:'tools/call',params:{name:name,arguments:args}})}})));
  if(!(e.ok===true&&e.result&&e.result.result))throw Error(name+' failed: '+JSON.stringify(e).substring(0,400));return e.result.result.structuredContent;}
 FU.writeStringToFile(new File(target,'c8oProject.yaml'),'convertigo: 8.5.0.m006\n↓FrictionApp [core.Project]:\n  version: 1.0\n  ↓entities [references.ProjectSchemaReference]:\n    projectName: lib_flow_entity\n','UTF-8');
 function options(block){var got=call('flow-block-get',{projectDir:String(target.getAbsolutePath()),name:block});return String(got&&got.ok&&got.block&&got.block.properties&&got.block.properties.options&&got.block.properties.options.description||'');}
 [['entity.list',options('entity.list')],['entity.count',options('entity.count')]].forEach(function(pair){var d=pair[1];
  check(/"active" \(the default/.test(d)&&/"inactive"/.test(d)&&/"all"/.test(d)&&/ENTITY_ACTIVE_INVALID/.test(d)&&/input\.request\.payload\.options\.active/.test(d)&&/filter on its active field[^.]*"all"/.test(d),
   pair[0]+' compact contract names the active values, their refusal and the policy',d);
  check(/\{and: \[\]\} adds no condition/.test(d)&&/\{or: \[\]\} matches no row/.test(d),pair[0]+' compact contract says what an empty group means',d);
 });
} finally {FU.deleteDirectory(workspace);}
// 1 bis. The guides an agent reads before writing a list.
var entities=guide('entities'),policy=guide('entities-policy'),model=guide('entities-model');
[['entities',entities],['entities-policy',policy]].forEach(function(pair){var g=pair[1];
 check(/options\.active/.test(g)&&/"active"[^.]*default/.test(g)&&/"inactive"/.test(g)&&/"all"/.test(g)&&/ENTITY_ACTIVE_INVALID/.test(g),pair[0]+' guide names the values of options.active',null);
});
check(/input\.request\.payload\.options\.active/.test(policy)&&/scope that fixes the active field/.test(policy)&&/filter on the active field[\s\S]{0,90}?reads as `options\.active: "all"`/.test(policy),'entities-policy says the policy decides options.active and a filter on the active field reads as all',null);
// 2. Empty groups.
check(/\{and: \[\]\}` adds no condition/.test(model)&&/\{or: \[\]\}` matches no row/.test(model)&&/policy scope/.test(model),'entities-model says what an empty group means, ANDed with the policy scope',null);
// 3. A refused write, as text.
var refused=thrown('code-run',{project:'App',qname:'App.reader_create'},{code:'ENTITY_VALIDATION',message:'Vérifiez les champs du formulaire.',hint:'',status:422,details:{
 fields:{title:'Texte trop long : 40 caractères au plus.',nope:'Champ non modifiable.'},
 errors:[{field:'title',rule:'maxLength',message:'Texte trop long : 40 caractères au plus.',expected:'texte de 40 caractères au plus.'},
  {field:'nope',rule:'unknown',message:'Champ non modifiable.',expected:'un champ modifiable de Book : title, kind.'}]}});
var text=String(refused.content[0].text);
check(refused.isError===true&&/\n- title \(maxLength\): Texte trop long : 40 caractères au plus\..*texte de 40 caractères au plus/.test(text)&&/\n- nope \(unknown\):.*title, kind/.test(text),'error text lists each refused field with its rule and expected form',text);
var older=String(thrown('code-run',{project:'App'},{code:'ENTITY_VALIDATION',message:'Vérifiez les champs du formulaire.',hint:'',details:{fields:{email:'Champ non modifiable.'}}}).content[0].text);
check(/\n- email: Champ non modifiable\./.test(older),'error text lists details.fields of an older entity library',older);
var natural=String(thrown('code-run',{project:'App'},{code:'ENTITY_NATURAL_KEY_CREATE_UNSUPPORTED',status:400,message:'Reader rows cannot be created by entity.save: its identity (email) is not generated by the database.',
 hint:'Read and update existing Reader rows with key {email}.',details:{entity:'Reader',identity:['email']}}).content[0].text);
check(/ENTITY_NATURAL_KEY_CREATE_UNSUPPORTED/.test(natural)&&/Fix: Read and update existing Reader rows with key \{email\}/.test(natural),'natural key refusal keeps its hint in the text',natural,false);
var many={fields:{},errors:[]};for(var i=0;i<11;i++){many.fields['f'+i]='Ce champ est obligatoire.';many.errors.push({field:'f'+i,rule:'required',message:'Ce champ est obligatoire.',expected:'texte attendu.'});}
var longText=String(thrown('code-run',{project:'App'},{code:'ENTITY_VALIDATION',message:'Vérifiez les champs du formulaire.',details:many}).content[0].text);
check((longText.match(/\n- f\d+ \(required\)/g)||[]).length===8&&/3 more in structuredContent\.error\.details/.test(longText),'a long list of refused fields stays bounded in the text',longText);
var diagnostics=String(respond('code-set',{project:'App'},{error:{code:'FLOWSCRIPT_VALIDATION_FAILED',message:'FlowScript validation failed.',details:[{severity:'error',code:'X',line:2,message:'Bad.'}]}}).content[0].text);
check(/\n- line 2: X: Bad\./.test(diagnostics)&&!/undefined/.test(diagnostics),'diagnostic lists are unchanged',diagnostics,false);
var plain=String(thrown('code-run',{project:'App'},{code:'FLOW_THROW',message:'Boom.',details:'raw text'}).content[0].text);
check(plain==='Error [FLOW_THROW]: Boom. See structuredContent.error.','an error without field details keeps its one line',plain,false);
check(/details\.errors/.test(entities)&&/ENTITY_NATURAL_KEY_CREATE_UNSUPPORTED/.test(entities)&&/ENTITY_NATURAL_KEY_CREATE_UNSUPPORTED/.test(model)&&/sql\.write/.test(model),'guides name details.errors and the natural key refusal with how to create today',null);
var expected=results.filter(function(r){return r.regression;}).length,failed=results.filter(function(r){return !r.passed;});
var passed=negative?failed.length===expected&&results.filter(function(r){return !r.regression;}).every(function(r){return r.passed;}):failed.length===0;
print(JSON.stringify({ok:passed,baseline:negative,checks:checks,expectedBaselineFailures:expected,failures:failed.map(function(r){return r.name;})}));
if(!passed)throw Error('entity-frictions-1110 failed: '+failed.map(function(r){return r.name;}).join(', '));
