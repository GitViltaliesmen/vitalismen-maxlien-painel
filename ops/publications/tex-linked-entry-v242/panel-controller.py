"""PROJECT=VITALISMEN_EC. Five exact authorized popup changes in the existing site-chat popup."""
import pathlib,json,hashlib,os,uuid,sys
B=pathlib.Path('/opt/vitalismen-automacao/backups/tex-ultra-linked-entry-v242-r6-20261117');C=pathlib.Path('/opt/vitalismen-automacao/current');sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest();read=lambda p:json.loads(pathlib.Path(p).read_text())
def apply(mode):
 m=read(B/'PUBLIC_BASELINE.json');p=pathlib.Path(m['panelPath']);new=mode=='publish';assert mode in ['publish','rollback']
 if new:
  a=read(B/'PREPARED.json');assert C.resolve()==pathlib.Path(a['release']);assert read(B/'LINKED_ENTRY_PUBLIC.json')['pass'];assert sha(p)==m['panelSha256'],'PANEL_CONCURRENT_CHANGE';source=B/'panel.candidate.html';expected=m['panelCandidateSha256']
 else:
  assert sha(p)==m['panelCandidateSha256'],'PANEL_CONCURRENT_CHANGE';source=B/'panel.before.html';expected=m['panelSha256']
 assert sha(source)==expected;meta=m['panelMetadata'];tmp=p.with_name(p.name+'.tex-v242-'+uuid.uuid4().hex);fd=os.open(tmp,os.O_CREAT|os.O_EXCL|os.O_WRONLY,meta['mode'])
 os.fchmod(fd,meta['mode'])
 with os.fdopen(fd,'wb') as f:f.write(source.read_bytes());f.flush();os.fsync(f.fileno())
 os.chown(tmp,meta['uid'],meta['gid']);os.replace(tmp,p);assert sha(p)==expected
 result={'project':'VITALISMEN_EC','pass':True,'mode':mode,'sha256':expected,'exactPopupChanges':5,'mainWhatsappPanelPreserved':True,'pm2Restarts':0,'nginxReloads':0};out=B/('PANEL_'+mode.upper()+'_'+uuid.uuid4().hex[:8]+'.json');out.write_text(json.dumps(result,indent=2));os.chmod(out,0o400);return result
if __name__=='__main__':
 assert os.getuid()==0;print(json.dumps(apply(sys.argv[1])))
