import pathlib,subprocess,time,os,json,hashlib
D=pathlib.Path(__file__).resolve().parent
assert os.readlink('/proc/self/ns/net')!=os.readlink('/proc/1/ns/net')
subprocess.run(['ip','link','set','lo','up'],check=True)
subprocess.run(['mount','--make-rprivate','/'],check=True)
subprocess.run(['mount','-t','tmpfs','-o','size=384M,mode=0700','tmpfs',str(D/'db')],check=True)
p=subprocess.Popen(['mongod','--dbpath',str(D/'db'),'--port','27139','--bind_ip','127.0.0.1','--logpath',str(D/'mongo.log'),'--wiredTigerCacheSizeGB','0.25','--setParameter','diagnosticDataCollectionEnabled=false'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
env={'PATH':'/usr/bin:/bin','VITALISMEN_QA_ADMIN_URI':'mongodb://127.0.0.1:27139/qa_reset'}
try:
 time.sleep(2);results=[]
 for case,apply,expected in [('completed_reply_dry_run',False,True),('completed_reply_apply',True,True),('attempted',True,False),('provider_ambiguous',True,False),('pending',True,False),('human_auto',True,False),('concurrent_change',True,False),('uncertain_old_ledger',True,False),('unconfirmed_ack',True,False),('unconfirmed_turn_ledger',True,False)]:
  q=subprocess.run(['mongosh','--quiet','--nodb','--eval','const CASE='+json.dumps(case)+';'+(D/'qa-reset-seed.js').read_text()],env=env,capture_output=True,text=True,timeout=30)
  assert q.returncode==0,q.stderr[-800:];data=json.loads(q.stdout)
  code=(D/'qa-reset-mongo-scope.js').read_text().replace('__PACKET__',json.dumps(data['packet'])).replace('__APPLY__','true'if apply else'false').replace('__ARCHIVE__',json.dumps('SYNTHETIC_SCOPE_TEST'))
  q=subprocess.run(['mongosh','--quiet','--nodb','--file','/dev/stdin'],input=code,env=env,capture_output=True,text=True,timeout=30)
  assert(q.returncode==0)==expected,(case,(q.stdout+q.stderr)[-1000:])
  if expected:assert json.loads(q.stdout)['allOldLedgersByteEquivalent']
  verify=r'''const d=connect(process.env.VITALISMEN_QA_ADMIN_URI),base=EJSON.parse(BASE),canon=x=>EJSON.stringify(x,{relaxed:false});
if(canon(d.outbounddedupes.find().sort({_id:1}).toArray())!==canon(base.ledgers))throw Error('LEDGERS_CHANGED');
if(!APPLIED){if(canon(d.contactstates.find().sort({_id:1}).toArray())!==canon(base.contacts)||canon(d.messages.find().sort({_id:1}).toArray())!==canon(base.messages))throw Error('BLOCKED_OR_DRY_RUN_WROTE');}
else {if(d.messages.countDocuments({peerPhone:'5515998038637'})!==0||d.messages.countDocuments({_id:'OTHER_MESSAGE'})!==1||d.contactstates.findOne({phoneDigits:'593999000001'}).marker!=='UNRELATED_KEEP')throw Error('SCOPE_BROKEN');const s=d.contactstates.findOne({phoneDigits:'5515998038637'});if(s.firstInboundText!==''||s.metadata.vslEntryMessage||s.vitPowerBurstV228||s.vitPowerB01||s.human.mode!=='manual'||!s.metadata.noDropiEver||!s.metadata.processedInboundMessageIds.includes('OLD_PROCESSED'))throw Error('IDENTITY_OR_MEMORY_GUARD_BROKEN');}print('VERIFIED');'''
  v=subprocess.run(['mongosh','--quiet','--nodb','--eval','const BASE='+json.dumps(data['baseline'])+',APPLIED='+('true'if expected and apply else'false')+';'+verify],env=env,capture_output=True,text=True,timeout=30)
  assert v.returncode==0,v.stderr[-800:]
  results.append({'case':case,'pass':True,'accepted':expected,'applied':apply and expected})
 print(json.dumps({'project':'VITALISMEN_EC','pass':True,'actualMaintenanceMongoScopeSha256':hashlib.sha256((D/'qa-reset-mongo-scope.js').read_bytes()).hexdigest(),'cases':results,'isolatedNetwork':True,'realMongo':True,'oldLedgersPreserved':True,'foreignContactAndMessagesPreserved':True,'productionWrites':0,'customerMessagesSent':0}))
finally:p.terminate();p.wait(timeout=10)
