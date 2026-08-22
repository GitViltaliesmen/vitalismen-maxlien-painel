import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(
    'docs/freeze/protocolo-g-tex-ultra-origin-v34-20260822.json',
    'utf8'
));

if (
    manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_draft_pr_and_controlled_activation'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.scope !== 'protocolo_g_tex_ultra_independent_product_origin_v34'
) {
    throw new Error('[PROTOCOLO-G-TEX-ULTRA-V34] deploy bloqueado: autorização explícita ausente ou divergente.');
}

console.log('[PROTOCOLO-G-TEX-ULTRA-V34] autorização explícita para a origem Tex Ultra verificada.');
