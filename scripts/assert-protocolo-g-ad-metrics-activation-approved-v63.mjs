import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_PROTOCOLO_G_AD_METRICS_V63_20260826.txt',
    'utf8'
);
const manifest = JSON.parse(fs.readFileSync(
    'docs/freeze/protocolo-g-ad-metrics-v63-20260826.json',
    'utf8'
));

if (
    !approval.includes('PROTOCOLO_G_AD_METRICS_V63_ACTIVATION_APPROVED=YES')
    || !approval.includes('POST_FIX_CUTOFF_2026_08_26T05_13_18Z_APPROVED=YES')
    || !approval.includes('PER_AD_BREAKDOWN_APPROVED=YES')
    || !approval.includes('DEPLOY_AUTHORIZED=YES')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_controlled_activation'
    || manifest.policy?.measurementStartedAt !== '2026-08-26T05:13:18.000Z'
    || manifest.policy?.perAdBreakdown !== true
    || manifest.policy?.vslFilesChanged !== false
    || manifest.policy?.metaAdsChanged !== false
    || manifest.policy?.commercialFlowChanged !== false
    || manifest.policy?.deployAuthorized !== true
) throw new Error('PROTOCOLO_G_AD_METRICS_V63_ACTIVATION_APPROVED=NO');

console.log('PROTOCOLO_G_AD_METRICS_V63_ACTIVATION_APPROVED=YES');
