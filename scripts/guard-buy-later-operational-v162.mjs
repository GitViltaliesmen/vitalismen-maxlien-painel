import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
    BUY_LATER_REMINDER_POLICY,
    buyLaterOperationalCandidateQuery
} from '../src/services/adminBuyLaterFollowupService.js';
import {
    BUY_LATER_V162_BATCH_LIMIT,
    BUY_LATER_V162_ENV_ALLOWLIST,
    BUY_LATER_V162_INTERVAL_MINUTES
} from './run-buy-later-followup-v162.mjs';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-buy-later-operational-v162-20260915.json';
const manifestText = read(manifestPath);
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_BUY_LATER_OPERATIONAL_V162_20260915');
assert.equal(manifest.version, 162);
assert.equal(manifest.parentCommit, '7618001e34dff3c8e556d75849e5fa842d5b1fd6');
assert.equal(manifest.parentTree, '9f63a2b964e77e82b7e4b90044643c7c93f6378a');
assert.equal(manifest.parentTag, 'production-20260914-7618001');
assert.equal(manifest.parentManifest, 'docs/freeze/ec-negative-intent-buy-later-v161-20260914.json');
assert.equal(manifest.parentManifestSha256, '2fcb1583446b3f53f2a36a675c8f9851cea34acacecc06fda43aff19ff36e481');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
const successorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    if (successorOverrides.has(relative)) continue;
    assert.equal(hash(relative), expected, `V162 protected file diverged: ${relative}`);
}
for (const [relative, expected] of Object.entries(manifest.preservedFiles)) {
    assert.equal(hash(relative), expected, `V162 preserved file diverged: ${relative}`);
}

assert.equal(BUY_LATER_V162_BATCH_LIMIT, 1);
assert.equal(BUY_LATER_V162_INTERVAL_MINUTES, 15);
assert.ok(BUY_LATER_V162_ENV_ALLOWLIST.some((key) => key.startsWith('MONGO')));
assert.ok(BUY_LATER_V162_ENV_ALLOWLIST.some((key) => key.startsWith('ZAPI')));
assert.ok(!BUY_LATER_V162_ENV_ALLOWLIST.some((key) => /DROPI|META|SCHEDULER/.test(key)));

const service = read('src/services/adminBuyLaterFollowupService.js');
const runner = read('scripts/run-buy-later-followup-v162.mjs');
const wrapper = read('ops/buy-later-followup-v162');
const serviceUnit = read('ops/systemd/vitalismen-buy-later-followup-v162.service');
const timerUnit = read('ops/systemd/vitalismen-buy-later-followup-v162.timer');
const scheduler = read('src/services/schedulerService.js');
const v78 = read('src/services/ecBotCoreOperationalV78Service.js');
const packageJson = JSON.parse(read('package.json'));

const query = buyLaterOperationalCandidateQuery(new Date('2026-10-01T14:00:00.000Z'));
assert.equal(query.countryCode, 'EC');
assert.equal(query['metadata.customerDraft.status'], 'comprar_depois');
assert.equal(query['buyLaterReminder.active'], true);
assert.equal(query['buyLaterReminder.sentAt'], null);
assert.equal(query['buyLaterReminder.failedAt'], null);
assert.deepEqual(query['buyLaterReminder.productKey'].$in.sort(), ['nitrix_ec', 'tex_ultra_ec', 'vit_power_ec']);

assert.match(service, /recipientGuard = isAutomationRecipientAllowed/);
assert.match(service, /ContactState\.findOneAndUpdate/);
assert.match(service, /Message\.findOne/);
assert.match(service, /provider: 'zapi'/);
assert.match(service, /sessionId: 'zapi'/);
assert.match(service, /force: false/);
assert.match(service, /reason: 'recovered_from_history'/);
assert.doesNotMatch(service, /from ['"][^'"]*(?:droppi|dropi|metaConversions|sendAudio|sendImage|sendVideo|sendDocument)[^'"]*['"]/i);

assert.match(runner, /processAdminBuyLaterFollowups/);
assert.match(runner, /runWithReservedBuyLaterV162Stdout/);
assert.match(runner, /process\.stdout\.write = \(\) => true/);
assert.match(runner, /installStrictReadOnlyMongooseGuard/);
assert.match(runner, /autoIndex: false/);
assert.match(runner, /ADMIN_BUY_LATER_FOLLOWUP_ENABLED: 'false'/);
assert.match(runner, /VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'false'/);
assert.match(runner, /WHATSAPP_AUTOMATION_PILOT_ONLY: 'false'/);
assert.match(runner, /DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY'/);
assert.doesNotMatch(runner, /schedulerService|startScheduler|sendAudio|sendImage|sendVideo|sendPurchaseEvent|droppiEcuador/);

assert.match(wrapper, /BUY_LATER_V162_OPERATIONAL_ENABLED="\$gate"/);
assert.match(wrapper, /unexpected_candidates/);
assert.match(wrapper, /systemctl enable --now "\$timer_unit"/);
assert.match(wrapper, /cycle_failed_no_retry/);
assert.match(wrapper, /unit-backups\/v162-/);

assert.match(serviceUnit, /Type=oneshot/);
assert.match(serviceUnit, /User=root/);
assert.match(serviceUnit, /Group=root/);
assert.match(serviceUnit, /WorkingDirectory=\/opt\/vitalismen-automacao\/current/);
assert.match(serviceUnit, /UMask=0077/);
assert.match(serviceUnit, /NoNewPrivileges=true/);
assert.match(serviceUnit, /PrivateTmp=true/);
assert.match(serviceUnit, /ProtectSystem=full/);
assert.equal(serviceUnit.match(/ReadWritePaths=/g)?.length, 1);
assert.doesNotMatch(serviceUnit, /ReadWritePaths=.*\/opt/);
assert.match(timerUnit, /OnBootSec=5min/);
assert.match(timerUnit, /OnUnitActiveSec=15min/);
assert.match(timerUnit, /RandomizedDelaySec=30s/);
assert.match(timerUnit, /Persistent=true/);

assert.match(scheduler, /flagEnabled\('ADMIN_BUY_LATER_FOLLOWUP_ENABLED', false\)/);
assert.match(v78, /'ADMIN_BUY_LATER_FOLLOWUP_ENABLED'/);
assert.equal(BUY_LATER_REMINDER_POLICY.timezone, 'America/Guayaquil');
assert.equal(BUY_LATER_REMINDER_POLICY.windowStartDaysBefore, 4);
assert.equal(BUY_LATER_REMINDER_POLICY.windowEndDaysBefore, 3);
assert.equal(BUY_LATER_REMINDER_POLICY.lockMinutes, 10);
assert.equal(BUY_LATER_REMINDER_POLICY.maxAutomaticAttempts, 1);
assert.equal(BUY_LATER_REMINDER_POLICY.sendsMedia, false);
assert.equal(BUY_LATER_REMINDER_POLICY.createsOrder, false);
assert.equal(BUY_LATER_REMINDER_POLICY.sendsDropi, false);
assert.equal(BUY_LATER_REMINDER_POLICY.sendsMeta, false);

assert.match(packageJson.scripts['guard:buy-later-v162'], /guard-buy-later-operational-v162\.mjs/);
assert.match(packageJson.scripts['guard:buy-later-v162'], /buy-later-operational-v162\.test\.mjs/);
assert.match(packageJson.scripts.test, /guard:buy-later-v162/);

for (const [key, expected] of Object.entries({
    registrationSupported: true,
    dateRequired: true,
    canonicalStatus: 'comprar_depois',
    legacyBackfill: false,
    legacyBulkSend: false,
    globalSchedulerEnabled: false,
    mainPm2EnvChanged: false,
    v78Changed: false,
    batchLimit: 1,
    intervalMinutes: 15,
    maxAutomaticAttempts: 1,
    sendsMedia: false,
    createsOrder: false,
    createsShipment: false,
    callsDropi: false,
    callsMeta: false,
    filesOutsideScope: 0
})) assert.equal(manifest.policy[key], expected, key);

console.log('BUY_LATER_OPERATIONAL_V162_GUARD=PASS');
