import { spawnSync } from 'node:child_process';
import { ecPhoneV203 } from './ecHistoricalOrderStatusV203Service.js';

// Read the existing official ledger. No migration, schema or status update.
export const readEcLegacyHistoryV203 = phone => {
    const peer = ecPhoneV203(phone);
    if (!peer) return { available: false, leads: [] };
    const program = `import sqlite3,json,sys
phone=sys.argv[1]
variants=[phone,'+'+phone,phone[3:],'0'+phone[3:]]
con=sqlite3.connect('file:/opt/maxlien-mvp/leads_ec.sqlite3?mode=ro',uri=True,timeout=2)
con.row_factory=sqlite3.Row
marks=','.join('?' for _ in variants)
rows=con.execute("SELECT id,phone,phone_e164,status,blocked FROM leads WHERE country='EC' AND (phone_e164 IN ("+marks+") OR phone IN ("+marks+"))",variants+variants).fetchall()
print(json.dumps([dict(row) for row in rows]))
con.close()`;
    const result = spawnSync('python3', ['-I', '-B', '-S', '-c', program, peer], {
        encoding: 'utf8', timeout: 4000, maxBuffer: 256 * 1024, windowsHide: true
    });
    if (result.status !== 0 || result.error) return { available: false, leads: [] };
    try {
        const leads = JSON.parse(result.stdout);
        return { available: Array.isArray(leads), leads: Array.isArray(leads) ? leads : [] };
    } catch { return { available: false, leads: [] }; }
};
