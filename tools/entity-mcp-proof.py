#!/usr/bin/env python3
"""Build an entity exercise only via authenticated HTTP MCP tools, without an LLM.

The input fixture contains declarative model, engine config and complete source
strings; no project source is ever written by this client. It records every MCP
response and tool name, but neither the bearer nor request headers. A failure
keeps a partial transcript and explicit complete:false; it is not a proof.
"""
import argparse, copy, http.cookiejar, json, pathlib, time, urllib.error, urllib.request

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:19580/convertigo/api/flow-mcp')
parser.add_argument('--token-file',required=True)
parser.add_argument('--project',default='EntityMcpExercise')
parser.add_argument('--fixture',required=True)
parser.add_argument('--evidence',required=True)
parser.add_argument('--credentials-file')
parser.add_argument('--username',default='admin@example.test')
args=parser.parse_args()
fixture=json.loads(pathlib.Path(args.fixture).read_text())
bearer=pathlib.Path(args.token_file).read_text().strip()
assert bearer and '\n' not in bearer,'Expected a single bearer in private token file'
output=pathlib.Path(args.evidence);output.mkdir(parents=True,exist_ok=True)
transcript=[];tool_calls=0;protocol_calls=0;checks=[]
http_setup_calls=0
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def rpc(method,params):
 global protocol_calls,tool_calls
 protocol_calls+=1
 if method=='tools/call': tool_calls+=1
 request={'jsonrpc':'2.0','id':protocol_calls,'method':method,'params':params}
 start=time.perf_counter()
 body=json.dumps(request).encode()
 http=urllib.request.Request(args.url,body,{'Content-Type':'application/json','Authorization':'Bearer '+bearer})
 try:
  with opener.open(http,timeout=300) as result: raw=result.read().decode()
 except urllib.error.HTTPError as error:
  raw=error.read().decode();raise RuntimeError('MCP HTTP '+str(error.code)+': '+raw[:500]) from error
 response=json.loads(raw)
 transcript.append({'index':protocol_calls,'method':method,'tool':params.get('name'),
                    'elapsedMs':round((time.perf_counter()-start)*1000,3),'response':response})
 (output/'transcript.json').write_text(json.dumps(transcript,indent=2,ensure_ascii=False))
 if response.get('error'):raise RuntimeError(json.dumps(response['error']))
 return response.get('result',{})

def tool(name,arguments,refusal=False):
 result=rpc('tools/call',{'name':name,'arguments':arguments})
 content=result.get('structuredContent')
 if content is None: raise AssertionError(name+' omitted structuredContent: '+json.dumps(result)[:1000])
 failed=result.get('isError') or content.get('error') or content.get('ok') is False
 if not refusal and failed: raise AssertionError(name+' failed: '+json.dumps(content)[:1500])
 if refusal and not failed: raise AssertionError(name+' should have refused')
 return content

def check(name,value):
 if not value: raise AssertionError(name)
 checks.append(name)

def render(value):
 return value.replace('${PROJECT}',args.project)

def source_create(source):
 params={'project':args.project,'code':render(source['code'])}
 for key in ['name','qname','sourceFile','block']:
  if key in source:params[key]=render(source[key])
 if 'sourceFile' in params:
  current=tool('code-get',{'project':args.project,'sourceFile':params['sourceFile']}) if source.get('existing') else None
  if current and current.get('revision'):params['revision']=current['revision']
  tool('frontend-svelte-action',{'project':args.project,'actionId':'dev.ensure','wait':False})
 saved=tool('code-set',params)
 if 'sourceFile' not in params and 'block' not in params:
  selector={'project':args.project,'qname':params.get('qname',args.project+'.'+params['name'])}
  run=tool('code-run',{**selector,'input':source.get('input',{})}) if source.get('run') else None
  tool('code-promote',{**selector,**({'revision':saved['revision']} if saved.get('revision') else {})})
 if source.get('authenticateAfter'):
  global http_setup_calls
  assert args.credentials_file,'--credentials-file required for real session acceptance'
  import urllib.parse
  password=json.loads(pathlib.Path(args.credentials_file).read_text())['password']
  url=args.url.split('/api/flow-mcp')[0]+'/projects/'+args.project+'/.json'
  with opener.open(url,urllib.parse.urlencode({'__sequence':'SignIn','user':args.username,'password':password}).encode(),timeout=300) as response:
   signed=json.load(response)
  http_setup_calls+=1
  check('Real account session established',signed.get('user')==args.username)
 return saved

complete=False
try:
 rpc('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'entity-mcp-proof','version':'1'}})
 descriptor=rpc('tools/list',{})
 names={item['name'] for item in descriptor.get('tools',[])}
 check('Three model tools advertised',all('flow-entity-model-'+op in names for op in ['get','check','set']))
 for uri in ['flow://guide/entities','flow://guide/multipage-entities']:
  resource=rpc('resources/read',{'uri':uri});check(uri+' readable',bool(resource.get('contents')))
 boot=tool('flow-project-bootstrap',{'project':args.project,'ui':True,'references':fixture['references']})
 check('Blank project created',boot.get('imported') is True or boot.get('created') is True)
 before=tool('flow-entity-model-get',{'project':args.project})
 check('Model initially absent',before.get('revision')=='missing')
 checked=tool('flow-entity-model-check',{'project':args.project,'model':fixture['model']})
 check('Model valid without write',checked.get('valid') is True)
 unchanged=tool('flow-entity-model-get',{'project':args.project})
 check('Check has no write',unchanged.get('revision')=='missing')
 saved=tool('flow-entity-model-set',{'project':args.project,'model':fixture['model'],'expectedRevision':'missing'})
 revision=tool('flow-entity-model-get',{'project':args.project})['revision']
 stale=tool('flow-entity-model-set',{'project':args.project,'model':fixture['model'],'expectedRevision':'missing'},refusal=True)
 check('Stale model refused',True)
 invalid=copy.deepcopy(fixture['model']);invalid['version']=999
 bad=tool('flow-entity-model-check',{'project':args.project,'model':invalid},refusal=True)
 check('Invalid model diagnostics',bool(bad.get('diagnostics') or bad.get('error')))
 tool('flow-entity-model-set',{'project':args.project,'model':invalid,'expectedRevision':revision},refusal=True)
 after=tool('flow-entity-model-get',{'project':args.project})
 check('Refusals preserve model revision',after.get('revision')==revision)
 for resource in fixture.get('resources',[]):
  path=render(resource['path']);current=tool('flow-resource-get',{'project':args.project,'path':path})
  patch={'project':args.project,'path':path,'baseHash':current.get('hash',current.get('baseHash','missing'))}
  if 'content' in resource:patch['content']=render(resource['content'])
  else:patch['edits']=[{k:render(v) for k,v in edit.items()} for edit in resource['edits']]
  tool('flow-resource-patch',patch)
 for source in fixture.get('sources',[]):source_create(source)
 tool('project-save',{'project':args.project})
 tree=tool('authoring-tree',{'project':args.project,'surface':'frontend','builder':'svelte','includeFrontendCatalog':True,'maxDepth':14})
 (output/'authoring-tree.json').write_text(json.dumps(tree,indent=2,ensure_ascii=False))
 parent=fixture.get('paletteParentPath')
 if not parent:
  candidates=[]
  def scan(value):
   if isinstance(value,dict):
    if value.get('kind')=='frontendStructure' and value.get('parentPath'):candidates.append(value['parentPath'])
    for child in value.values():scan(child)
   elif isinstance(value,list):
    for child in value:scan(child)
  scan(tree)
  parent=next((p for p in candidates if p.startswith(args.project+'::')),None)
 check('Palette insertion parent found',bool(parent))
 if parent:
  for query in ['EntityTable','EntityForm']:
   palette=tool('authoring-palette',{'parentPath':render(parent),'surface':'frontend','builder':'svelte','query':query})
   check(query+' in palette',any(query.lower() in json.dumps(item).lower() for item in palette.get('items',[])))
 if fixture.get('build',True):tool('frontend-svelte-action',{'project':args.project,'actionId':'build','wait':True})
 complete=True
finally:
 report={'complete':complete,'project':args.project,'toolCalls':tool_calls,'protocolCalls':protocol_calls,'httpSessionAcceptanceCalls':http_setup_calls,'checks':checks,'sourceWritesViaMcpOnly':True,'modelRevision':locals().get('revision'),'limits':fixture.get('limits',[])}
 (output/'summary.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
 print(json.dumps(report,ensure_ascii=False))
