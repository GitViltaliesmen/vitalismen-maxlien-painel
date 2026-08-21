import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/panel-image-csp-blob-v33-20260821.json', 'utf8'));
const approval = manifest.operatorApproval || {};

if (
    approval.status !== 'approved_in_thread'
    || approval.approvedAt !== '2026-08-21T22:43:28Z'
    || approval.scope !== 'fix_authenticated_inbound_images_in_panel_v33'
) {
    throw new Error('[PANEL-IMAGE-CSP-V33] deploy bloqueado: autorização explícita ausente ou divergente.');
}

console.log('[PANEL-IMAGE-CSP-V33] autorização explícita para corrigir imagens do painel verificada.');
