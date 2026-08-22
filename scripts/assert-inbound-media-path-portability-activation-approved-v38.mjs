import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(
    'docs/freeze/inbound-media-path-portability-v38-20260822.json',
    'utf8'
));

if (
    manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_controlled_activation'
    || manifest.operatorActivationApproval?.status !== 'approved_in_thread'
    || manifest.operatorActivationApproval?.scope !== 'inbound_media_path_portability_v38'
) {
    throw new Error('[INBOUND-MEDIA-PATH-PORTABILITY-V38] deploy bloqueado: candidato ainda não possui autorização explícita de ativação.');
}

console.log('[INBOUND-MEDIA-PATH-PORTABILITY-V38] autorização explícita de ativação verificada.');
