// Hand-written pages next to the generated ones: ui.navigation links them from the generated (owned) shell.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const spec={facade:{prefix:'desk'},security:{principals:{ada:'agent',max:'manager'}},entities:[{name:'tickets',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Title',type:'VARCHAR(80)',required:true}]}],
 ui:{navigation:[{page:'my_tickets',label:'My tickets'},{page:'team_report',label:'Report & export',permission:'tickets.delete'}]}};
const c=compiler.compile(spec,'CrudSmoke',services),layout=c.files['_flow/frontbuilder/svelte/model/CrudSmoke/src/routes/+layout.flow.svelte'];
check(layout.includes('<LinkButton $$id="navCustom_my_tickets" page="my_tickets" label="My tickets" variant="nav" />'),'custom page linked from the generated navigation');
check(layout.includes('<If $$id="showCustom_team_report" test="@.desk_session.permissions.tickets.delete"><Then><LinkButton $$id="navCustom_team_report" page="team_report" label="Report &amp; export"'),'permission-gated link uses the session permissions');
check(layout.indexOf('navCustom_my_tickets')>layout.indexOf('nav_tickets'),'custom links follow the entity links');
check(!Object.keys(c.files).some(p=>/my_tickets|team_report/.test(p)),'the model does not own the hand-written pages');
for(const bad of [{page:'bad-id',label:'x'},{page:'x'},{page:'x',label:'x',permission:'unknown.list'},{page:'x',label:'x',permission:'tickets.export'}]){
 const s=structuredClone(spec);s.ui.navigation=[bad];assert.throws(()=>compiler.compile(s,'CrudSmoke',services),/ui\.navigation/);checks.push('refused '+JSON.stringify(bad));
}
const twice=structuredClone(spec);twice.ui.navigation.push({page:'my_tickets',label:'Again'});assert.throws(()=>compiler.compile(twice,'CrudSmoke',services),/unique page id/);checks.push('duplicate page refused');
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
