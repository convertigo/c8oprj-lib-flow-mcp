// Lean generated Flows: each Flow carries only the configuration its body names, and a list answers its page without the
// resource descriptor unless asked.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-crud/spec_books_authors_publishers_hsqldb.json')));
const c=compiler.compile(spec,spec.project,services),meta=t=>JSON.parse(t.slice(t.indexOf('const _flow = ')+14,t.indexOf('\n\nfunction ')));
const flows=Object.entries(c.flows),whole=JSON.stringify(c.config,null,2).length,bytes=flows.reduce((a,[,t])=>a+t.length,0);
check(flows.every(([,t])=>JSON.stringify(meta(t).config,null,2).length<whole/2),'no generated Flow repeats the whole configuration');
check(bytes<flows.length*whole,'the generated Flows weigh less than one copy of the configuration each ('+bytes+' bytes for '+flows.length+' Flows, configuration '+whole+')');
const [prefix]=Object.keys(c.flows).find(n=>n.endsWith('_initialize')).split('_initialize'),entity=c.entities[c.entities.length-1],other=c.entities[0];
const list=meta(c.flows[prefix+'_'+entity+'_list']);
check(list.config.data.sources[entity+'_read']&&!list.config.data.sources[other+'_read']&&!list.config.data.sources[entity+'_write'],'a list carries its own read source only');
check(!list.config.sql.queries&&!list.config.sql.writes&&!list.config.crud?.optionQueries,'a list carries no named query, write or option map');
const save=meta(c.flows[prefix+'_'+entity+'_save']);
check(save.config.data.sources[entity+'_write']&&save.config.sql.writes[entity+'_update']&&!save.config.sql.writes[other+'_update'],'a save carries its write source and its own writes');
const options=meta(c.flows[prefix+'_'+other+'_options']);
check(Object.values(options.config.crud.optionQueries[other]).every(q=>options.config.sql.queries[q])&&Object.keys(options.config.crud.optionQueries).length===1,'an options Flow carries its option queries');
const init=meta(c.flows[prefix+'_initialize']);
check(init.config.sql.initializers[prefix]&&!init.config.data,'the initializer carries the initializer and the connection');
check(meta(c.flows[prefix+'_session']).config.crud.principals!==undefined,'the session carries the principals');
check(c.files['_flow/data/config.generated.json']===JSON.stringify(c.config,null,2)+'\n'&&c.config.sql.queries[other+'_read'],'config.generated.json keeps the whole configuration');
check(list.inputs.includeResource.default===false&&c.flows[prefix+'_'+entity+'_list'].includes('return {page:local.response.page}'),'a list answers its page only by default');
check(c.flows[prefix+'_'+entity+'_list'].includes('if (input.includeResource === true) {\n    return local.response'),'includeResource: true keeps the resource descriptor for data.csv');
console.log(JSON.stringify({passed:true,count:checks.length,bytes,flows:flows.length,checks}));
