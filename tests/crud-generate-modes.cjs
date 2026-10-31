// entities[].generate "data" and ui.generate "none": the model owns the data and its read Flows, business code owns the rest.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const routes='_flow/frontbuilder/svelte/model/CrudModes/src/routes/';
const spec={facade:{prefix:'desk'},security:{principals:{ada:'agent',max:'manager'},demoLogin:true},entities:[
 {name:'items',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Label',type:'VARCHAR(80)',required:true}]},
 {name:'tasks',generate:'data',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Title',type:'VARCHAR(80)',required:true}]}]};
const c=compiler.compile(spec,'CrudModes',services),layout=c.files[routes+'+layout.flow.svelte'],home=c.files[routes+'+page.flow.svelte'];
check(['list','read','count','options'].every(op=>c.flows['desk_tasks_'+op]),'a data entity keeps its list, read, count and options Flows');
check(!c.flows.desk_tasks_save&&!c.flows.desk_tasks_delete,'a data entity has no generic save or delete by default');
check(c.config.data.sources.tasks_read&&c.config.data.sources.tasks_write&&c.config.sql.writes.tasks_insert,'its data sources and SQL writes stay for the business Flows');
check(!Object.keys(c.files).some(p=>p.startsWith(routes+'tasks/')),'a data entity has no page');
check(!layout.includes('nav_tasks')&&!home.includes('count_tasks')&&layout.includes('nav_items'),'no navigation entry or dashboard card for a data entity');
check(c.flows.desk_session.includes('"tasks": {"list": (local.role === "authenticated" || local.role === "reader" || local.role === "editor"),"read"')&&c.flows.desk_session.includes('"create": (false),"update": (false),"delete": (false)}'),'the session grants no generic write on a data entity');
const names=c.names.find(n=>n.entity==='tasks');
check(names.flows==='desk_tasks_list|read|count|options'&&names.pages===''&&names.generate==='data','the preview names what a data entity generates');
const granted=structuredClone(spec);granted.entities[1].permissions={create:['manager'],update:['manager']};
const g=compiler.compile(granted,'CrudModes',services);
check(g.flows.desk_tasks_save&&!g.flows.desk_tasks_delete&&g.flows.desk_session.includes('"create": (local.role === "manager"),"update": (local.role === "manager"),"delete": (false)'),'permissions grant a generic write of a data entity explicitly');
check(!Object.keys(g.files).some(p=>p.startsWith(routes+'tasks/')),'granted writes still generate no page');
const none=structuredClone(spec);none.ui={generate:'none'};
const n=compiler.compile(none,'CrudModes',services);
check(!Object.keys(n.files).some(p=>p.startsWith(routes))&&n.frontend.pages.length===0&&n.frontend.status==='not-generated','ui.generate none: no shell, sign-in, home or entity page');
check(n.flows.desk_session&&n.flows.desk_logout&&n.flows.desk_items_save&&!n.flows.desk_demo_login,'ui.generate none keeps the session and entity Flows, without demo sign-in');
for(const bad of [{e:'partial'},{ui:'some'}]){const s=structuredClone(spec);if(bad.e)s.entities[1].generate=bad.e;else s.ui={generate:bad.ui};assert.throws(()=>compiler.compile(s,'CrudModes',services),/generate/);checks.push('refused '+JSON.stringify(bad));}
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
