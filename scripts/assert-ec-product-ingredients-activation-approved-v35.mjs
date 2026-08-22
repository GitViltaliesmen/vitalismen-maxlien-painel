import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(
    'docs/freeze/ec-product-ingredients-v35-20260822.json',
    'utf8'
));

if (
    manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_draft_pr_and_controlled_activation'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.scope !== 'ec_product_ingredients_faq_v35'
) {
    throw new Error('[EC-PRODUCT-INGREDIENTS-V35] deploy bloqueado: autorização explícita ausente ou divergente.');
}

console.log('[EC-PRODUCT-INGREDIENTS-V35] autorização explícita para FAQ de ingredientes verificada.');
