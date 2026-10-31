// entities[].generate "schema": the model owns the table, its seed and its data sources; business Flows own every access.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const routes='_flow/frontbuilder/svelte/model/SchemaMode/src/routes/';
const spec={facade:{prefix:'desk'},seed:{data:{tasks:[{Title:'First'}]}},entities:[
 {name:'items',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Label',type:'VARCHAR(80)',required:true}]},
 {name:'tasks',generate:'schema',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Title',type:'VARCHAR(80)',required:true}]}]};
const c=compiler.compile(spec,'SchemaMode',services),schema=JSON.parse(c.files['_flow/resources/sql/crud/schema.json']),seed=JSON.parse(c.files['_flow/resources/sql/crud/data.json']);
check(schema.tables.some(t=>t.name==='tasks'),'a schema entity keeps its table');
check(seed.tables.find(t=>t.table==='tasks').rows.length===1,'a schema entity keeps its seed');
check(c.config.data.sources.tasks_read&&c.config.data.sources.tasks_write.writableFields.includes('title'),'a schema entity keeps its read and write data sources');
check(!Object.keys(c.flows).some(n=>n.startsWith('desk_tasks_')),'a schema entity has no generated Flow');
check(!Object.keys(c.config.sql.queries).some(n=>n.startsWith('tasks_')&&n!=='tasks_count')&&!Object.keys(c.config.sql.writes).some(n=>n.startsWith('tasks_')),'a schema entity has no named query or write besides the proof count');
check(c.flows.desk_runtime_proof.includes('"tasks_count"'),'the runtime proof still counts its table');
check(!Object.keys(c.files).some(p=>p.startsWith(routes+'tasks/'))&&!c.files[routes+'+layout.flow.svelte'].includes('nav_tasks'),'a schema entity has no page nor navigation entry');
check(!c.flows.desk_session.includes('"tasks": {"list"')&&c.flows.desk_session.includes('"items": {"list"'),'the session lists no generic permission for a schema entity');
const names=c.names.find(n=>n.entity==='tasks');
check(names.flows===''&&names.pages===''&&names.generate==='schema'&&names.sources==='tasks_read|tasks_write','the preview names the data sources a schema entity generates');
check(c.flows.desk_items_list&&c.flows.desk_items_save,'a full entity beside it is unchanged');
const all=structuredClone(spec);all.entities[0].generate='schema';all.ui={generate:'none'};
const a=compiler.compile(all,'SchemaMode',services);
check(Object.keys(a.flows).sort().join(',')==='desk_initialize,desk_logout,desk_runtime_proof,desk_session','an all-schema model generates only the initializer, the proof and the session Flows');
const related={...structuredClone(spec),relations:[{fromEntity:'items',fromField:'task_id',toEntity:'tasks'}]};
related.entities[0].fields.push({name:'task_id',type:'INTEGER'});
assert.throws(()=>compiler.compile(related,'SchemaMode',services),/generate tasks as "data"/);checks.push('a generated form refuses a relation to a schema entity, with the fix');
related.entities[0].generate='data';check(compiler.compile(related,'SchemaMode',services).flows.desk_items_read,'a data entity may relate to a schema entity');
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
