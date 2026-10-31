// The demo sign-in: off by default, only with the generated sign-in page, never for an unknown or inactive account.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const login='_flow/frontbuilder/svelte/model/CrudDemo/src/routes/login/+page.flow.svelte';
const spec={facade:{prefix:'desk'},security:{principals:{ada:'agent',max:'admin'}},entities:[{name:'members',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'Login',type:'VARCHAR(40)',required:true},{name:'Active',type:'BOOLEAN'}]}]};
const off=compiler.compile(spec,'CrudDemo',services);
check(!off.flows.desk_demo_login&&off.config.crud.demoLogin===false,'off by default: no demo sign-in Flow');
check(off.files[login]&&!off.files[login].includes('_demo_login')&&off.files[login].includes('$$id="loginRequired"'),'the generated sign-in page points to the identity provider');
const on=structuredClone(spec);on.security.demoLogin=true;const o=compiler.compile(on,'CrudDemo',services);
check(o.flows.desk_demo_login&&o.flows.desk_demo_login.includes('"accessibility": "hidden"')&&o.files[login].includes('requestable=".desk_demo_login"'),'security.demoLogin: true generates the demo sign-in and its picker');
const noPage=structuredClone(on);noPage.ui={loginPage:false};const np=compiler.compile(noPage,'CrudDemo',services);
check(!np.flows.desk_demo_login&&!np.files[login]&&np.config.crud.demoLogin===false,'ui.loginPage false: no sign-in page and no demo sign-in Flow');
const noUi=structuredClone(on);noUi.ui={generate:'none'};
check(!compiler.compile(noUi,'CrudDemo',services).flows.desk_demo_login,'ui.generate none: no demo sign-in Flow');
const accounts=structuredClone(on);accounts.security.accounts={entity:'members',login:'Login',active:'Active'};const a=compiler.compile(accounts,'CrudDemo',services),demo=a.flows.desk_demo_login;
check(demo.includes('filter:{field:"login",op:"eq",value:input.user}')&&demo.indexOf('message:"Inactive account"')<demo.indexOf('session.authenticate('),'the demo sign-in refuses an unknown or inactive account before opening the session');
check(a.flows.desk_session.includes('if (local.account && local.account.values.active !== true && local.account.values.active !== "true") {\n    local.user = null'),'the session of an inactive account is anonymous');
for(const bad of [{entity:'missing',login:'Login'},{entity:'members',login:'Id'},{entity:'members',login:'Login',active:'Login'}]){const s=structuredClone(spec);s.security.accounts=bad;assert.throws(()=>model.normalize(s,'CrudDemo',legacy),/security\.accounts/);checks.push('refused accounts '+JSON.stringify(bad));}
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
