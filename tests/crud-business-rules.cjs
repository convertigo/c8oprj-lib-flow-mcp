// An entity whose writes belong to business Flows: generic writes off, no generated screen offering them, business pages
// in the shell; labels and texts come from the model.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../_flow/lib',n+'.js'),'utf8'));
const model=load('crud-model'),legacy=load('crud-legacy'),ui=load('crud-ui'),compiler=load('crud-fastpath'),checks=[];
const services={model,legacy,ui},check=(v,n)=>{assert(v,n);checks.push(n)};
const spec={facade:{prefix:'fleet'},security:{principals:{max:'manager',ada:'agent'},demoLogin:true},
 entities:[
  {name:'owners',label:'Responsables',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'NomComplet',column:'nom_complet',type:'VARCHAR(80)',required:true}],
   permissions:{list:['manager'],read:['manager'],count:['manager'],save:['manager'],delete:['manager']}},
  {name:'assets',label:'Équipements',fields:[{name:'Id',type:'INTEGER',primary:true},{name:'NumeroSerie',column:'numero_serie',type:'VARCHAR(40)',required:true,unique:true},
    {name:'OwnerId',column:'owner_id',type:'INTEGER',required:true},{name:'Actif',type:'BOOLEAN',required:true,default:true},{name:'Note',type:'VARCHAR(200)',label:'Remarque'}],
   permissions:{list:['manager'],read:['manager'],count:['manager'],save:false,delete:false},ui:{navigation:false}}],
 relations:[{name:'asset_owner',type:'many-to-one',fromEntity:'assets',fromField:'owner_id',toEntity:'owners',toField:'id',required:true,label:'Responsable'}],
 ui:{title:'Parc',language:'fr',navigation:[{page:'asset_desk',label:'Équipements',permission:'assets.list'}]}};
const root='_flow/frontbuilder/svelte/model/Fleet/src/routes/';
const c=compiler.compile(spec,'Fleet',services),page=p=>c.files[root+p],layout=page('+layout.flow.svelte');

// Generic writes off: the server refuses every role, the session grants nothing, no page offers a write.
check(/"assets": \{"list": \(local\.role === "manager"\),"read": \(local\.role === "manager"\),"count": \(local\.role === "manager"\),"create": \(false\),"update": \(false\),"delete": \(false\)\}/.test(c.flows.fleet_session),'session grants no generic write on the entity');
check((c.flows.fleet_assets_save.match(/if \(true\) \{\n    throw\(\{code:"FORBIDDEN"/g)||[]).length===2,'generic create and update refuse every role');
check(/if \(true\) \{\n    throw\(\{code:"FORBIDDEN"/.test(c.flows.fleet_assets_delete),'generic delete refuses every role');
const assetPages=Object.keys(c.files).filter(p=>p.startsWith(root+'assets/')).map(p=>c.files[p]).join('\n');
check(!page('assets/+page.flow.svelte').includes('createRecord')&&!/"id":"(edit|delete)"/.test(page('assets/+page.flow.svelte')),'list offers no create, edit or delete');
check(!page('assets/+page.flow.svelte').includes('fleet_assets_delete'),'list never calls the generic delete');
check(!page('assets/detail/+page.flow.svelte').includes('editRecord'),'detail offers no edit');
check(page('assets/+page.flow.svelte').includes('Rechercher et trier les enregistrements.'),'list does not claim to manage the records');
check(/"id":"edit"/.test(page('owners/+page.flow.svelte'))&&page('owners/+page.flow.svelte').includes('createRecord'),'an entity without business rules keeps its generic writes');
// Navigation: the business page replaces the generic list in the shell; the read pages stay.
check(!layout.includes('nav_assets')&&layout.includes('nav_owners'),'shell drops the generic link of the entity only');
check(layout.includes('<If $$id="showCustom_asset_desk" test="@.fleet_session.permissions.assets.list"><Then><LinkButton $$id="navCustom_asset_desk" page="asset_desk"'),'shell links the business page');
check(page('assets/+page.flow.svelte')&&page('assets/detail/+page.flow.svelte'),'generic list and detail stay available read-only');
for(const bad of ['no',1,null]){const s=structuredClone(spec);s.entities[1].ui.navigation=bad;assert.throws(()=>compiler.compile(s,'Fleet',services),/ui\.navigation is true or false/);checks.push('entity ui.navigation '+JSON.stringify(bad)+' refused');}

// Labels from the model: explicit label, relation label for a foreign key, humanized name otherwise.
const form=page('assets/form/+page.flow.svelte'),list=page('assets/+page.flow.svelte');
check(form.includes('label="Numero serie"')&&list.includes('"label":"Numero serie"'),'humanized field name in forms and tables');
check(form.includes('name="owner_id" label="Responsable"')&&list.includes('"label":"Responsable"'),'foreign key labelled by its relation');
check(form.includes('label="Remarque"'),'explicit field label kept');
check(!/label="(NumeroSerie|OwnerId|owner_id)"|"label":"(NumeroSerie|OwnerId)"/.test(assetPages),'no technical name as a label');
const unnamed=structuredClone(spec);delete unnamed.relations[0].label;
check(compiler.compile(unnamed,'Fleet',services).files[root+'assets/form/+page.flow.svelte'].includes('name="owner_id" label="Owner"'),'foreign key without relation label takes its target singular');
const fieldLabels=structuredClone(spec);fieldLabels.entities[1].ui.fieldLabels={owner_id:'Détenteur'};
check(compiler.compile(fieldLabels,'Fleet',services).files[root+'assets/form/+page.flow.svelte'].includes('name="owner_id" label="Détenteur"'),'ui.fieldLabels wins over the relation label');

// Language from the model: every fixed text and component locale follows ui.language.
const all=Object.values(c.files).filter((t,i)=>Object.keys(c.files)[i].endsWith('.flow.svelte')).join('\n');
check(form.includes('placeholder="Choisir" locale="fr"')&&!/placeholder="Choose"/.test(all),'selects are localized');
check(all.includes('loadingText="Traitement…"')&&all.includes('closeLabel="Fermer"')&&layout.includes('navigationLabel="Navigation principale"'),'status and shell texts localized');
const en=structuredClone(spec);en.ui.language='en';
const enText=Object.entries(compiler.compile(en,'Fleet',services).files).filter(([p])=>p.endsWith('.flow.svelte')).map(([,t])=>t).join('\n');
check(enText.includes('label="Sign out"')&&enText.includes('title="Dashboard"')&&enText.includes('placeholder="Choose" locale="en"'),'English application gets English texts');
check(!/Tableau de bord|Enregistrer|Déconnexion|Chargement|Choisir/.test(enText),'no French text left in an English application');
console.log(JSON.stringify({passed:true,count:checks.length,checks}));
