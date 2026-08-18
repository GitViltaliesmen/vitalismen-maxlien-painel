import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/tex-ultra-strong-intent-v26-20260818.json', 'utf8'));

if (
    manifest.freezeId !== 'tex-ultra-strong-intent-v26-20260818'
    || manifest.publicationStatus !== 'approved_for_publication'
    || manifest.operatorPublicationApproval?.status !== 'approved_in_thread'
    || manifest.operatorPublicationApproval?.scope !== 'controlled_deploy_v26_test_phone_5515998038637'
) {
    console.error('[TEX-ULTRA-STRONG-INTENT-V26] publicacao bloqueada: ajuste validado localmente, mas a V26 ainda exige autorizacao explicita para deploy.');
    process.exit(1);
}

console.log('[TEX-ULTRA-STRONG-INTENT-V26] publicacao aprovada pelo operador.');
