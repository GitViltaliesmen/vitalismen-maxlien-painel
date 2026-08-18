import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/tex-ultra-entry-unread-v22-20260818.json', 'utf8'));
if (
    manifest.publicationStatus !== 'approved_for_publication'
    || manifest.policy?.audioHumanApprovalRequired !== true
    || manifest.policy?.audioHumanApprovalStatus !== 'approved_by_operator'
) {
    console.error('[TEX-ULTRA-V22] publicacao bloqueada: escute e aprove explicitamente o audio universal antes do deploy.');
    process.exit(1);
}
console.log('[TEX-ULTRA-V22] audio universal aprovado para publicacao.');
