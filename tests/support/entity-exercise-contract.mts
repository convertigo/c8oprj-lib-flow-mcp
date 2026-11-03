import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const provider=process.env.FLOW_FRONTBUILDER_RESOURCE_ROOT!;
const entity=resolve(import.meta.dirname,'../../../lib_flow_entity');
const engine=process.env.FLOW_ENGINE_RESOURCE_ROOT!;
const {loadDocument}=await import(pathToFileURL(resolve(provider,'src-builder/frontDocument.ts')).href);
const {generateSvelteProject}=await import(pathToFileURL(resolve(provider,'src-builder/generateSvelteProject.ts')).href);
const {compile}=createRequire(resolve(provider,'package.json'))('svelte/compiler');
const fixture=JSON.parse(await readFile(resolve(import.meta.dirname,'../fixtures/entity-mcp-equipment.json'),'utf8'));

test('MCP entity exercise keeps role guards, selection events, lexical cells and refresh state compilable',async t=>{
 const root=await mkdtemp(join(tmpdir(),'flow-entity-exercise-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const render=(s:string)=>s.replaceAll('${PROJECT}','EquipmentExercise');
 for(const source of fixture.sources.filter((s:any)=>s.sourceFile)){
  const path=join(root,render(source.sourceFile));await mkdir(dirname(path),{recursive:true});await writeFile(path,render(source.code));
 }
 const home=join(root,'_flow/frontbuilder/svelte/model/EquipmentExercise/src/routes/+page.flow.svelte');
 const config={resourceRoot:provider,projectRoot:root,projectName:'EquipmentExercise',referenceRoots:[resolve(engine,'..'),entity],discoverImplicitProviders:false};
 const doc=await loadDocument(home,{},config);
 assert.deepEqual(doc.diagnostics.filter((d:any)=>d.level==='error'),[]);
 const built=await generateSvelteProject(root,doc.model,{resourceRoot:provider});
 for(const route of ['','mine/','admin/']){
  const code=await readFile(join(built.generatedRoot,'src/routes/'+route+'+page.svelte'),'utf8');
  assert.doesNotThrow(()=>compile(code,{filename:route+'+page.svelte',generate:'client'}));
  if(!route){assert.match(code,/<Status\b/);assert.match(code,/loginStatus/);}
  if(route){
   assert.match(code,/#snippet (?:flowSnippet_)?cell\(row, field\)/);
   assert.match(code,/onselect=\{/);assert.match(code,/onsaved=\{/);assert.match(code,/ondeleted=\{/);
   assert.match(code,/refreshKey=/);assert.match(code,/locale="fr-FR"/);
  }
 }
 const layout=await readFile(join(built.generatedRoot,'src/routes/+layout.svelte'),'utf8');
 assert.doesNotThrow(()=>compile(layout,{filename:'+layout.svelte',generate:'client'}));
 assert.match(JSON.stringify(doc.model.backendCalls),/CurrentSession/);
 assert.match(JSON.stringify(doc.model.backendCalls),/SignOut/);
});
