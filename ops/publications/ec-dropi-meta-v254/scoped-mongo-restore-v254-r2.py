import pathlib,subprocess,tempfile,os,json,sys,shutil,hashlib
B=pathlib.Path('/opt/vitalismen-automacao/backups/ec-dropi-meta-v254-20261119-r8');payload=sys.stdin.buffer.read(32*1024*1024+1);assert len(payload)<=32*1024*1024;assert os.getuid()==0 and os.uname().nodename=='srv1182009'
D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-v254-scoped-restore-'));os.chmod(D,0o700)
for n in ['mongo','secrets','legacy']:(D/n).mkdir()
runner=r'''import subprocess,time,socket,os,sys
assert os.readlink('/proc/self/ns/net')!=os.readlink('/proc/1/ns/net')
p=subprocess.Popen(['mongod','--dbpath',DB,'--port','27358','--bind_ip','127.0.0.1','--nounixsocket','--logpath',DB+'/mongo.log','--wiredTigerCacheSizeGB','0.25','--setParameter','diagnosticDataCollectionEnabled=false'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for attempt in range(60):
  if p.poll()is not None:raise RuntimeError('PRIVATE_MONGO_START_FAILED')
  try:s=socket.create_connection(('127.0.0.1',27358),timeout=.5);s.close();break
  except OSError:time.sleep(.5)
 else:raise RuntimeError('PRIVATE_MONGO_START_TIMEOUT')
 r=subprocess.run(['node',B+'/scoped-mongo-restore-v254-r2.mjs'],input=sys.stdin.buffer.read(),capture_output=True,timeout=60);sys.stdout.buffer.write(r.stdout);sys.stderr.buffer.write(r.stderr);sys.exit(r.returncode)
finally:p.terminate();p.wait(timeout=15)
'''
(D/'runner.py').write_text('DB='+repr(str(D/'mongo'))+'\nB='+repr(str(B))+'\n'+runner)
shell='set -eu\nmount --make-rprivate /\n'
for n in ['/opt/vitalismen-automacao/releases','/var/lib/vitalismen-deploy','/usr/local/lib/vitalismen-deploy']:
 shell+='mount --bind '+n+' '+n+'\nmount -o remount,bind,ro '+n+'\n'
shell+='mount --bind '+str(D/'secrets')+' /root/.vitalismen-secrets\nmount --bind '+str(D/'legacy')+' /opt/maxlien-mvp\nip link set lo up\nmount -t tmpfs -o size=384M,mode=0700 tmpfs '+str(D/'mongo')+'\nexec "$@"\n'
try:
 r=subprocess.run(['unshare','--mount','--net','--fork','bash','-c',shell,'--','python3','-I','-B','-S',str(D/'runner.py')],input=payload,env={'PATH':'/usr/bin:/bin','NODE_OPTIONS':''},capture_output=True,timeout=110);assert r.returncode==0,r.stderr.decode(errors='replace')[-1600:];d=json.loads(r.stdout);assert d['pass'];d['helperHashes']={n:hashlib.sha256((B/n).read_bytes()).hexdigest()for n in ['scoped-mongo-restore-v254-r2.py','scoped-mongo-restore-v254-r2.mjs']};print(json.dumps(d))
finally:
 assert D.parent==pathlib.Path('/tmp')and D.name.startswith('vitalismen-v254-scoped-restore-');shutil.rmtree(D)
