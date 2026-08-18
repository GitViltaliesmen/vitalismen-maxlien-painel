import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/ec-ana-identity-v23-20260818.json', 'utf8'));
const approved = manifest.publicationStatus === 'approved_for_publication'
    && manifest.policy?.officialAgent === 'Ana López'
    && manifest.policy?.texUltraEntryAudioApprovalStatus === 'approved_by_operator'
    && manifest.policy?.unlabelledAudioHumanAuditStatus === 'approved_by_operator';

if (!approved) {
    console.error('[EC-ANA-IDENTITY-V23] publicacao bloqueada: a identidade textual esta pronta, mas os audios ativos ainda exigem escuta e aceite humano.');
    process.exit(1);
}

console.log('[EC-ANA-IDENTITY-V23] identidade e biblioteca de audios aprovadas para publicacao.');
