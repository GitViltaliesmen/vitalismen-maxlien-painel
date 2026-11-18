import pathlib,os,json,hashlib,time,fcntl,runpy,sys
B=pathlib.Path('/opt/vitalismen-automacao/backups/qa-b01-cycle-v244-r8-20261117');C=pathlib.Path('/opt/vitalismen-automacao/current')
assert os.getuid()==0 and os.uname().nodename=='srv1182009'
a=json.loads((B/'PREPARED.json').read_bytes());assert str(C.resolve())==a['parentRelease']
lease=sys.argv[1];assert len(lease)==32 and all(c in'0123456789abcdef'for c in lease)
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
lock=open('/run/lock/vitalismen-stage.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
try:
 assert str(C.resolve())==a['parentRelease']
 ready={'project':'VITALISMEN_EC','status':'STAGE_LOCK_HELD','leaseId':lease,'pid':os.getpid(),'candidateCommit':a['commit'],'timeoutSeconds':7200}
 fd=os.open(B/'STAGE_OWNER_READY.json',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
 with os.fdopen(fd,'w')as f:json.dump(ready,f,indent=2);f.write('\n')
 print(json.dumps({'ready':ready}),flush=True);end=time.monotonic()+7200
 while time.monotonic()<end:
  command=B/'STAGE_OWNER_ACTION.json'
  if not command.exists():time.sleep(1);continue
  st=command.lstat();assert st.st_uid==0 and st.st_gid==0 and st.st_nlink==1 and st.st_mode&0o777==0o400 and not command.is_symlink()
  action=json.loads(command.read_bytes());assert action=={'action':'publish_activate','leaseId':lease,'candidateCommit':a['commit']}
  binding=json.loads((B/'BINDINGS.json').read_bytes());assert sha(__file__)==binding['stageOwnerSha256'];assert sha(B/'operations-controller.py')==binding['controllerSha256']
  # The normal controller bodies retain every approval/gate/health check. Their
  # CLI lock is provided by this same outer owner for the whole atomic sequence.
  scope=runpy.run_path(str(B/'operations-controller.py'),run_name='__v241_stage_owner__')
  p=scope['publish']();print(json.dumps({'publication':p}),flush=True)
  activated=scope['activate']();print(json.dumps({'activation':activated}),flush=True)
  break
 else:raise TimeoutError('STAGE_OWNER_EXPIRED_NO_PUBLICATION')
finally:
 fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
