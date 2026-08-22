import fs from 'node:fs';

const approval = fs.readFileSync('approved_freezes/APPROVED_EC_MULTIPRODUCT_CORE_V48_20260822.txt', 'utf8');
const manifest = JSON.parse(fs.readFileSync('docs/freeze/ec-multiproduct-core-v48-20260822.json', 'utf8'));

if (
    !approval.includes('EC_MULTIPRODUCT_CORE_V48_ACTIVATION_APPROVED=YES')
    || !approval.includes('REAL_CANARY_AUTHORIZED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.deployAuthorized !== true
    || manifest.policy?.realCanaryAuthorized !== false
) {
    throw new Error('EC_MULTIPRODUCT_CORE_V48_ACTIVATION_APPROVED=NO');
}

console.log('EC_MULTIPRODUCT_CORE_V48_ACTIVATION_APPROVED=YES');
