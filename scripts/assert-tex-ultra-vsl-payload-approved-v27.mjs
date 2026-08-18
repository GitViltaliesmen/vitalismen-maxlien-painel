import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/tex-ultra-vsl-payload-v27-20260818.json', 'utf8'));

if (
    manifest.freezeId !== 'tex-ultra-vsl-payload-v27-20260818'
    || manifest.publicationStatus !== 'approved_for_publication'
    || manifest.operatorPublicationApproval?.status !== 'approved_in_thread'
    || manifest.operatorPublicationApproval?.scope !== 'controlled_deploy_v27_test_phone_5515998038637'
) {
    console.error('[TEX-ULTRA-VSL-PAYLOAD-V27] publicacao bloqueada: a V27 exige nova autorizacao explicita para deploy.');
    process.exit(1);
}

console.log('[TEX-ULTRA-VSL-PAYLOAD-V27] publicacao aprovada pelo operador.');
