import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import './lib/ec-runtime-successor-v170-context.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (relative) => fs.readFileSync(new URL(relative, ROOT), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(new URL(relative, ROOT))).digest('hex');
const context = globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT;

assert.equal(context?.loaded, true, '[V171] successor_context_not_loaded');
assert.equal(context.freezeId, 'EC_TRAFFIC_RESTORATION_V171_20260917');
for (const [file, expected] of Object.entries(context.protectedFiles)) {
    assert.equal(hash(file), expected, `[V171] protected_file_invalid:${file}`);
}

const panel = read('public/qr.html');
assert.match(panel, /AGUARDANDO WHATSAPP/);
assert.match(panel, /chat\.vslPrelead/);
assert.match(panel, /chat\.vslPrelead === true[\s\S]{0,1200}flowCorrectionBtn'\)\.disabled = true/);
assert.match(panel, /data-footer-draft-template.*data-footer-media-url.*data-price-preset.*data-draft-template/);
assert.doesNotMatch(panel, /vslPrelead[\s\S]{0,500}phone:\s*['"]\d/);
assert.equal((panel.match(/chat\.lastMessage\.body/g) || []).length, 0, '[V171] left_list_message_preview_reintroduced');

const route = read('src/routes/whatsapp.js');
assert.match(route, /listPendingVslPreleadPanelChats/);
assert.match(route, /accepted:\s*true/);
assert.match(route, /awaiting_whatsapp_phone/);

const correlation = read('src/services/metaAttributionBridgeService.js');
assert.match(correlation, /canonical_provider_exact_message_unique_120s/);
assert.match(correlation, /ambiguous_exact_visit/);

const router = read('src/services/agentRouter.js');
assert.match(router, /claimMetaAttributionForInboundWhatsapp/);
assert.match(router, /mergeClaimedVslPreleadIntoContactState/);

const bucket = read('src/services/ecConversationBucketService.js');
assert.match(bucket, /qa_8637_attendance_only/);
assert.match(bucket, /EC_CONVERSATION_BUCKETS\.ATTENDANCE/);

const v78 = read('ops/ec-bot-core-v78');
assert.match(v78, /I_UNDERSTAND_V78_BUNDLE_SUPERSEDE/);
assert.match(v78, /run_plan "\$current_release"/);
assert.match(v78, /bundle_superseded/);

console.log(`EC_TRAFFIC_RESTORATION_V171=PASS manifest_sha256=${context.manifestSha256}`);
