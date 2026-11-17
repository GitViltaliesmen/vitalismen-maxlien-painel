import pathlib,runpy,json,copy,hashlib,ast
H=pathlib.Path(__file__).resolve().parent;scope=runpy.run_path(str(H/'operations-controller.py'),run_name='isolated_test');checks=[]
assert scope['canon']({})==b'{}\n';checks.append('canonical_records')
parsed=ast.parse((H/'operations-controller.py').read_text());values=[n.value for n in ast.walk(parsed)if isinstance(n,ast.Constant)and isinstance(n.value,str)and n.value.startswith('[Service]')]
assert values and values[0].count('\n')==2 and '\\n' not in values[0];checks.append('systemd_actual_newlines')
g=scope['open_public'].__globals__;R=pathlib.Path('/isolated/registered-release');a={'commit':'a'*40};state={'state':'ACTIVE','runtimeAllowed':True,'texMeasurementV243Allowed':False,'linkedEntryAudience':'PRIVATE_QA','b01Allowed':True,'measurementAllowed':True,'firstOriginalDate':'preserved'}
proof={'kind':'TEX_MEASUREMENT_V243','commit':a['commit'],'officialInboundGuardVerified':True,'firstChannelAndRestartDedupeVerified':True,'hmacAndPrivacyVerified':True,'otherProductsPreserved':True,'noProductionSyntheticEvents':True,'pass':True,'realWhatsAppInboundClaimed':False,'whatsappSends':0,'ordersCreated':0,'metaEvents':0}
class Current:
 def resolve(self):return R
writes=[];receipts=[]
g.update(approval=lambda:(a,R),C=Current(),gates=lambda:None,read=lambda p:copy.deepcopy(proof if pathlib.Path(p).name=='tex-measurement-qa-proof.json'else state),sha=lambda p:'proof-sha',atomic=lambda p,b:writes.append(json.loads(b)),canon=lambda x:(json.dumps(x)+'\n').encode(),utc=lambda:'now',receipt=lambda name,value:receipts.append((name,value))or value)
for key,value in [('kind','other'),('commit','b'*40),('officialInboundGuardVerified',False),('firstChannelAndRestartDedupeVerified',False),('hmacAndPrivacyVerified',False),('otherProductsPreserved',False),('noProductionSyntheticEvents',False),('pass',False),('realWhatsAppInboundClaimed',True),('whatsappSends',1),('ordersCreated',1),('metaEvents',1)]:
 old=proof[key];proof[key]=value
 try:scope['open_public']();raise RuntimeError('Invalid proof admitted: '+key)
 except AssertionError:assert not writes;checks.append('deny_'+key)
 proof[key]=old
scope['open_public']();assert len(writes)==1 and writes[0]['texMeasurementV243Allowed']is True;assert writes[0]['b01Allowed']and writes[0]['measurementAllowed']and writes[0]['firstOriginalDate']=='preserved';checks.append('public_changes_only_new_capability')
writes.clear();scope['rollback_feature']();assert len(writes)==1 and writes[0]['texMeasurementV243Allowed']is False and writes[0]['runtimeAllowed']is True;assert receipts[-1][1]['pm2Restarts']==0 and receipts[-1][1]['identityAndAntiReplayMemoryPreserved'];checks.append('compatible_rollback_preserves_runtime_and_memory')
g.update(web_entries_exist=lambda:True)
try:scope['restore'](1);raise RuntimeError('Unsafe predecessor rollback admitted')
except AssertionError as error:assert 'COMPATIBLE_FEATURE_ROLLBACK'in str(error);checks.append('old_code_rollback_denied_after_web_entry')
scope=runpy.run_path(str(H/'operations-controller.py'),run_name='isolated_test');g=scope['parent_state_preserved'].__globals__
parent={'state':'ACTIVE','runtimeAllowed':True,'commit':'parent','activatedAt':'old','b01Allowed':True,'webAllowed':True,'webAudience':'PUBLIC_SITE','burstActivatedAt':'original','linkedEntryAllowed':True,'linkedEntryAudience':'PUBLIC_SITE','linkedEntryActivatedAt':'original-linked'};child={**parent,'commit':'child','activatedAt':'new','state':'PREPARED','runtimeAllowed':False,'texMeasurementV243Allowed':False}
g['read']=lambda p:copy.deepcopy(parent if pathlib.Path(p).parent.name=='ec-b01-period-price-v243-r2'else child)
scope['parent_state_preserved']();checks.append('parent_mutable_fields_preserved')
for key in ['b01Allowed','webAllowed','webAudience','burstActivatedAt','linkedEntryAllowed','linkedEntryAudience','linkedEntryActivatedAt']:
 old=child[key];child[key]='changed'
 try:scope['parent_state_preserved']();raise RuntimeError('Parent drift admitted')
 except AssertionError:checks.append('deny_parent_drift_'+key)
 child[key]=old
scope=runpy.run_path(str(H/'operations-controller.py'),run_name='isolated_test');report={'mode':'V188_TOTAL_DRY_RUN','profile':{},'zapiConnected':True,'status':'FAIL_OUTBOUND_LIMIT','child':{'status':'PASS_DRY_RUN'}};assert scope['parse_post_sale_report'](json.dumps(report))['status']=='FAIL_OUTBOUND_LIMIT';checks.append('nested_pass_cannot_hide_failure')
for output in [json.dumps(report)+'\n'+json.dumps(report),json.dumps(report['child'])]:
 try:scope['parse_post_sale_report'](output);raise RuntimeError('Ambiguous post-sale report admitted')
 except AssertionError:checks.append('ambiguous_postsale_denied')
result={'project':'VITALISMEN_EC','pass':True,'checks':checks,'controllerSha256':hashlib.sha256((H/'operations-controller.py').read_bytes()).hexdigest(),'productionReads':False,'productionWrites':False};(H/'CONTROLLER_TESTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'pass':True,'checks':len(checks)}))
