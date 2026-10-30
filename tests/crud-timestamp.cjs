// Real legacy-shaped model -> schema, named SQL, source contract and shared UI controls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const raw={project:'NeutralTickets',database:{mode:'hsqldb',database:'tickets'},entities:[{name:'tickets',fields:[{name:'Id',column:'id',type:'INTEGER',primary:true,generated:true},{name:'Title',column:'title',type:'VARCHAR(100)',required:true},{name:'Opened',column:'opened_at',type:'TIMESTAMP',required:true,auto:'create'},{name:'Updated',column:'updated_at',type:'TIMESTAMP',required:true,auto:'update'},{name:'Closed',column:'closed_at',type:'TIMESTAMP'}],ui:{listFields:['title','opened_at','updated_at','closed_at'],detailFields:['title','opened_at','updated_at','closed_at'],formFields:['title','opened_at','updated_at','closed_at']}}],seed:{enabled:true,data:{tickets:[{id:1,title:'Neutral',opened_at:'2000-01-01T00:00:00.000',closed_at:'2026-10-30T09:08:07.123'}]}}};
const check=(v,n)=>{assert(v,n);checks.push(n)},c=compiler.compile(raw,raw.project,{model,legacy,ui});
check(JSON.stringify(c)===JSON.stringify(compiler.compile(raw,raw.project,{model,legacy,ui})),'timestamp compiler is deterministic; never author-time now');
check(c.normalized.entities[0].fields.find(f=>f.name==='opened_at').type==='timestamp','legacy SQL TIMESTAMP translates to portable timestamp');
check(c.config.data.sources.tickets_write.fields.some(f=>f.name==='updated_at'&&f.auto==='update'),'provider receives server automation policy');
check(!c.config.data.sources.tickets_write.writableFields.includes('opened_at')&&!c.config.data.sources.tickets_write.writableFields.includes('updated_at'),'caller writable whitelist excludes automatic fields');
check(c.config.sql.writes.tickets_insert.parameters.some(p=>p.name==='opened_at'&&p.auto==='create'),'named insert also stamps on server');
check(!c.config.sql.writes.tickets_update.parameters.some(p=>p.name==='opened_at')&&c.config.sql.writes.tickets_update.parameters.some(p=>p.name==='updated_at'&&p.auto==='update'),'named update preserves creation time and refreshes modification');
const text=Object.entries(c.files).filter(([p])=>p.endsWith('.flow.svelte')).map(([,s])=>s).join('\n');
check(text.includes('"format":"datetime"')||text.includes('"format": "datetime"'),'existing DataTable datetime property is used');
check(text.includes('type="datetime-local"')&&text.includes('step="0.001"'),'shared Input uses native millisecond control');
check(!/name="(?:opened_at|updated_at)"/.test(text)&&text.includes('Renseigné par le serveur'),'automatic timestamps have readonly display without client input');
check(text.includes('format="datetime"')&&text.includes('locale="fr"'),'Text datetime localized display');
const seed=JSON.parse(Object.entries(c.files).find(([p])=>p.endsWith('/data.json'))[1]);
check(!Object.hasOwn(seed.tables[0].rows[0],'opened_at')&&seed.tables[0].rows[0].closed_at==='2026-10-30T09:08:07.123','seed automatic time comes from runtime server; manual millis retained');
for(const type of ['TIMESTAMP WITH TIME ZONE','TIMESTAMP(3) WITH TIME ZONE','TIMESTAMPTZ']){const bad=structuredClone(raw);bad.entities[0].fields[4].type=type;assert.throws(()=>compiler.compile(bad,bad.project,{model,legacy,ui}),/SQL_TIMESTAMP_WITH_TIME_ZONE_UNSUPPORTED/);checks.push('explicit rejection '+type);}
for(const change of [s=>s.entities[0].fields[1].auto='create',s=>s.entities[0].fields[2].auto='client']){const bad=structuredClone(raw);change(bad);assert.throws(()=>compiler.compile(bad,bad.project,{model,legacy,ui}),/auto is create or update on a local TIMESTAMP/);checks.push('invalid automation refused before writing');}
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
