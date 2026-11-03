#!/usr/bin/env python3
"""Create/remove an ephemeral MCP proof bearer in a user-owned test workspace.

This is a local test administrator operation; never target a shared workspace.
The signing key must already have been created by the canonical jwt helper.
No secret or raw token is printed. Delete the record and token with --remove.
"""
import argparse,base64,datetime,hashlib,hmac,json,os,pathlib,secrets,time
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--workspace',required=True);p.add_argument('--token-file',required=True);p.add_argument('--remove',action='store_true');a=p.parse_args()
root=pathlib.Path(a.workspace).resolve()/'jwt/mcp';target=pathlib.Path(a.token_file).resolve();marker=target.with_suffix(target.suffix+'.record')
if a.remove:
 if marker.exists():
  record=root/'tokens/active'/marker.read_text().strip()
  if record.name.startswith('mcp_') and record.suffix=='.json':record.unlink(missing_ok=True)
 marker.unlink(missing_ok=True);target.unlink(missing_ok=True)
 print(json.dumps({'removed':True}));raise SystemExit
key=(root/'keys/signing-current.key').read_text().strip().encode();assert len(key)>=32
assert not target.exists() and not marker.exists(),'Refuse to overwrite proof credential'
def b64(b):return base64.urlsafe_b64encode(b).decode().rstrip('=')
def encoded(o):return b64(json.dumps(o,separators=(',',':')).encode())
now=int(time.time());expires=now+7200;identity='mcp_'+secrets.token_hex(16);jti=secrets.token_hex(32)
head=encoded({'alg':'HS256','typ':'JWT','kid':identity})
payload=encoded({'iss':'lib_ConvertigoMCP','aud':'ConvertigoMCP','sub':'mission33-local-proof','jti':jti,'kind':'durable','scope':'mcp:full','iat':now,'nbf':now,'exp':expires})
unsigned=head+'.'+payload;token=unsigned+'.'+b64(hmac.new(key,unsigned.encode(),hashlib.sha256).digest())
def iso(n):return datetime.datetime.fromtimestamp(n,datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
record={'id':identity,'name':'Mission 33 ephemeral MCP proof','kind':'durable','scope':'mcp:full','jtiHash':b64(hashlib.sha256(jti.encode()).digest()),'createdAt':iso(now),'expiresAt':iso(expires),'lastUsedAt':'','revokedAt':'','createdBy':'mission33-local-proof'}
path=root/'tokens/active'/(''+identity+'.json');path.parent.mkdir(parents=True,exist_ok=True)
for dest,data in [(path,json.dumps(record)),(target,token),(marker,path.name)]:
 dest.parent.mkdir(parents=True,exist_ok=True)
 fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(data)
print(json.dumps({'created':True,'expiresAt':record['expiresAt']}))
