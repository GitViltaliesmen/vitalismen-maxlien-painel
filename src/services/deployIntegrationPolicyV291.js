import crypto from 'node:crypto';

export const DEPLOY_INTEGRATION_V291 = Object.freeze({
    freezeId: 'deploy-integration-v29-1-20260818',
    parentFreezeId: 'logistics-clean-chat-v29-20260818',
    baseV28Sha: '7bd1418caf81b832f30acb7926f023df7a2e711e',
    baseV29Sha: '5c9f0fd96ddc0f3bd3cc02c24014e6b885c22b77',
    parentManifestSha256: '6569acc57662ac8aba1852836d68e77382dc650c373a3f94eafb44a5358950dc'
});

const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export const validateDeployIntegrationLineageV291 = ({
    freezeId = '',
    parentFreezeId = '',
    baseV28Sha = '',
    baseV29Sha = '',
    parentManifestSha256 = '',
    actualParentManifestSha256 = ''
} = {}) => {
    const failures = [];
    if (freezeId !== DEPLOY_INTEGRATION_V291.freezeId) failures.push('freeze V29.1 não autorizado');
    if (parentFreezeId !== DEPLOY_INTEGRATION_V291.parentFreezeId) failures.push('parent V29 divergente');
    if (!SHA1.test(baseV28Sha) || baseV28Sha !== DEPLOY_INTEGRATION_V291.baseV28Sha) failures.push('SHA V28 falso ou divergente');
    if (!SHA1.test(baseV29Sha) || baseV29Sha !== DEPLOY_INTEGRATION_V291.baseV29Sha) failures.push('SHA V29 falso ou divergente');
    if (!SHA256.test(parentManifestSha256) || parentManifestSha256 !== DEPLOY_INTEGRATION_V291.parentManifestSha256) {
        failures.push('hash declarado do manifesto V29 divergente');
    }
    if (!SHA256.test(actualParentManifestSha256) || actualParentManifestSha256 !== DEPLOY_INTEGRATION_V291.parentManifestSha256) {
        failures.push('manifesto V29 real divergente');
    }
    if (failures.length) throw new Error(`[DEPLOY-INTEGRATION-V29.1] lineage bloqueada: ${failures.join('; ')}`);
    return Object.freeze({
        freezeId,
        parentFreezeId,
        baseV28Sha,
        baseV29Sha,
        parentManifestSha256
    });
};

export const sha256BufferV291 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
