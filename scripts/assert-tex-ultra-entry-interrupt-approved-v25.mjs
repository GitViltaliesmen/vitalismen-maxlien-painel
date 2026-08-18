import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/tex-ultra-entry-interrupt-v25-20260818.json', 'utf8'));

if (
    manifest.freezeId !== 'tex-ultra-entry-interrupt-v25-20260818'
    || manifest.publicationStatus !== 'approved_for_publication'
    || manifest.operatorPublicationApproval?.status !== 'approved_in_thread'
) {
    console.error('[TEX-ULTRA-INTERRUPT-V25] publicacao bloqueada: a V25 esta validada apenas localmente e ainda exige autorizacao explicita para deploy.');
    process.exit(1);
}

console.log('[TEX-ULTRA-INTERRUPT-V25] publicacao aprovada pelo operador.');
