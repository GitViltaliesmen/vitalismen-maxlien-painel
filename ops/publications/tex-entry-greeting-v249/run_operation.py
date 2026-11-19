from pathlib import Path
import base64,json,subprocess,sys
H=Path(__file__).resolve().parent
action=sys.argv[1] if len(sys.argv)==2 else ''
assert action in ['publish','activate','post-sale-dry-run','rollback']
remote=r'''
import pathlib,subprocess,json,os,hashlib,datetime
B=pathlib.Path('/opt/vitalismen-automacao/backups/tex-entry-greeting-v249-r6-20261118')
binding=json.loads((B/'BINDINGS.json').read_bytes());controller=B/'operations-controller.py'
assert hashlib.sha256(controller.read_bytes()).hexdigest()==binding['controllerSha256']
result=B/('OPERATION_'+ACTION+'.json');log=B/('OPERATION_'+ACTION+'.private.log');runner=B/('run-'+ACTION+'.py')
assert not result.exists()and not log.exists()and not runner.exists()
source="""import subprocess,pathlib,json,os,datetime
B=pathlib.Path(BACKUP)
with open(LOG,'x')as log:
 os.chmod(LOG,0o600)
 p=subprocess.run(['python3','-I','-B','-S',str(B/'operations-controller.py'),ACTION],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'NODE_OPTIONS':'','npm_config_node_options':''})
record={'project':'VITALISMEN_EC','action':ACTION,'exitCode':p.returncode,'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
pathlib.Path(RESULT).write_text(json.dumps(record,indent=2)+'\\n');pathlib.Path(RESULT).chmod(0o400)
"""
runner.write_bytes(('BACKUP='+repr(str(B))+'\nLOG='+repr(str(log))+'\nRESULT='+repr(str(result))+'\nACTION='+repr(ACTION)+'\n'+source).encode());runner.chmod(0o400)
child=subprocess.Popen(['python3','-u','-I','-B','-S',str(runner)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True,close_fds=True)
record={'project':'VITALISMEN_EC','action':ACTION,'pid':child.pid,'result':str(result),'controllerSha256':binding['controllerSha256'],'transportIndependent':True}
(B/('OPERATION_'+ACTION+'_STARTED.json')).write_bytes((json.dumps(record,indent=2)+'\n').encode());print(json.dumps(record))
'''
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input='ACTION='+repr(action)+'\n'+remote,capture_output=True,text=True,encoding='utf8',timeout=20)
assert p.returncode==0,p.stderr[-1200:]
x=json.loads(p.stdout);(H/('OPERATION_'+action+'_STARTED.json')).write_bytes((json.dumps(x,indent=2)+'\n').encode());print(json.dumps(x))
