import sqlite3
from datetime import datetime, timezone


DBS = {
    "EC": "/opt/maxlien-mvp/leads_ec.sqlite3",
    "CO": "/opt/maxlien-mvp/leads_co.sqlite3",
}

REVIEW_ONLY = {
    "CO": [
        (460, "confirmado", "atualizacao_whatsapp_revisao_sem_disparo"),
        (486, "atendendo", "atualizacao_whatsapp_revisao_sem_disparo"),
        (461, "atendendo", "atualizacao_whatsapp_revisao_sem_disparo"),
    ]
}

NO_SEND_MARKER = (
    "Atualizacao WhatsApp historica; sem disparo automatico; "
    "sem bonus em massa; data original preservada."
)


def ensure_activity(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS lead_activity_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            activity_type TEXT,
            detail TEXT,
            created_at TEXT
        )
        """
    )


def has_notes(cur):
    return "notes" in {row[1] for row in cur.execute("PRAGMA table_info(leads)").fetchall()}


def append_note(cur, lead_id, marker):
    if not has_notes(cur):
        return
    row = cur.execute("SELECT COALESCE(notes, '') FROM leads WHERE id=?", (lead_id,)).fetchone()
    if not row:
        return
    notes = row[0] or ""
    if marker in notes:
        return
    notes = (notes + "\n" + marker).strip() if notes else marker
    cur.execute("UPDATE leads SET notes=? WHERE id=?", (notes, lead_id))


def main():
    now = datetime.now(timezone.utc).isoformat()
    summary = {}
    for country, path in DBS.items():
        con = sqlite3.connect(path)
        cur = con.cursor()
        ensure_activity(cur)

        status_rows = cur.execute(
            """
            SELECT id, lead_id
            FROM lead_status_history
            WHERE action IN ('status_consolidado_paineis', 'resgate_retroativo_whatsapp')
            """
        ).fetchall()
        for row_id, lead_id in status_rows:
            cur.execute(
                "UPDATE lead_status_history SET action=? WHERE id=?",
                ("atualizacao_whatsapp_historica", row_id),
            )
            append_note(cur, lead_id, NO_SEND_MARKER)

        activity_rows = cur.execute(
            """
            SELECT id, lead_id, detail
            FROM lead_activity_history
            WHERE activity_type IN ('status_consolidado_paineis', 'historico_whatsapp')
            """
        ).fetchall()
        for row_id, lead_id, detail in activity_rows:
            detail = (detail or "") + " | Atualizacao historica WhatsApp sem disparo automatico."
            cur.execute(
                "UPDATE lead_activity_history SET activity_type=?, detail=? WHERE id=?",
                ("atualizacao_whatsapp_historica", detail, row_id),
            )
            append_note(cur, lead_id, NO_SEND_MARKER)

        review_added = 0
        for lead_id, consolidated_status, action in REVIEW_ONLY.get(country, []):
            row = cur.execute("SELECT status FROM leads WHERE id=?", (lead_id,)).fetchone()
            if not row:
                continue
            append_note(
                cur,
                lead_id,
                f"Atualizacao WhatsApp em revisao; sinal externo={consolidated_status}; sem alteracao de status; sem disparo automatico.",
            )
            exists = cur.execute(
                """
                SELECT 1
                FROM lead_activity_history
                WHERE lead_id=? AND activity_type=? AND detail LIKE ?
                LIMIT 1
                """,
                (lead_id, action, f"%sinal externo={consolidated_status}%"),
            ).fetchone()
            if not exists:
                cur.execute(
                    "INSERT INTO lead_activity_history (lead_id, activity_type, detail, created_at) VALUES (?, ?, ?, ?)",
                    (
                        lead_id,
                        action,
                        f"Sinal externo={consolidated_status}; mantido status atual={row[0] or ''}; sem disparo automatico.",
                        now,
                    ),
                )
                review_added += 1

        con.commit()
        summary[country] = {
            "historical_status_rows_marked": len(status_rows),
            "historical_activity_rows_marked": len(activity_rows),
            "review_only_added": review_added,
        }
        con.close()
    print(summary)


if __name__ == "__main__":
    main()
