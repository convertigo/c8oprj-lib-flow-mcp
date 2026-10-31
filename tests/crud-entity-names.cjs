// The legacy model format names an entity by its plural: the compiler reports the names it generates per entity, says
// when it renamed one, and "plural" keeps the given name.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const fields=[{name:'Id',type:'INTEGER',primary:true},{name:'Title',type:'VARCHAR(80)',required:true}];
const spec={facade:{prefix:'desk'},entities:[{name:'teams',fields},{name:'order_line',fields},{name:'notes',readOnly:true,fields}]};
const c=compiler.compile(spec,'CrudNames',services),byEntity={};
c.names.forEach(n=>{byEntity[n.entity]=n;});
check(byEntity.teams&&!byEntity.teams.given&&byEntity.teams.flows==='desk_teams_list|read|count|options|save|delete'&&byEntity.teams.route==='/teams','a plural name is kept and its Flows, pages and route are reported');
check(byEntity.order_lines&&byEntity.order_lines.given==='order_line'&&/plural/.test(byEntity.order_lines.message)&&/"plural": "order_line"/.test(byEntity.order_lines.fix),'a pluralized name is reported with the given name and the fix');
check(byEntity.order_lines.route==='/order-lines'&&c.flows.desk_order_lines_list!==undefined,'the report matches the generated Flows and route');
check(byEntity.notes.flows==='desk_notes_list|read|count|options'&&byEntity.notes.pages==='notes_list|detail','a read-only entity reports no write Flow nor form');
const kept=structuredClone(spec);kept.entities[1].plural='order_line';
const k=compiler.compile(kept,'CrudNames',services),line=k.names.filter(n=>n.entity==='order_line')[0];
check(line&&!line.given&&k.flows.desk_order_line_list!==undefined&&!k.flows.desk_order_lines_list,'"plural" keeps the given name');
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
