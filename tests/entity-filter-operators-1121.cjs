// The filter operators the entity guides teach are the ones entity.list accepts (21/11, L34F: EntityTable filters
// declared op "gte"/"lte" for a date range, and no guide named a one-bound operator).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),guides=path.join(root,'_flow/resources/guide');
const read=name=>fs.readFileSync(path.join(guides,name+'.md'),'utf8').replace(/\s+/g,' ');
const ONE_BOUND=['gt','gte','lt','lte'];
test('the list guide names every filter operator, the one-bound comparisons included',()=>{
 const lists=read('entities/model/lists');
 for(const op of ['eq','in','contains','between',...ONE_BOUND])assert.match(lists,new RegExp('`'+op+'`'),op);
 assert.match(lists,/A `null` bound is open/);
});
test('the list guide gives an open between bound and a JSON number for a decimal',()=>{
 const lists=read('entities/model/lists');
 assert.match(lists,/`between` `\["2026-03-01", null\]` reads as `gte`/);
 assert.match(lists,/A decimal bound is exact text or a finite JSON number/);
});
test('the table guide gives the op of a filter control and an inclusive date range',()=>{
 const table=read('entities/widgets/table');
 for(const op of ONE_BOUND)assert.match(table,new RegExp('`'+op+'`'),op);
 assert.match(table,/op:"gte"[^}]*\}` and `\{[^}]*op:"lte"[^}]*\}` make an inclusive date range/);
});
test('the operators of the guide are those of the entity.list contract',{skip:!fs.existsSync(path.join(root,'../lib_flow_entity'))},()=>{
 const block=fs.readFileSync(path.join(root,'../lib_flow_entity/_flow/blocks/entity/list.block.js'),'utf8');
 const documented=block.match(/op: ((?:[a-z]+\|)+[a-z]+)/)[1].split('|');
 const lists=read('entities/model/lists');
 assert.deepEqual(documented.filter(op=>!new RegExp('`'+op+'`').test(lists)),[]);
});
