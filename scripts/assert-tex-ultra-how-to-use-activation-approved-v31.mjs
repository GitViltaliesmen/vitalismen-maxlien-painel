import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/tex-ultra-how-to-use-audio-v31-20260821.json', 'utf8'));
const approval = manifest.operatorApproval || {};

if (
    approval.status !== 'approved_in_thread'
    || approval.approvedAt !== '2026-08-21T19:24:02Z'
    || approval.scope !== 'implement_and_activate_tex_ultra_how_to_use_audio_v31_ec'
) {
    throw new Error('[TEX-ULTRA-USO-V31] deploy/ativação bloqueado: autorização explícita ausente ou divergente.');
}

console.log('[TEX-ULTRA-USO-V31] autorização explícita de implementação e ativação verificada.');
