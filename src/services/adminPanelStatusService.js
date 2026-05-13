import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';

const ADMIN_STATUS = 'pedido_enviado';

const resolveAdminDbPath = (country) => {
    const normalized = String(country || '').trim().toUpperCase();
    if (normalized === 'EC') return '/opt/maxlien-mvp/leads_ec.sqlite3';
    if (normalized === 'CO') return '/opt/maxlien-mvp/leads_co.sqlite3';
    return '';
};

const resolveAdminLeadId = (orderId) => {
    const match = String(orderId || '').match(/^[A-Z]{2}-ADMIN-(\d+)$/i);
    return match ? match[1] : '';
};

export const markOnlineAdminPedidoEnviado = ({ orderId, country }) => {
    const leadId = resolveAdminLeadId(orderId);
    const dbPath = resolveAdminDbPath(country);
    if (!leadId || !dbPath) {
        return { ok: false, skipped: true, reason: 'not_online_admin_order' };
    }

    const keyPath = path.join(os.homedir(), '.ssh', 'vps_auditoria_codex');
    const python = `
import sqlite3, json
db_path = ${JSON.stringify(dbPath)}
lead_id = int(${JSON.stringify(leadId)})
status = ${JSON.stringify(ADMIN_STATUS)}
con = sqlite3.connect(db_path)
cur = con.cursor()
cur.execute("UPDATE leads SET status=? WHERE id=?", (status, lead_id))
con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "lead_id": lead_id, "status": status, "changed": changed}))
`;

    const result = spawnSync(
        'ssh',
        [
            '-i',
            keyPath,
            '-o',
            'BatchMode=yes',
            '-o',
            'ConnectTimeout=10',
            'root@maxlien.shop',
            'python3',
            '-'
        ],
        { input: python, encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );

    if (result.status !== 0) {
        return {
            ok: false,
            reason: 'ssh_update_failed',
            error: result.stderr || result.stdout || `exit_${result.status}`
        };
    }

    try {
        return JSON.parse(result.stdout || '{}');
    } catch (error) {
        return { ok: false, reason: 'invalid_update_response', error: error.message };
    }
};
