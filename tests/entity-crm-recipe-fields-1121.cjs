// The CRM recipe sorts its lists on fields its model declares and the server maintains (L28F, 21/11): the recipe said
// updatedAt was kept "by the application or its timestamp trait", while the trait Horodaté creates dateCreation and
// dateModification; an agent combined the trait with orderBy="updatedAt" and the list answered Unknown or hidden query
// field: updatedAt.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const recipe=name=>{
 const text=fs.readFileSync(path.join(root,'_flow/resources/guide',name+'.md'),'utf8').split('## Dashboard and list')[1];
 assert.ok(text,name+' has the Dashboard and list recipe');
 return text.split(/\n## /)[0];
};
const table=recipe('entities/widgets/table'),pages=recipe('multipage-entities/pages');
const flat=table.replace(/\s+/g,' ');
// The fields of an entity of the recipe: "`Deal` (title, companyId relation, ..., updatedAt timestamp)".
function declared(entity){
 const found=new RegExp('`'+entity+'` \\(([^)]*)\\)').exec(flat);
 assert.ok(found,entity+' is declared by the recipe');
 return found[1].split(',').map(item=>item.trim().split(/\s+/)[0]);
}
// The order of each EntityTable of an entity: its orderBy, else updatedAt for a compact list (the widget default).
function orders(text,entity){
 return [...text.matchAll(/<EntityTable\b[^>]*>/g)].map(m=>m[0]).filter(tag=>tag.includes('entity="'+entity+'"')).map(tag=>{
  const order=/\borderBy="([^"]+)"/.exec(tag);
  return order?order[1]:/\blayout="compact"/.test(tag)?'updatedAt':null;
 }).filter(Boolean);
}
const traitsFile=path.join(root,'../lib_flow_entity/_flow/lib/entity-traits.js');

test('every Deal list of the CRM recipes sorts on a field the recipe declares for Deal',()=>{
 const fields=declared('Deal');
 const sorted=[...orders(table,'Deal'),...orders(pages,'Deal')];
 assert.ok(sorted.length>=2,'the recipes sort their recent deals');
 for(const field of sorted)assert.ok(fields.includes(field),field+' is not declared for Deal ('+fields.join(', ')+')');
});

test('the recipe declares updatedAt as a timestamp the server writes at every save',()=>{
 const found=/Declare `updatedAt` as `(\{[^`]*\})`/.exec(flat);
 assert.ok(found,'the recipe gives the declaration of updatedAt');
 const field=vm.runInNewContext('('+found[1]+')');
 assert.equal(field.type,'timestamp');
 assert.equal(field.auto,'update');
 assert.equal(field.readOnly,true);
});

test('what the recipe says of a trait is what the trait creates',{skip:!fs.existsSync(traitsFile)},()=>{
 const traits=vm.runInNewContext(fs.readFileSync(traitsFile,'utf8'));
 const claims=[...flat.matchAll(/[Tt]he trait `([^`]+)` adds ((?:`\w+`(?:, | and )?)+)/g)];
 assert.ok(claims.length,'the recipe names the timestamp trait and the fields it adds');
 for(const [,name,list] of claims){
  assert.ok(traits[name],'unknown trait '+name);
  const said=[...list.matchAll(/`(\w+)`/g)].map(m=>m[1]).sort();
  assert.deepEqual(said,Object.keys(traits[name].fields).sort(),'the fields of '+name);
 }
 const horodate=traits['Horodaté'].fields;
 const sortWith=/with it, sort with `orderBy="(\w+)"`/.exec(flat);
 assert.ok(sortWith,'the recipe says how to sort with the trait');
 assert.equal(horodate[sortWith[1]]?.auto,'update',sortWith[1]+' is the field the trait writes at every save');
});
