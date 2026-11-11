// A unique field, as an agent meets it through the MCP: the entity guides and the model contract of the tools.
// 1. The entities-model guide says how to declare unique: true and where it holds, the two answers to a duplicate
//    (rule unique in the actor's list, the model ACL refusal elsewhere, the ENTITY_UNIQUE_CONFLICT log line with the
//    actor), how to read and update by the unique value, and warns on global uniqueness of a personal field between
//    owners, on open sign-up (account enumeration, lib_UserManager), on the journal, on hooks before the database
//    verdict and on a borrowed transaction (rollback-only, PostgreSQL). It names the addUnique migration and its refusal.
// 2. The natural key paragraph proposes the generated identity with a unique field, never a SQL write.
// 3. The entities guide lists the rule unique, and the model contract of flow-entity-model-check/set names unique.
// 4. flow-entity-model-check, end to end with the entity library beside the MCP: unique on a string field passes,
//    unique on a field hidden from a creating role is refused at its path.
// Run with Rhino: arguments are the lib_flow_mcp project, then the engine _flow; the libraries beside the MCP answer.
var root=String(new java.io.File(arguments[0]).getCanonicalPath()),engineDir=String(new java.io.File(arguments.length>1?arguments[1]:root+'/../lib_flow_engine/_flow').getCanonicalPath());
var File=java.io.File,FU=Packages.org.apache.commons.io.FileUtils,Files=java.nio.file.Files,checks=0,failed=[];
function read(p){return String(FU.readFileToString(new File(p),'UTF-8'));}
function guide(name){return read(root+'/_flow/resources/guide/'+name+'.md').replace(/\s+/g,' ');}
function check(v,m,detail){checks++;if(!v)failed.push(m);print((v?'PASS ':'FAIL ')+m+(v?'':' '+String(JSON.stringify(detail)).substring(0,600)));}
var model=guide('entities-model'),entities=guide('entities');
var at=model.indexOf('## Unique fields'),section=at>=0?model.substring(at):'';
// 1. The section.
check(at>=0&&/"unique": true/.test(section)&&/string[^.]*maxLength[^.]*600[^.]*int64[^.]*date[^.]*enum/.test(section)&&/several `null` values/.test(section),'entities-model declares unique and where it holds',section.substring(0,400));
check(/never on the identity[^.]*computed[^.]*`auto`[^.]*`secret`[^.]*`visibleTo`[^.]*`storage`/.test(section),'entities-model names where unique is refused',section.substring(0,600));
check(/`ENTITY_VALIDATION` \(422\)[^.]*rule: "unique"/.test(section)&&/could list with the default options/.test(section)&&/never the value nor the other key/.test(section),'entities-model gives the answer in the actor list',section.substring(0,900));
check(/exactly the refusal of the model ACL/.test(section)&&/The declared model ACL denies this operation\./.test(section)&&/another owner[^.]*hidden field[^.]*inactive row/.test(section),'entities-model gives the model ACL refusal for any other duplicate',section.substring(0,900));
check(/`ENTITY_UNIQUE_CONFLICT` line with the actor[^.]*never the value/.test(section),'entities-model names the log line with the actor and without the value',section);
check(/filter: \{email: input\.email\}/.test(section)&&/key: \{id\}/.test(section)&&/reactivate it/.test(section)&&/normalize the value/.test(section),'entities-model reads and updates by the unique value, normalizes it and reactivates an inactive row',section);
check(/Uniqueness is global to the table/.test(section)&&/`Possédé`/.test(section)&&/other owners/.test(section)&&/uniqueness per owner/.test(section),'entities-model warns on global uniqueness of a personal field between owners',section);
check(/anonymous users or self sign-up/.test(section)&&/which accounts exist/.test(section)&&/lib_UserManager/.test(section)&&/no rate limit/.test(section),'entities-model warns on open sign-up and account enumeration',section);
check(/`Journalisé\.fields`/.test(section)&&/`beforeSave`[^.]*before the database decides/.test(section)&&/`afterSave`/.test(section),'entities-model warns on the journal and on hooks before the database verdict',section);
check(/`sql\.transaction`[^.]*rollback-only even when caught/.test(section)&&/PostgreSQL[^.]*every later statement of that transaction fails/.test(section),'entities-model warns on a borrowed transaction and PostgreSQL',section);
check(/`addUnique`/.test(section)&&/`duplicates`/.test(section)&&/`changeUnique`/.test(section)&&/keeps the rows/.test(section),'entities-model names the addUnique migration and its refusal',section);
// 2. The natural key paragraph.
var natural=model.substring(model.indexOf('**Natural key.**'),at>=0?at:model.length);
check(model.indexOf('**Natural key.**')>=0&&/`unique: true`/.test(natural)&&!/declares no unique constraint/.test(natural)&&!/sql\.write|config\.sql\.writes/.test(model.substring(model.indexOf('**Natural key.**'))),
 'natural key paragraph proposes a unique field and no SQL write',natural);
// 3. The entities guide and the tool contract.
check(/`relation` or `unique`/.test(entities)&&/\*\*Unique fields\*\* in `flow:\/\/guide\/entities-model`/.test(entities),'entities lists the rule unique and points to the section',null);
var contract=/var ENTITY_MODEL_FORMAT = ([\s\S]*?);\n/.exec(read(root+'/_flow/blocks/mcp/tools/available.block.js'));
check(contract&&/unique \(true/.test(contract[1]),'the model contract of the tools names unique',null);
// 4. flow-entity-model-check end to end.
var cache=new File(root,'../.cache/entity-tests').getCanonicalFile();cache.mkdirs();
var workspace=Files.createTempDirectory(cache.toPath(),'entity-unique-guide-').toFile(),target=new File(workspace,'UniqueApp');
try {
 ['lib_flow_engine','lib_flow_entity','lib_flow_sql','lib_flow_crud_data','lib_flow_mcp'].forEach(function(n){Files.createSymbolicLink(new File(workspace,'c8oprj-'+n.replace(/_/g,'-')).toPath(),new File(root,'../'+n).getCanonicalFile().toPath());});
 var mcpDir=new File(workspace,'c8oprj-lib-flow-mcp');
 var __flowEngineDir=String(new File(workspace,'c8oprj-lib-flow-engine/_flow').getAbsolutePath()),__flowProjectDir=String(mcpDir.getAbsolutePath());
 var engine=eval(read(__flowEngineDir+'/Engine.js')),source=read(String(mcpDir.getAbsolutePath())+'/_flow/flows/McpServer.flow.js'),calls=0;
 function call(name,args){var e=JSON.parse(engine.run(JSON.stringify({flowSource:source,includeTrace:false,input:{request:JSON.stringify({jsonrpc:'2.0',id:++calls,method:'tools/call',params:{name:name,arguments:args}})}})));
  if(!(e.ok===true&&e.result&&e.result.result))throw Error(name+' failed: '+JSON.stringify(e).substring(0,400));return e.result.result.structuredContent;}
 FU.writeStringToFile(new File(target,'c8oProject.yaml'),'convertigo: 8.5.0.m006\n↓UniqueApp [core.Project]:\n  version: 1.0\n  ↓entities [references.ProjectSchemaReference]:\n    projectName: lib_flow_entity\n','UTF-8');
 var good=call('flow-entity-model-check',{projectDir:String(target.getAbsolutePath()),model:{version:2,modelVersion:1,entities:{Reader:{display:{title:'name'},fields:{email:{type:'string',maxLength:120,unique:true},name:{type:'string',maxLength:80}}}}}});
 check(good&&good.valid===true,'model check accepts unique on a string field',good);
 var hidden=call('flow-entity-model-check',{projectDir:String(target.getAbsolutePath()),model:{version:2,modelVersion:1,entities:{Reader:{display:{title:'name'},fields:{email:{type:'string',maxLength:120,unique:true,visibleTo:['ADMIN'],nullable:true},name:{type:'string',maxLength:80}}}}}});
 var paths=(hidden&&hidden.diagnostics||[]).map(function(d){return d.path;});
 check(hidden&&hidden.valid===false&&paths.indexOf('entities.Reader.fields.email.unique')>=0,'model check refuses unique on a field hidden from a creating role',hidden);
} finally {FU.deleteDirectory(workspace);}
print(JSON.stringify({ok:!failed.length,checks:checks,failures:failed}));
if(failed.length)throw Error('entity-unique-guide-1110 failed: '+failed.join(', '));
