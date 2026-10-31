// ui.homePage and ui.loginPage hand the home and the sign-in of the generated shell to hand-written pages.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const routes='_flow/frontbuilder/svelte/model/CrudHome/src/routes/';
const spec={facade:{prefix:'desk'},security:{principals:{ada:'agent'},demoLogin:true},entities:[{name:'tickets',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Title',type:'VARCHAR(80)',required:true}]}]};
// default: the generated dashboard and sign-in
const d=compiler.compile(spec,'CrudHome',services),dLayout=d.files[routes+'+layout.flow.svelte'],dRoot=d.files[routes+'+page.flow.svelte'];
check(dLayout.includes('homePage="crud_dashboard"')&&dLayout.includes('$$id="navDashboard"')&&dLayout.includes('<Navigate $$id="afterLogout" page="crud_login">'),'default shell: generated home and sign-in');
check(dRoot.includes('<Navigate $$id="needLogin" page="crud_login">')&&dRoot.includes('$$id="kpis"'),'default root page: the dashboard');
// business pages
const custom=structuredClone(spec);custom.ui={homePage:'my_space',loginPage:'sign_in',navigation:[{page:'my_space',label:'My space'}]};
const c=compiler.compile(custom,'CrudHome',services),layout=c.files[routes+'+layout.flow.svelte'],root=c.files[routes+'+page.flow.svelte'],login=c.files[routes+'login/+page.flow.svelte'],list=c.files[routes+'tickets/+page.flow.svelte'];
check(layout.includes('homePage="my_space"')&&!layout.includes('$$id="navDashboard"')&&layout.includes('$$id="navCustom_my_space"'),'shell home is the business page, the generic dashboard leaves the navigation');
check(layout.includes('<Navigate $$id="afterLogout" page="sign_in">')&&!layout.includes('page="crud_login"'),'sign-out leads to the business sign-in');
check(root.includes('<Navigate $$id="toHome" page="my_space">')&&root.includes('<Navigate $$id="needLogin" page="sign_in">')&&!root.includes('$$id="kpis"')&&!root.includes('_count'),'the root page only leads to the home page or the sign-in');
check(list&&list.includes('<Navigate $$id="needLogin" page="sign_in">'),'entity pages send an anonymous user to the business sign-in');
check(login&&login.includes('<Navigate $$id="afterLogin" page="my_space">'),'the generated demo sign-in leads to the business home');
check(!Object.keys(c.files).some(p=>/my_space|sign_in/.test(p)),'the model does not own the business pages');
for(const bad of [{homePage:'bad-id'},{loginPage:42},{homePage:'crud_dashboard'},{loginPage:'crud_login'}]){
 const s=structuredClone(spec);s.ui=bad;assert.throws(()=>compiler.compile(s,'CrudHome',services),/ui\.(homePage|loginPage)/);checks.push('refused '+JSON.stringify(bad));
}
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
