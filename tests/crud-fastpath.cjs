const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const lib=vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../_flow/lib/crud-fastpath.js'),'utf8'));
const s=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/crud-spec.json')));let checks=0;
const check=(v,n)=>{assert(v,n);checks++};const a=lib.compile(s,'Qualification');
check(JSON.stringify(a)===JSON.stringify(lib.compile(s,'Qualification')),'compiler deterministic');
check(a.entities.join(',')==='companies,employees','FK dependency order');
check(a.config.data.sources.employees_read.readOnly===true,'read does not require mutation revision');
check(a.config.data.sources.employees_write.versionColumn==='revision','optimistic writes');
check(a.config.sql.queries.employees_count.expose===false,'named reads private');
check(a.config.sql.writes.employees_update.sql.includes(':revision'),'named write revision predicate');
check(Object.values(a.files).every(t=>!t.includes('<SetValue $id=')),'source preserves engine attributes');
for(const change of [x=>x.entities[0].name='bad;sql',x=>x.database.url+=';shutdown=true',x=>x.entities[0].fields.push({...x.entities[0].fields[0]}),x=>x.security.principals.editor='admin',x=>x.relations[0].to.field='name',x=>x.entities[0].revision=null]){
 const x=structuredClone(s);change(x);assert.throws(()=>lib.compile(x,'Qualification'));checks++;
}
const readOnly=structuredClone(s);readOnly.entities[0].revision=null;readOnly.entities[0].readOnly=true;
check(!lib.compile(readOnly,'Qualification').config.data.sources.companies_write,'unversioned readonly schema supported');
console.log(JSON.stringify({passed:true,checks}));
