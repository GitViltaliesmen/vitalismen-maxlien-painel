import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(
    'docs/freeze/ec-direct-product-name-postsale-v39-20260822.json',
    'utf8'
));

if (
    manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.operatorActivationApproval?.status !== 'approved_in_thread'
    || manifest.operatorActivationApproval?.scope !== 'ec_direct_product_name_postsale_v39'
) {
    throw new Error('[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] deploy bloqueado: ativação não autorizada.');
}

console.log('[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] autorização explícita de ativação verificada.');
