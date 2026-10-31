// rowPolicy, owner form: a restricted role reads and writes only its rows, enforced in the generated server-side SQL filter.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const spec={facade:{prefix:'desk'},security:{principals:{ada:'agent',max:'admin'},accounts:{entity:'members',login:'Login',active:'Active'}},entities:[
 {name:'members',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Login',type:'VARCHAR(40)',required:true},{name:'Active',type:'BOOLEAN'}]},
 {name:'assets',rowPolicy:{field:'owner_login',equals:'user',unrestricted:['admin']},fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Name',type:'VARCHAR(80)',required:true},{name:'owner_login',type:'VARCHAR(40)'}]},
 {name:'checkins',generate:'data',permissions:{create:['agent','admin']},rowPolicy:{field:'person_id',equals:'account.Id'},fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Note',type:'VARCHAR(200)',required:true},{name:'person_id',type:'INTEGER'}]}]};
const c=compiler.compile(spec,'CrudRows',services),f=c.flows,q=c.config.sql.queries;
const restricted='  local.restricted = true\n  if (local.role === "admin") {\n    local.restricted = false\n  }\n  local.owner = local.user\n';
check(['list','read','count','options','save','delete'].every(op=>f['desk_assets_'+op].includes(restricted)),'every generated Flow of the entity computes the restriction from the session, admin unrestricted');
const list=f.desk_assets_list,forced='  if (local.restricted) {\n    local.filter = {field:"owner_login",op:"eq",value:local.owner}\n  }\n';
check(list.includes(forced)&&list.indexOf(forced)>list.indexOf('input.search')&&list.indexOf(forced)<list.indexOf('data.read({source:"assets_read"'),'list: the owner filter replaces any client filter or search, just before the read');
check(q.assets_owned.sql.endsWith('WHERE "id"=:id AND "owner_login"=:owner')&&f.desk_assets_read.indexOf('query:"assets_owned"')<f.desk_assets_read.indexOf('data.read({source:"assets_read"'),'read: the row must be owned before it is read, else 404');
check(f.desk_assets_count.includes('query:"assets_count_owned",parameters:{owner:local.owner}')&&q.assets_count_owned.sql.endsWith('WHERE "owner_login"=:owner'),'count: only the owned rows');
check(f.desk_assets_options.includes('config.crud.ownedOptionQueries.assets')&&/WHERE "owner_login"=:owner ORDER BY/.test(q.assets_options_owned.sql),'options: only the owned rows');
const save=f.desk_assets_save,update=save.slice(save.indexOf('  }\n  local.user'));
check(save.split('json.put({path:"local.patch",key:"owner_login",value:local.owner})').length===3&&update.includes('query:"assets_owned"'),'save: create and update force the owner, update needs an owned row');
check(f.desk_assets_delete.indexOf('query:"assets_owned"')<f.desk_assets_delete.indexOf('data.write('),'delete: only an owned row');
check(f.desk_checkins_list.includes('local.owner = local.account.values.id\n')&&f.desk_checkins_save.includes('key:"person_id",value:local.owner'),'equals account.<field>: the owner is a field of the account row');
check(['desk_members_list','desk_assets_read','desk_checkins_count'].every(n=>f[n].includes('data.read({source:"members_read",limit:1,filter:{field:"login",op:"eq",value:local.user}})')&&f[n].includes('message:"Inactive account"')),'every generated Flow refuses an unknown or inactive account');
const normalized=model.normalize(spec,'CrudRows',legacy);
check(!normalized.diagnostics.some(d=>/ROW_POLICY/.test(d.code)),'the owner form no longer blocks application');
const refused=[{field:'owner_login',sessionClaim:'team'},{field:'Id',equals:'user'},{field:'owner_login',equals:'role'},{field:'Missing',equals:'user'}];
for(const rp of refused){const s=structuredClone(spec);s.entities[1].rowPolicy=rp;check(model.normalize(s,'CrudRows',legacy).diagnostics.some(d=>d.code==='FLOW_CRUD_ROW_POLICY_UNSUPPORTED'),'refused '+JSON.stringify(rp));}
const noAccounts=structuredClone(spec);delete noAccounts.security.accounts;
check(model.normalize(noAccounts,'CrudRows',legacy).diagnostics.some(d=>d.code==='FLOW_CRUD_ROW_POLICY_UNSUPPORTED'&&d.entity==='checkins'),'equals account.<field> needs security.accounts');
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
