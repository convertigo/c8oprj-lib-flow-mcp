const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('_flow/blocks/project/reference.block.js','utf8');
function fixture(){const refs=[];class Reference{getProjectName(){return 'Provider';}getParser(){return{getProjectName:()=> 'Provider'};}}
const project={hasChanged:false,getReferenceList:()=>({iterator:()=>{let i=0;return{hasNext:()=>i<refs.length,next:()=>refs[i++]};}}),remove:r=>refs.splice(refs.indexOf(r),1)};
const engine={theApp:{databaseObjectsManager:{getOriginalProjectByName:n=>n==='App'?project:{},exportProject:()=>{const e=new Error('Unable to save the standard YAML project');e.getCause=()=>new Error('Missing referenced schema at references.Provider');throw e;}},referencedProjectManager:{getReferenceFromProject:()=>{const ref=new Reference();refs.push(ref);project.hasChanged=true;return ref;}}}};
const block=vm.runInNewContext(source.slice(source.indexOf('(function')),{Packages:{com:{twinsoft:{convertigo:{engine:{Engine:engine},beans:{references:{ProjectSchemaReference:Reference}}}}}}});
const ctx={props:n=>n,nativePropertyContract:()=>({properties:p=>({value:p,normalizations:[]})}),lib:()=>({assertProjectSaveAllowed:()=>true}),write:()=>{}};
return{refs,project,run:()=>block.run(ctx,{project:'App',reference:'Provider'})};}
test('reference save failure rolls back the newly attached reference and returns the nested exporter cause',()=>{const f=fixture();assert.throws(f.run,e=>{assert.equal(e.code,'PROJECT_REFERENCE_SAVE_FAILED');assert.equal(e.details.rolledBack,true);assert.match(e.message,/references.Provider/);assert.match(e.hint,/project-save/);return true;});assert.equal(f.refs.length,0);assert.equal(f.project.hasChanged,false);});
