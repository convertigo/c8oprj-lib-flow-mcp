// ui.homePage / ui.loginPage false: the generated root page or sign-in page is not generated; a business page is the entry.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const routes='_flow/frontbuilder/svelte/model/CrudOff/src/routes/';
const spec={facade:{prefix:'desk'},security:{principals:{ada:'agent'},demoLogin:true},entities:[{name:'items',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Label',type:'VARCHAR(80)',required:true}]}],
 ui:{homePage:false,loginPage:false,navigation:[{page:'start',label:'Start'}]}};
const c=compiler.compile(spec,'CrudOff',services),all=Object.values(c.files).join('\n'),layout=c.files[routes+'+layout.flow.svelte'];
check(!c.files[routes+'+page.flow.svelte']&&!c.files[routes+'login/+page.flow.svelte'],'no generated root page or sign-in page: a business page can own the route /');
check(!all.includes('crud_dashboard')&&!all.includes('crud_login'),'no link to a page that is not generated');
check(layout.includes('homePage="start"')&&layout.includes('<Navigate $$id="afterLogout" page="start">'),'the first business page of ui.navigation is the home of the shell');
check(!c.files[routes+'items/+page.flow.svelte'].includes('needLogin'),'entity pages do not redirect to a missing sign-in page');
const login=structuredClone(spec);login.ui={homePage:false,navigation:[{page:'start',label:'Start'}]};
const l=compiler.compile(login,'CrudOff',services);
check(l.files[routes+'login/+page.flow.svelte'].includes('<Navigate $$id="afterLogin" page="start">'),'the generated sign-in leads to the business entry page');
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
