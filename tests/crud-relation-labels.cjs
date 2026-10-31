// Relation labels of a list page: one data.read per relation over the keys of the page (IN), never one read per row.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-crud/spec_books_authors_publishers_hsqldb.json')));
const c=compiler.compile(spec,spec.project,services),list=c.flows.lib_books_list,body=list.slice(list.indexOf('function lib_books_list'));
const reads=body.match(/data\.read\(/g).length,relations=c.normalized.relations.filter(r=>r.from.entity==='books');
check(relations.length===2&&reads===1+relations.length,'a list of books reads its page, then one read per relation ('+reads+' data.read)');
for(const r of relations)check(body.includes('filter:{field:"'+r.to.field+'",op:"in",value:local.keys_'+r.from.field+'}'),'the '+r.from.field+' labels come from one IN read over the keys of the page');
const loop=body.slice(body.indexOf('local.rows = []'));
check(!loop.includes('data.read(')&&!loop.includes('sql.query(')&&!loop.includes('requestable.call('),'the per-row loop reads nothing: it looks the labels up in a map');
check(loop.includes('displayValues:local.display')&&loop.includes('json.put({path:"local.display",key:"author_id",value:local.label})'),'each row gets its labels in displayValues');
check(c.flows.lib_authors_list.includes('displayValues:current.values')&&!c.flows.lib_authors_list.includes('op:"in"'),'a list without relation reads only its page');
const meta=t=>JSON.parse(t.slice(t.indexOf('const _flow = ')+14,t.indexOf('\n\nfunction ')));
check(Object.keys(meta(list).config.data.sources).sort().join(',')==='authors_read,books_read,publishers_read','the list carries the read sources of its relations');
const page=Object.entries(c.files).find(([p])=>p.endsWith('/books/+page.flow.svelte'))[1];
check(page.includes('"path":"displayValues.author_id"')&&page.includes('"path":"values.title"'),'the generated list page shows the relation labels');
// The read Flow of one row keeps one read per relation.
check(c.flows.lib_books_read.match(/data\.read\(/g).length===1+relations.length,'the read of one row reads one row per relation');
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
