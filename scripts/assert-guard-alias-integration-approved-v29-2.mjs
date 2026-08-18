import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/guard-alias-integration-v29-2-20260818.json', 'utf8'));

assert.equal(manifest.status, 'release_preparation_authorized_activation_locked');
assert.equal(manifest.publicationStatus, 'release_train_authorized');
assert.equal(manifest.operatorPublicationApproval?.status, 'approved_in_thread');
assert.equal(manifest.operatorPublicationApproval?.approvedAt, '2026-08-18T21:24:36Z');
assert.equal(
    manifest.operatorPublicationApproval?.scope,
    'commit_push_pr_ci_backup_tag_and_staging_without_activation'
);
assert.equal(manifest.operatorActivationApproval?.status, 'required_explicit');
assert.equal(manifest.policy?.sourcePromotionAuthorized, true);
assert.equal(manifest.policy?.remoteStagingAuthorized, true);
assert.equal(manifest.policy?.directActivationBlocked, true);

console.log('[GUARD-ALIAS-V29.2] preparação de release autorizada; ativação permanece bloqueada.');
