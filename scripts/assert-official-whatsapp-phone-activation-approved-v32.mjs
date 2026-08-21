import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/official-whatsapp-phone-test-v32-20260821.json', 'utf8'));
const approval = manifest.operatorApproval || {};

if (
    approval.status !== 'approved_in_thread'
    || approval.approvedAt !== '2026-08-21T22:05:22Z'
    || approval.scope !== 'correct_official_whatsapp_phone_and_enable_test_media_v32'
) {
    throw new Error('[WHATSAPP-PHONE-V32] deploy/ativação bloqueado: autorização explícita ausente ou divergente.');
}

console.log('[WHATSAPP-PHONE-V32] autorização explícita de correção, QA e ativação verificada.');
