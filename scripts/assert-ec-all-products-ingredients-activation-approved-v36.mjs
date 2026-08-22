import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(
    'docs/freeze/ec-all-products-ingredients-v36-20260822.json',
    'utf8'
));

if (
    manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_draft_pr_and_controlled_activation'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.scope !== 'ec_all_products_ingredients_v36'
) {
    throw new Error('[EC-ALL-PRODUCTS-INGREDIENTS-V36] deploy bloqueado: autorização explícita ausente ou divergente.');
}

console.log('[EC-ALL-PRODUCTS-INGREDIENTS-V36] autorização explícita para lista consolidada verificada.');
