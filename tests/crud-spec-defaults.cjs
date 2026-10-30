// An agent's first spec often leaves out optional sections or copies a spec written for another project.
// Optional sections take the defaults of the normalizer in both formats; spec.project defaults to the target project.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const internal=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/crud-spec.json')));
// The internal fixture has no top-level ui: the renderer read s.ui.language and crashed.
const full=compiler.compile(internal,'CrudSmoke',services);
check(full.frontend.pages.length>0&&full.flows.crud_session,'internal spec without ui compiles with pages');
for(const section of ['ui','facade','security','seed','relations']){
 const spec=structuredClone(internal);delete spec[section];
 const c=compiler.compile(spec,'CrudSmoke',services);
 check(c.entities.length===2&&c.frontend.pages.length>0,'internal spec without '+section+' compiles');
}
const noFacade=structuredClone(internal);delete noFacade.facade;
check(Object.keys(compiler.compile(noFacade,'CrudSmoke',services).flows).every(n=>n.startsWith('crud_')),'default facade prefix is crud');
// Legacy format: a minimal model, without project, database, ui, facade, security or seed.
const minimal={entities:[{name:'tickets',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Title',type:'VARCHAR(80)',required:true}]}]};
const m=compiler.compile(minimal,'CrudSmoke',services);
check(m.normalized.database.dialect==='hsqldb'&&/\/_flow\/resources\/sql\/crud\/database\/crudsmoke;shutdown=false$/.test(m.normalized.database.url),'missing database is the HSQLDB development database of the project');
check(m.flows.crud_tickets_list&&m.flows.crud_session&&m.frontend.pages.length===5,'minimal legacy spec generates Flows and pages');
check(m.normalized.seed.enabled===true&&m.normalized.seed.data.tickets.length>0,'missing seed uses the default sample rows');
check(JSON.stringify(m.config.crud.principals)==='{}'&&m.config.crud.demoLogin===false,'missing security: no principal map, no demo login');
for(const section of ['ui','facade','security','seed']){
 const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-crud/spec_employees_companies_hsqldb.json')));delete spec.project;delete spec[section];
 check(compiler.compile(spec,'CrudSmoke',services).entities.length===2,'legacy spec without '+section+' compiles');
}
// spec.project: absent means the target project; a different name is a diagnostic with its fix, not a bare error.
const copied=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-crud/spec_employees_companies_hsqldb.json')));
const n=model.normalize(copied,'CrudSmoke',legacy),mismatch=n.diagnostics.find(d=>d.code==='FLOW_CRUD_SPEC_PROJECT_MISMATCH');
check(mismatch&&mismatch.severity==='error'&&/Remove spec\.project/.test(mismatch.fix)&&mismatch.fix.includes('"CrudSmoke"'),'mismatch names the fix');
check(n.internal.project==='CrudSmoke','normalization continues for the target project, so other diagnostics are listed too');
assert.throws(()=>compiler.compile(copied,'CrudSmoke',services),/FLOW_CRUD_SPEC_PROJECT_MISMATCH/);checks.push('compile refuses the mismatch');
const same=structuredClone(copied);same.project='CrudSmoke';check(!model.normalize(same,'CrudSmoke',legacy).diagnostics.length,'same project accepted');
const internalMismatch=structuredClone(internal);internalMismatch.project='Other';
check(model.normalize(internalMismatch,'CrudSmoke',legacy).diagnostics.some(d=>d.code==='FLOW_CRUD_SPEC_PROJECT_MISMATCH'),'internal format reports the mismatch too');
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
