"""VITALISMEN_EC: durable intake of explicit EC confirmations. No provider or Meta calls."""
import pathlib, os, json, sqlite3, datetime, hashlib, sys, uuid, socket
UTC=datetime.timezone.utc
now=lambda:datetime.datetime.now(UTC)
stamp=lambda d:d.isoformat(timespec='milliseconds').replace('+00:00','Z')
fixture=os.environ.get('V254_SQLITE_FIXTURE_PATH','')
if fixture:
    assert os.readlink('/proc/self/ns/net')!=os.readlink('/proc/1/ns/net') and {name for _,name in socket.if_nameindex()}=={'lo'}
    path=pathlib.Path(fixture).resolve();assert str(path).startswith('/tmp/')
else:
    assert os.getuid()==0 and socket.gethostname()=='srv1182009'
    S=pathlib.Path('/var/lib/vitalismen-deploy/ec-dropi-meta-v254-r8');a=json.loads((S/'approval.json').read_bytes())
    assert a['project']=='VITALISMEN_EC' and a['activationApproved'] is True
    assert hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()==a['hashes']['scripts/ec-sqlite-integration-v254.py']
    path=pathlib.Path('/opt/maxlien-mvp/leads_ec.sqlite3')
action=sys.argv[1] if len(sys.argv)==2 else ''
assert action in ['migrate','claim','finish','inspect','read_claim','read_receipt']
if not fixture and action!='migrate':
    s=json.loads((S/'activation.json').read_bytes());assert s['state']=='ACTIVE' and s['commit']==a['commit'] and s['orderIntegrationV254Allowed'] is True
    assert str(pathlib.Path('/opt/vitalismen-automacao/current').resolve())==a['release']
db=sqlite3.connect(path,timeout=10);db.row_factory=sqlite3.Row
if action=='migrate':
    # New tables/triggers only; old receipt locks and historic customer records are untouched.
    db.executescript('''
CREATE TABLE IF NOT EXISTS ec_confirmation_outbox_v254 (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL, cycle_key TEXT NOT NULL UNIQUE,
 occurred_at TEXT NOT NULL, old_status TEXT NOT NULL, payload TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', token TEXT, lease_until TEXT, retry_at TEXT,
 native_order_id TEXT, error TEXT, updated_at TEXT);
CREATE INDEX IF NOT EXISTS ec_confirmation_outbox_v254_due ON ec_confirmation_outbox_v254(state,retry_at);
''')
    payload="json_object('id',NEW.id,'name',NEW.name,'phone',NEW.phone,'country',NEW.country,'status',NEW.status,'notes',NEW.notes,'event_id',NEW.event_id,'product_qty',NEW.product_qty,'product_value',NEW.product_value,'city',NEW.city,'province',NEW.province,'address',NEW.address)"
    for kind,old,condition in [('INSERT',"'__new__'",''),('UPDATE OF status','OLD.status'," AND lower(COALESCE(OLD.status,''))!='confirmado'")]:
        name='ec_confirmation_v254_'+kind.split()[0].lower()
        sql=f'''CREATE TRIGGER IF NOT EXISTS {name} AFTER {kind} ON leads
WHEN upper(COALESCE(NEW.country,'EC'))='EC' AND lower(NEW.status)='confirmado' AND COALESCE(NEW.blocked,0)=0 AND length(replace(COALESCE(NULLIF(NEW.phone_e164,''),NEW.phone,''),'+',''))=12 AND replace(COALESCE(NULLIF(NEW.phone_e164,''),NEW.phone,''),'+','') GLOB '5939????????' AND replace(COALESCE(NULLIF(NEW.phone_e164,''),NEW.phone,''),'+','') NOT GLOB '*[^0-9]*' {condition}
BEGIN INSERT INTO ec_confirmation_outbox_v254(lead_id,cycle_key,occurred_at,old_status,payload,updated_at)
VALUES(NEW.id,lower(hex(randomblob(16))),strftime('%Y-%m-%dT%H:%M:%fZ','now'),{old},{payload},strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;'''
        db.execute(sql)
    db.commit();result={'pass':True,'newSchemaOnly':True,'historicalRowsSeeded':0,'providerActions':0}
elif action=='claim':
    at=stamp(now());db.execute('BEGIN IMMEDIATE')
    row=db.execute("SELECT * FROM ec_confirmation_outbox_v254 WHERE (state IN ('pending','retry_wait') AND (retry_at IS NULL OR retry_at<=?)) OR (state='processing' AND lease_until<=?) ORDER BY id LIMIT 1",(at,at)).fetchone()
    if row:
        token=uuid.uuid4().hex;lease=stamp(now()+datetime.timedelta(minutes=2));db.execute("UPDATE ec_confirmation_outbox_v254 SET state='processing',token=?,lease_until=?,updated_at=? WHERE id=?",(token,lease,at,row['id']));live=db.execute('SELECT status,blocked FROM leads WHERE id=?',(row['lead_id'],)).fetchone()
        result={'id':row['id'],'leadId':row['lead_id'],'token':token,'oldStatus':row['old_status'],'occurredAt':row['occurred_at'],'payload':json.loads(row['payload']),'liveStatus':live['status']if live else None,'blocked':bool(live['blocked'])if live else True}
    else:result=None
    db.commit()
elif action=='read_receipt':
    x=json.load(sys.stdin);assert isinstance(x.get('leadId'),int) and isinstance(x.get('eventId'),str)
    columns={r[1]for r in db.execute('PRAGMA table_info(purchase_capi_lock)')}
    row=db.execute('SELECT event_id,status,response_payload,updated_at FROM purchase_capi_lock WHERE lead_id=? AND event_id=?',(x['leadId'],x['eventId'])).fetchone()if {'event_id','status','response_payload','updated_at'}.issubset(columns)else None
    result=dict(row)if row else None
elif action=='read_claim':
    x=json.load(sys.stdin);assert isinstance(x.get('id'),int)and isinstance(x.get('leadId'),int)and len(x.get('token',''))==32
    row=db.execute("SELECT id,lead_id,old_status,occurred_at FROM ec_confirmation_outbox_v254 WHERE id=? AND lead_id=? AND token=? AND state='processing' AND lease_until>?",(x['id'],x['leadId'],x['token'],stamp(now()))).fetchone();result=dict(row)if row else None
elif action=='finish':
    x=json.load(sys.stdin);assert isinstance(x.get('id'),int) and len(x.get('token',''))==32 and x.get('state')in['done','blocked','retry_wait']
    result={'updated':db.execute('UPDATE ec_confirmation_outbox_v254 SET state=?,native_order_id=?,error=?,retry_at=?,lease_until=NULL,updated_at=? WHERE id=? AND token=? AND state=\'processing\'',(x['state'],str(x.get('orderId',''))[:100],str(x.get('error',''))[:500],stamp(now()+datetime.timedelta(minutes=2)),stamp(now()),x['id'],x['token'])).rowcount==1};db.commit()
else:result={'states':[dict(x)for x in db.execute('SELECT state,count(*) AS count FROM ec_confirmation_outbox_v254 GROUP BY state')]}
db.close();print(json.dumps(result))
