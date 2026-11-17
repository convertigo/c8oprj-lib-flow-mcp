// The exact documented model and the short entry/drawer budgets, without a Convertigo runtime.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),guides=path.join(root,'_flow/resources/guide');
const read=name=>fs.readFileSync(path.join(guides,name+'.md'),'utf8');
const load=name=>vm.runInNewContext(fs.readFileSync(path.join(root,'../lib_flow_entity/_flow/lib',name+'.js'),'utf8'));
const format=load('entity-format'),model=load('entity-model'),traits=load('entity-traits');
const doc=read('entities-widgets/deadlines');
const example=()=>JSON.parse(doc.match(/<!-- example: deadline-model -->\s*```json\n([\s\S]*?)```/)[1]);
test('the documented deadline model passes authoring and runtime model resolution',()=>{
 const definition=example(),issues=format.check(definition,traits);
 assert.equal(issues.length,0,JSON.stringify(issues));
 const e=model.resolve(definition,traits).entities.Controle;
 assert.equal(e.fields.siteId.relation.entity,'Site');
 assert.equal(model.rule(e,'deadline').inclusive,true);
 assert.deepEqual(JSON.parse(JSON.stringify(e.fields.statut.values)),['aJour','aRelancer']);
});
test('the recipe cannot introduce restricted reference dates or silent business-day delays',()=>{
 for(const restriction of [{secret:true},{visibleTo:['MANAGER']}]){
  const definition=example();Object.assign(definition.entities.Controle.fields.dateControle,restriction);
  assert(format.check(definition,traits).some(d=>/Échéance.reference$/.test(d.path)));
  assert.throws(()=>model.resolve(definition,traits),/public stored date/);
 }
 const definition=example();definition.entities.Controle.traits[2]['Échéance'].delay.businessDays=5;
 assert(format.check(definition,traits).some(d=>d.path.endsWith('.delay.businessDays')));
});
test('deadline guidance is reachable and respects summary and drawer character budgets',()=>{
 for(const entry of ['entities','entities-widgets','entities-model'])assert(read(entry).length<6000,entry);
 for(const drawer of ['entities-widgets/deadlines','entities-widgets/table','entities-model/format'])assert(read(drawer).length<12000,drawer);
 assert.match(read('entities-widgets'),/flow:\/\/guide\/entities-widgets\/deadlines/);
 assert.match(read('entities-widgets/table'),/flow:\/\/guide\/entities-widgets\/deadlines/);
 assert.match(doc,/pas une nouvelle API/);
});

test('the explicit first-reference option in the recipe passes authoring and runtime resolution',()=>{
 const definition=example();definition.entities.Controle.traits[2]['Échéance'].referenceMode='first';
 assert.equal(format.check(definition,traits).length,0);
 assert.equal(model.rule(model.resolve(definition,traits).entities.Controle,'deadline').referenceMode,'first');
 assert.match(doc,/referenceMode: "latest"/);assert.match(doc,/referenceMode: "first"/);
});
